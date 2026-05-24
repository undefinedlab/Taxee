import { Bot, InlineKeyboard } from "grammy";
import { eq, and, inArray } from "drizzle-orm";
import { runHeartbeat } from "@taxee/agent/heartbeat";
import { buildAgentPolicy, jurisdictionDisplay, normalizeJurisdiction } from "@taxee/shared";
import type { JurisdictionCode, UserPolicy } from "@taxee/shared";
import { db, users, wallets, agents, opportunities, lots } from "@taxee/db";
import { importLotsForWallet, fetchWalletPositions, provisionCircleWallet, CircleClient } from "@taxee/aggregator";
import axios from "axios";
import {
  clearPendingPolicy,
  formatPolicySummary,
  getPendingPolicy,
  harvestThresholdKeyboard,
  heartbeatKeyboard,
  isPolicySetupComplete,
  jurisdictionKeyboard,
  minLossKeyboard,
  setHarvestThreshold,
  setHeartbeat,
  setJurisdiction,
  setMinLoss,
  type PendingAgentPolicy,
} from "./onboarding.js";

const token = process.env["TELEGRAM_BOT_TOKEN"];
if (!token) throw new Error("TELEGRAM_BOT_TOKEN is required");

const bot = new Bot(token);

const ETH_ADDRESS = /^0x[0-9a-fA-F]{40}$/;

async function getOrCreateUser(chatId: string) {
  const [existing] = await db.select().from(users).where(eq(users.telegramId, chatId));
  if (existing) return existing;
  const [created] = await db
    .insert(users)
    .values({ telegramId: chatId })
    .returning();
  return created!;
}

function policyFromPending(
  userJurisdiction: string | null | undefined,
  chatId: string,
): UserPolicy {
  const pending = getPendingPolicy(chatId);
  const overrides: Parameters<typeof buildAgentPolicy>[1] = { telegramChatId: chatId };
  if (pending?.harvestThresholdPct != null) {
    overrides.harvestThresholdPct = pending.harvestThresholdPct;
  }
  if (pending?.minHarvestLossUsd != null) {
    overrides.minHarvestLossUsd = pending.minHarvestLossUsd;
  }
  if (pending?.heartbeatIntervalMinutes != null) {
    overrides.heartbeatIntervalMinutes = pending.heartbeatIntervalMinutes;
  }
  return buildAgentPolicy(userJurisdiction, overrides);
}

async function getOrCreateAgentForWallet(
  userId: string,
  walletAddress: string,
  telegramChatId: string,
  walletLabel: string,
  userJurisdiction: string | null | undefined,
) {
  const normalized = walletAddress.toLowerCase();
  const agentPolicy = policyFromPending(userJurisdiction, telegramChatId);

  const [existingAgent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.userId, userId), eq(agents.walletAddress, normalized)));

  if (existingAgent) {
    await db.update(agents)
      .set({
        policy: {
          ...(existingAgent.policy as object),
          ...agentPolicy,
          telegramChatId,
        },
      })
      .where(eq(agents.id, existingAgent.id));
    return { ...existingAgent, policy: agentPolicy };
  }

  const blockchain = process.env["CIRCLE_ENVIRONMENT"] === "production" ? "BASE" : "BASE-SEPOLIA";
  const provision = await provisionCircleWallet({
    idempotencyKey: `agent-${userId}-${normalized}`,
    blockchain:     blockchain as "BASE" | "BASE-SEPOLIA",
  });
  if (provision.status === "provisioned" && provision.wallet) {
    console.log(`[bot] Created Circle wallet ${provision.wallet.id} for user ${userId}`);
  } else if (provision.status === "failed") {
    console.error(`[bot] Circle wallet provisioning failed for user ${userId}: ${provision.reason}`);
  }

  const [created] = await db
    .insert(agents)
    .values({
      userId,
      walletAddress: normalized,
      name:          walletLabel,
      status:        "active",
      approvalMode:  "manual",
      policy:        agentPolicy,
      ...(provision.wallet ? { circleWalletId: provision.wallet.id } : {}),
    })
    .returning();
  if (!created) throw new Error(`Agent insert returned undefined for userId=${userId}`);
  console.log(`[bot] Agent created: ${created.id} for userId=${userId}`);
  return created;
}

async function promptPolicySetup(ctx: { reply: Function; chat?: { id: number } }, chatId: string) {
  const pending = getPendingPolicy(chatId);
  if (!pending?.jurisdiction) {
    await ctx.reply(
      "🌍 Choose your tax jurisdiction first:",
      { parse_mode: "Markdown", reply_markup: jurisdictionKeyboard() },
    );
    return;
  }
  if (pending.heartbeatIntervalMinutes == null) {
    await ctx.reply(
      "⏱ *How often should I scan your portfolio?*",
      { parse_mode: "Markdown", reply_markup: heartbeatKeyboard() },
    );
    return;
  }
  if (pending.harvestThresholdPct == null) {
    await ctx.reply(
      "🌾 *Harvest when unrealized loss exceeds:*",
      { parse_mode: "Markdown", reply_markup: harvestThresholdKeyboard() },
    );
    return;
  }
  if (pending.minHarvestLossUsd == null) {
    await ctx.reply(
      "💵 *Minimum loss (USD) before suggesting a harvest trade:*\n_Skip tiny trades below this amount._",
      { parse_mode: "Markdown", reply_markup: minLossKeyboard() },
    );
  }
}

bot.command("start", async (ctx) => {
  const chatId = String(ctx.chat.id);
  const user   = await getOrCreateUser(chatId);

  if (!user.jurisdiction) {
    await ctx.reply(
      "👋 Welcome to *taxee* — your AI tax-routing agent.\n\n" +
      "Step 1: pick your tax jurisdiction (US, UK, EU, Mexico, etc.).\n" +
      "Step 2: set scan rhythm + harvest rules.\n" +
      "Step 3: send your wallet (0x...).",
      { parse_mode: "Markdown", reply_markup: jurisdictionKeyboard() },
    );
    return;
  }

  if (!isPolicySetupComplete(chatId)) {
    setJurisdiction(chatId, normalizeJurisdiction(user.jurisdiction));
    await ctx.reply(
      `👋 Welcome back. Finish agent setup (${jurisdictionDisplay(user.jurisdiction)}):`,
      { parse_mode: "Markdown" },
    );
    await promptPolicySetup(ctx, chatId);
    return;
  }

  await ctx.reply(
    `👋 Welcome back to *taxee*.\n\n` +
    `🌍 ${jurisdictionDisplay(user.jurisdiction)}\n\n` +
    "Send a wallet (0x...) or use /policy to change scan rhythm & harvest rules.\n\n" +
    "Commands: /wallets · /opportunities · /status · /policy · /region · /mode",
    { parse_mode: "Markdown" },
  );
});

bot.command("region", async (ctx) => {
  const chatId = String(ctx.chat.id);
  await getOrCreateUser(chatId);
  clearPendingPolicy(chatId);
  await ctx.reply(
    "🌍 Choose your tax jurisdiction:",
    { parse_mode: "Markdown", reply_markup: jurisdictionKeyboard() },
  );
});

bot.command("policy", async (ctx) => {
  const chatId = String(ctx.chat.id);
  const [user] = await db.select().from(users).where(eq(users.telegramId, chatId));
  clearPendingPolicy(chatId);
  if (user?.jurisdiction) {
    setJurisdiction(chatId, normalizeJurisdiction(user.jurisdiction));
  }
  await ctx.reply("⚙️ Reconfigure your agent policy:", { parse_mode: "Markdown" });
  await promptPolicySetup(ctx, chatId);
});

bot.command("wallets", async (ctx) => {
  const chatId = String(ctx.chat.id);
  const [user] = await db.select().from(users).where(eq(users.telegramId, chatId));
  if (!user) {
    await ctx.reply("No wallets linked yet. Send a wallet address (0x...) to get started.");
    return;
  }

  const agentList = await db.select().from(agents).where(eq(agents.userId, user.id));
  if (agentList.length === 0) {
    await ctx.reply("No wallets linked. Send a wallet address (0x...) to add one.");
    return;
  }

  const oppCounts = await Promise.all(
    agentList.map(async (a) => {
      const opps = await db.select().from(opportunities).where(eq(opportunities.agentId, a.id));
      const pending = opps.filter((o) => !o.approvedAt && !o.executedAt && !o.deferredUntil);
      return { agent: a, pending: pending.length };
    })
  );

  const lines = oppCounts.map(({ agent: a, pending }, i) =>
    `${i + 1}. \`${a.walletAddress ?? "unknown"}\`\n` +
    `   _${a.name}_ · ${a.status} · ${a.approvalMode}\n` +
    `   ${pending > 0 ? `🔔 ${pending} pending action(s)` : "✅ No pending actions"}`
  ).join("\n\n");

  await ctx.reply(
    `👛 *Your Linked Wallets (${agentList.length})*\n\n${lines}\n\nSend another 0x... address to add a wallet.`,
    { parse_mode: "Markdown" }
  );
});

bot.command("status", async (ctx) => {
  const chatId = String(ctx.chat.id);
  const [user] = await db.select().from(users).where(eq(users.telegramId, chatId));
  if (!user) {
    await ctx.reply("No wallet linked yet. Send me a wallet address (0x...) to get started.");
    return;
  }

  const agentList = await db.select().from(agents).where(eq(agents.userId, user.id));
  if (agentList.length === 0) {
    await ctx.reply("No agents found. Send your wallet address to create one.");
    return;
  }

  const lines = agentList.map((a, i) =>
    `${i + 1}. \`${a.walletAddress ?? "unknown"}\` — *${a.name}* (${a.status} · ${a.approvalMode})`
  ).join("\n");

  await ctx.reply(
    `📊 *taxee Agent Status*\n\n${lines}\n\nUse /opportunities to see pending actions.`,
    { parse_mode: "Markdown" }
  );
});

bot.command("opportunities", async (ctx) => {
  const chatId = String(ctx.chat.id);
  const [user] = await db.select().from(users).where(eq(users.telegramId, chatId));
  if (!user) {
    await ctx.reply("No wallet linked yet. Send me a wallet address (0x...) to get started.");
    return;
  }

  const agentList = await db.select().from(agents).where(eq(agents.userId, user.id));
  if (agentList.length === 0) { await ctx.reply("No agents configured."); return; }

  const agentIds = agentList.map((a) => a.id);
  const allOpps  = await db
    .select()
    .from(opportunities)
    .where(inArray(opportunities.agentId, agentIds));

  const pending = allOpps.filter((o) => !o.approvedAt && !o.executedAt && !o.deferredUntil);

  if (pending.length === 0) {
    await ctx.reply("✅ No pending opportunities right now. I'll notify you when something comes up.");
    return;
  }

  const agentById = new Map(agentList.map((a) => [a.id, a]));

  for (const opp of pending.slice(0, 5)) {
    const agent   = agentById.get(opp.agentId);
    const wallet  = agent?.walletAddress ?? "unknown";
    const shortW  = `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;

    const icons: Record<string, string> = {
      HARVEST:   "🌾",
      PARK:      "🏦",
      REBALANCE: "⚖️",
      HOLD:      "⏸",
    };
    const icon    = icons[opp.type as string] ?? "🔔";
    const taxSave = parseFloat(opp.taxSavingEstimate ?? "0");

    const lines: string[] = [
      `${icon} *${opp.headline}*`,
      `_Wallet: ${shortW}_`,
      ``,
    ];

    if (opp.body) {
      lines.push(`🧠 *Claude's analysis:*`);
      lines.push(opp.body);
      lines.push(``);
    }

    if (opp.type === "HARVEST")  lines.push(`🔄 Sell at a loss → replace with correlated asset`, ``);
    if (opp.type === "PARK")     lines.push(`🏦 Park in USYC to earn yield while waiting for long-term treatment`, ``);
    if (opp.type === "REBALANCE") lines.push(`⚖️ Rebalance — tax cost weighed against drift risk`, ``);

    if (taxSave > 0) lines.push(`💰 *Est. tax saving: $${taxSave.toFixed(0)}*`);
    if (opp.deferDays) lines.push(`⏰ _Recommended deferral: ${opp.deferDays} days_`);

    const kb = new InlineKeyboard()
      .text("✅ Approve", `action:${opp.id}:approve`)
      .text("⏰ Defer",   `action:${opp.id}:defer`)
      .text("❌ Skip",    `action:${opp.id}:skip`);

    await ctx.reply(lines.join("\n"), { parse_mode: "Markdown", reply_markup: kb });
  }

  if (pending.length > 5) {
    await ctx.reply(`_${pending.length - 5} more opportunities — check back after actioning these._`, { parse_mode: "Markdown" });
  }
});

bot.command("mode", async (ctx) => {
  const chatId = String(ctx.chat.id);
  const arg = ctx.match?.trim().toLowerCase();
  if (arg !== "manual" && arg !== "delegated") {
    await ctx.reply("Usage: /mode manual  or  /mode delegated\n\nUpdates ALL your linked wallets.");
    return;
  }

  const [user] = await db.select().from(users).where(eq(users.telegramId, chatId));
  if (!user) { await ctx.reply("No wallet linked. Send your address first."); return; }

  const agentList = await db.select().from(agents).where(eq(agents.userId, user.id));
  if (agentList.length === 0) { await ctx.reply("No agents found."); return; }

  await Promise.all(
    agentList.map((a) => db.update(agents).set({ approvalMode: arg }).where(eq(agents.id, a.id)))
  );

  await ctx.reply(
    arg === "delegated"
      ? `🤖 Switched *all ${agentList.length} wallet(s)* to delegated — I'll execute autonomously and notify you after.`
      : `👤 Switched *all ${agentList.length} wallet(s)* to manual — I'll ask you to approve each action.`,
    { parse_mode: "Markdown" }
  );
});

bot.command("wallet", async (ctx) => {
  const chatId = String(ctx.chat.id);
  const [user] = await db.select().from(users).where(eq(users.telegramId, chatId));
  if (!user) { await ctx.reply("No account. Send /start first."); return; }

  const agentList = await db.select().from(agents).where(eq(agents.userId, user.id));
  const provisioned = agentList.filter((a) => a.circleWalletId);

  if (provisioned.length === 0) {
    await ctx.reply(
      "No Circle wallets provisioned yet.\n\n" +
      "Each linked DeFi wallet gets a Circle developer wallet on Base for autonomous execution. " +
      "Send a 0x... address to provision one, or check that CIRCLE_API_KEY / CIRCLE_ENTITY_SECRET / CIRCLE_WALLET_SET_ID are set on the backend."
    );
    return;
  }

  const apiKey       = process.env["CIRCLE_API_KEY"];
  const entitySecret = process.env["CIRCLE_ENTITY_SECRET"];
  if (!apiKey || !entitySecret) {
    await ctx.reply("Circle credentials missing on the backend — can't fetch balances.");
    return;
  }
  const circle = new CircleClient(
    apiKey,
    (process.env["CIRCLE_ENVIRONMENT"] ?? "sandbox") as "sandbox" | "production",
    entitySecret,
  );

  const blocks: string[] = [];
  for (const a of provisioned) {
    try {
      const wallet   = await circle.getWallet(a.circleWalletId!);
      const balances = await circle.getBalances(a.circleWalletId!);

      const lines = [
        `*${a.name}* _(${a.walletAddress?.slice(0, 6)}…${a.walletAddress?.slice(-4)})_`,
        `🔐 Circle wallet: \`${wallet.address}\` on ${wallet.blockchain}`,
      ];

      if (balances.length === 0) {
        lines.push(`💤 _Empty — no tokens held yet._`);
      } else {
        for (const b of balances) {
          const amt = parseFloat(b.amount);
          if (amt < 0.0001) continue;
          lines.push(`  • ${b.token.symbol}: ${amt.toFixed(b.token.symbol === "USDC" || b.token.symbol === "USYC" ? 2 : 6)}`);
        }
      }
      blocks.push(lines.join("\n"));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      blocks.push(`*${a.name}* — ⚠️ failed to fetch: ${msg}`);
    }
  }

  await ctx.reply(
    `💼 *Your Circle Wallets (${provisioned.length})*\n\n${blocks.join("\n\n")}`,
    { parse_mode: "Markdown" },
  );
});

bot.on("message:text", async (ctx) => {
  const text = ctx.message.text.trim();
  if (!ETH_ADDRESS.test(text)) return;

  const chatId    = String(ctx.chat.id);
  const normalized = text.toLowerCase();

  const user = await getOrCreateUser(chatId);
  if (!user.jurisdiction) {
    await ctx.reply(
      "Before linking a wallet, choose your tax jurisdiction:",
      { reply_markup: jurisdictionKeyboard() },
    );
    return;
  }
  if (!isPolicySetupComplete(chatId)) {
    setJurisdiction(chatId, normalizeJurisdiction(user.jurisdiction));
    await ctx.reply("Finish policy setup before linking a wallet:");
    await promptPolicySetup(ctx, chatId);
    return;
  }

  await ctx.reply("⏳ Linking wallet and setting up your agent...");

  try {

    const existingWallets = await db.select().from(wallets).where(eq(wallets.userId, user.id));
    const alreadyLinked   = existingWallets.find((w) => w.address === normalized);
    const walletNumber    = existingWallets.length + (alreadyLinked ? 0 : 1);
    const walletLabel     = alreadyLinked ? alreadyLinked.label : `Wallet ${walletNumber}`;

    if (!alreadyLinked) {
      await db.insert(wallets).values({ userId: user.id, address: normalized, label: walletLabel });
    }

    const agent = await getOrCreateAgentForWallet(
      user.id,
      normalized,
      chatId,
      walletLabel,
      user.jurisdiction,
    );
    const isNew = !alreadyLinked;

    await ctx.reply(
      `${isNew ? "✅ *New wallet added!*" : "✅ *Wallet already linked — refreshing...*"}\n\n` +
      `• Address: \`${normalized}\`\n` +
      `• Agent: *${agent.name}* (${agent.status})\n` +
      `• Mode: ${agent.approvalMode}\n` +
      `• Total wallets: ${walletNumber}\n\n` +
      `/wallets — see all linked wallets`,
      { parse_mode: "Markdown" }
    );

    if (isNew) {
      const apiKey    = process.env["CIRCLE_API_KEY"];
      const circleEnv = (process.env["CIRCLE_ENVIRONMENT"] ?? "sandbox") as "sandbox" | "production";
      const frontendUrl = process.env["FRONTEND_URL"] ?? "http://localhost:3000";

      if (apiKey) {
        try {
          const setupUrl = `${frontendUrl}/setup-wallet?userId=${encodeURIComponent(user.id)}`;
          await ctx.reply(
            "🔐 *One more step — set up your Circle PIN*\n\n" +
            "This secures your execution wallet. Nobody (not Circle, not Taxee) can execute transactions without your PIN.\n\n" +
            "Open this link to create your PIN (takes ~30 seconds):\n" +
            setupUrl,
            { parse_mode: "Markdown" }
          );
        } catch (err: any) {
          const detail = err?.response?.data ?? err?.message ?? String(err);
          console.error("[bot] Circle PIN setup failed:", JSON.stringify(detail));
          await ctx.reply(`⚠️ Circle PIN setup failed: ${JSON.stringify(detail)}\n\nYou can still use manual approval. Check backend logs.`);
        }
      }
    }

    const alchemyKey = process.env["ALCHEMY_API_KEY"];
    const geckoKey   = process.env["COINGECKO_API_KEY"];

    if (!alchemyKey) {
      await ctx.reply(
        "⚠️ *Portfolio scan disabled* — `ALCHEMY_API_KEY` is not set on the *telegram-bot* Railway service.\n\n" +
          "Railway → telegram-bot → Variables → add `ALCHEMY_API_KEY` (same value as API), then redeploy.\n\n" +
          "Optional: `COINGECKO_API_KEY` for prices.",
        { parse_mode: "Markdown" },
      );
      return;
    }

    // ── Step 1: live balances ──────────────────────────────────────────────────
    await ctx.reply(`🔍 Reading live balances for \`${normalized.slice(0, 8)}...\``, { parse_mode: "Markdown" });
    const positions = await fetchWalletPositions(normalized, alchemyKey, geckoKey);

    if (positions.length === 0) {
      await ctx.reply("📭 No token balances found on Ethereum / Base / Sepolia.");
    } else {
      const totalUsd = positions.reduce((s, p) => s + p.valueUsd, 0);
      const posLines = positions
        .sort((a, b) => b.valueUsd - a.valueUsd)
        .map((p) => {
          const val   = p.valueUsd > 0 ? ` — $${p.valueUsd.toFixed(2)}` : "";
          const price = p.priceUsd > 0 ? ` @ $${p.priceUsd.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : "";
          return `  • *${p.assetId}* ${parseFloat(p.balance.toFixed(6))}${price}${val} _(${p.chainLabel})_`;
        })
        .join("\n");

      await ctx.reply(
        `💼 *Portfolio: ${walletLabel}*\n\n${posLines}\n\n*Total: $${totalUsd.toFixed(2)}*\n\n⏳ Syncing tax lot history...`,
        { parse_mode: "Markdown" }
      );
    }

    // ── Step 2: import / refresh lots ─────────────────────────────────────────
    const [verifiedAgent] = await db.select({ id: agents.id }).from(agents).where(eq(agents.id, agent.id));
    if (!verifiedAgent) throw new Error(`Agent ${agent.id} not found in DB before lots insert`);

    const existing = await db
      .select({ txHash: lots.txHash })
      .from(lots)
      .where(eq(lots.agentId, agent.id));
    const existingHashes = new Set(
      existing.map((l) => l.txHash).filter(Boolean) as string[]
    );

    const imported = await importLotsForWallet(normalized, alchemyKey, geckoKey, existingHashes);

    if (imported.length > 0) {
      await db.insert(lots).values(
        imported.map((l) => ({
          agentId:      agent.id,
          assetId:      l.assetId,
          chainId:      l.chainId,
          quantity:     l.quantity,
          costBasisUsd: l.costBasisUsd,
          acquiredAt:   l.acquiredAt,
          status:       "open" as const,
          txHash:       l.txHash,
        }))
      );
    }

    const allLots = existing.length + imported.length;
    await ctx.reply(
      `📚 *${allLots} tax lots* for ${walletLabel}${imported.length > 0 ? ` (+${imported.length} new)` : " (up to date)"}\n\n` +
      `🧠 Running tax analysis — I'll message you with opportunities shortly...`,
      { parse_mode: "Markdown" }
    );

    // ── Step 3: run tax scan (harvest / park / rebalance) + notify via Telegram ─
    void runHeartbeat(agent.id)
      .then(async (result) => {
        console.log(
          `[bot] heartbeat agent=${agent.id} saved=${result.opportunitiesSaved} candidates=${result.candidatesFound} executed=${result.actionsExecuted}`,
        );
        if (result.opportunitiesSaved === 0) {
          await ctx.reply(
            "✅ *Tax analysis complete.*\n\n" +
              "No actionable opportunities right now — positions are roughly flat vs cost basis " +
              `(harvest needs ≥${Math.abs((agent.policy as { harvestThresholdPct?: number })?.harvestThresholdPct ?? 5)}% loss). ` +
              "I'll notify you on the next scan or try `/opportunities`.",
            { parse_mode: "Markdown" },
          );
        }
      })
      .catch(async (err) => {
        console.error("[bot] heartbeat failed:", err);
        await ctx.reply(
          "⚠️ Tax analysis failed. Check bot logs (`ANTHROPIC_API_KEY`, `COINGECKO_API_KEY`). Try sending your wallet again.",
        );
      });
  } catch (err) {
    console.error("[bot] wallet handler error:", err);
    await ctx.reply("❌ Failed to set up agent. Please try again.");
  }
});

bot.on("callback_query:data", async (ctx) => {
  const data = ctx.callbackQuery.data;
  const chatId = String(ctx.chat?.id ?? "");

  if (data.startsWith("region:")) {
    const code = normalizeJurisdiction(data.split(":")[1]);
    const user = await getOrCreateUser(chatId);
    await db.update(users).set({ jurisdiction: code }).where(eq(users.id, user.id));
    setJurisdiction(chatId, code);
    await ctx.editMessageReplyMarkup(undefined);
    await ctx.answerCallbackQuery({ text: jurisdictionDisplay(code) });
    await ctx.reply(
      `${jurisdictionDisplay(code)} selected.\n\n⏱ *How often should I scan your portfolio?*`,
      { parse_mode: "Markdown", reply_markup: heartbeatKeyboard() },
    );
    return;
  }

  if (data.startsWith("policy:heartbeat:")) {
    const mins = parseInt(data.split(":")[2] ?? "30", 10);
    setHeartbeat(chatId, mins);
    await ctx.editMessageReplyMarkup(undefined);
    await ctx.answerCallbackQuery({ text: `Every ${mins} min` });
    await ctx.reply(
      `⏱ Scan rhythm: *${mins} minutes*\n\n🌾 *Harvest when unrealized loss exceeds:*`,
      { parse_mode: "Markdown", reply_markup: harvestThresholdKeyboard() },
    );
    return;
  }

  if (data.startsWith("policy:harvest:")) {
    const pct = parseInt(data.split(":")[2] ?? "-8", 10);
    setHarvestThreshold(chatId, pct);
    await ctx.editMessageReplyMarkup(undefined);
    await ctx.answerCallbackQuery({ text: `${Math.abs(pct)}% threshold` });
    await ctx.reply(
      `🌾 Harvest threshold: *${Math.abs(pct)}% loss*\n\n💵 *Minimum USD loss before suggesting a harvest:*`,
      { parse_mode: "Markdown", reply_markup: minLossKeyboard() },
    );
    return;
  }

  if (data.startsWith("policy:minloss:")) {
    const usd = parseInt(data.split(":")[2] ?? "0", 10);
    setMinLoss(chatId, usd);
    await ctx.editMessageReplyMarkup(undefined);
    await ctx.answerCallbackQuery({ text: usd === 0 ? "Any size" : `≥ $${usd}` });
    const pending = getPendingPolicy(chatId)! as PendingAgentPolicy;
    await ctx.reply(formatPolicySummary(pending), { parse_mode: "Markdown" });
    return;
  }

  const [, oppId, action] = data.split(":");

  const [user] = await db.select().from(users).where(eq(users.telegramId, chatId));
  if (!user) { await ctx.answerCallbackQuery({ text: "Account not linked." }); return; }
  if (!oppId || !action) { await ctx.answerCallbackQuery({ text: "Invalid action." }); return; }

  try {
    const [opp] = await db.select().from(opportunities).where(eq(opportunities.id, oppId));
    if (!opp) { await ctx.answerCallbackQuery({ text: "Opportunity not found." }); return; }

    if (action === "approve") {
      const [agent] = await db.select().from(agents).where(eq(agents.id, opp.agentId));

      if (!agent?.circleWalletId) {
        await ctx.answerCallbackQuery({ text: "⚠️ No Circle wallet — can't execute" });
        await ctx.reply(
          "⚠️ This agent has no Circle wallet provisioned yet, so I can't execute on-chain.\n\n" +
          "Re-link the wallet (send the 0x... address again) and I'll create the Circle wallet during setup. " +
          "If that still fails, check the backend logs for the provisioning error.",
        );
        return;
      }
      if (!(opp as any).candidateAction) {
        await ctx.answerCallbackQuery({ text: "⚠️ Missing candidate snapshot — can't execute" });
        await ctx.reply("⚠️ This opportunity was created before execution snapshots existed. Skip or wait for a fresh one.");
        return;
      }

      await db.update(opportunities).set({ approvedAt: new Date() }).where(eq(opportunities.id, oppId));

      try {
        const apiUrl = process.env["API_URL"] ?? "http://localhost:3001";
        const frontendUrl = process.env["FRONTEND_URL"] ?? "http://localhost:3000";
        const jwtSecret   = process.env["JWT_SECRET"] ?? "dev-secret-change-me";

        const { data } = await axios.post(
          `${apiUrl}/circle/challenge/${oppId}`,
          {},
          { headers: { Authorization: `Bearer ${jwtSecret}` } }
        );

        const link = `${frontendUrl}/execute?userToken=${encodeURIComponent(data.userToken)}&encryptionKey=${encodeURIComponent(data.encryptionKey)}&challengeId=${encodeURIComponent(data.challengeId)}&oppId=${encodeURIComponent(oppId)}`;

        await ctx.reply(
          `🔐 *Confirm your tax action*\n\nOpen this link to authorise the transaction with your Circle PIN. Circle's MPC nodes co-sign — your key never leaves your device.\n\n${link}`,
          { parse_mode: "Markdown" }
        );
      } catch (err: unknown) {
        console.error(`[bot] Failed to create Circle challenge for ${oppId}:`, err);
        await ctx.reply("⚠️ Could not create execution challenge. Check backend logs.");
      }
    } else if (action === "defer") {
      const deferredUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await db.update(opportunities).set({ deferDays: 30, deferredUntil }).where(eq(opportunities.id, oppId));
    } else if (action === "skip") {
      await db.update(opportunities).set({ deferredUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }).where(eq(opportunities.id, oppId));
    }

    const labels: Record<string, string> = {
      approve: "✅ Approved — queued for execution",
      defer:   "⏳ Deferred 30 days",
      skip:    "❌ Skipped for 7 days",
    };

    await ctx.editMessageReplyMarkup(undefined);
    await ctx.answerCallbackQuery({ text: labels[action] ?? "Done" });
  } catch {
    await ctx.answerCallbackQuery({ text: "Error processing action." });
  }
});

bot.start({ onStart: () => console.log("[telegram-bot] Bot running at t.me/TaxesManager_bot") });
