import { Bot, InlineKeyboard } from "grammy";
import { eq, and, inArray } from "drizzle-orm";
import { runHeartbeat } from "@taxee/agent/heartbeat";
import {
  buildAgentPolicy,
  jurisdictionDisplay,
  normalizeJurisdiction,
  WALLET_CONNECTION_LABELS,
} from "@taxee/shared";
import type { JurisdictionCode, UserPolicy, WalletConnectionType } from "@taxee/shared";
import { db, users, wallets, agents, opportunities, lots } from "@taxee/db";
import {
  syncAgentLotsFromChain,
  fetchWalletPositions,
  fetchPrices,
  provisionCircleWallet,
  CircleClient,
} from "@taxee/aggregator";
import { buildWatchTxPlan, formatWatchTxPlanTelegram } from "@taxee/execution";
import type { CandidateAction } from "@taxee/shared";
import {
  formatScanDiagnosticsTelegram,
  formatCandidateOutcomesTelegram,
} from "@taxee/tax-engine";
import axios from "axios";
import {
  clearPendingPolicy,
  formatPolicySummary,
  walletTypeNextStep,
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
  setWalletConnectionType,
  walletTypeKeyboard,
  executionChainKeyboard,
  setExecutionChainId,
  walletConnectionHint,
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
): UserPolicy & { executionChainId?: number } {
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
  if (pending?.walletConnectionType) {
    overrides.walletConnectionType = pending.walletConnectionType;
  }
  const base = buildAgentPolicy(userJurisdiction, overrides);
  // agent.policy is jsonb — add executionChainId as a free-form field
  // (consumed by executeOpportunity via resolveExecutionChainId).
  return pending?.executionChainId != null
    ? { ...base, executionChainId: pending.executionChainId }
    : base;
}

async function getOrCreateAgentForWallet(
  userId: string,
  walletAddress: string,
  telegramChatId: string,
  walletLabel: string,
  userJurisdiction: string | null | undefined,
  walletConnectionType: WalletConnectionType,
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
          walletConnectionType,
        },
      })
      .where(eq(agents.id, existingAgent.id));
    return { ...existingAgent, policy: agentPolicy };
  }

  let circleWalletId: string | undefined;
  if (walletConnectionType === "circle") {
    const blockchain = process.env["CIRCLE_ENVIRONMENT"] === "production"
      ? "BASE"
      : (process.env["CIRCLE_WALLET_BLOCKCHAIN"] ?? "ARC-TESTNET");
    const provision = await provisionCircleWallet({
      idempotencyKey: `agent-${userId}-${normalized}`,
      blockchain:     blockchain as "ARC-TESTNET" | "BASE-SEPOLIA" | "BASE",
    });
    if (provision.status === "provisioned" && provision.wallet) {
      circleWalletId = provision.wallet.id;
      console.log(`[bot] Created Circle wallet ${provision.wallet.id} for user ${userId}`);
    } else if (provision.status === "failed") {
      console.error(`[bot] Circle wallet provisioning failed for user ${userId}: ${provision.reason}`);
    }
  }

  const [created] = await db
    .insert(agents)
    .values({
      userId,
      walletAddress: normalized,
      name:          walletLabel,
      status:        "active",
      approvalMode:  "manual",
      policy:        { ...agentPolicy, walletConnectionType },
      ...(circleWalletId ? { circleWalletId } : {}),
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
    return;
  }
  if (!pending.walletConnectionType) {
    await ctx.reply(
      "🔗 *How do you want to connect this wallet?*",
      { parse_mode: "Markdown", reply_markup: walletTypeKeyboard() },
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
      "Step 3: choose wallet type (watch / MetaMask+EIP-7702 / Circle).\n" +
      "Step 4: send your wallet (0x...).",
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
    "Commands: /wallets · /opportunities · /status · /policy · /wallettype · /region · /mode",
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

bot.command("wallettype", async (ctx) => {
  const chatId = String(ctx.chat.id);
  await getOrCreateUser(chatId);
  await ctx.reply(
    "🔗 *Choose how you want to connect your next wallet:*\n\n" +
      "• *Watch* — alerts only, you trade manually\n" +
      "• *MetaMask / EIP-7702* — your wallet, sign delegation in the app\n" +
      "• *Circle* — hosted wallet + PIN",
    { parse_mode: "Markdown", reply_markup: walletTypeKeyboard() },
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

  const lines = oppCounts.map(({ agent: a, pending }, i) => {
    const conn = (a.policy as { walletConnectionType?: WalletConnectionType } | undefined)
      ?.walletConnectionType;
    const connLabel = conn ? WALLET_CONNECTION_LABELS[conn] : "not set";
    return (
      `${i + 1}. \`${a.walletAddress ?? "unknown"}\`\n` +
      `   _${a.name}_ · ${connLabel} · ${a.status} · ${a.approvalMode}\n` +
      `   ${pending > 0 ? `🔔 ${pending} pending action(s)` : "✅ No pending actions"}`
    );
  }).join("\n\n");

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

/**
 * Pick which testnet to execute on. Stored on every agent's policy.executionChainId.
 * Limited to two for now — extend SUPPORTED_EXECUTION_CHAINS to add more.
 */
bot.command("chain", async (ctx) => {
  const chatId = String(ctx.chat.id);
  const arg    = ctx.match?.trim().toLowerCase();

  const SHORT_TO_ID: Record<string, { id: number; name: string }> = {
    base:    { id: 84532,    name: "Base Sepolia"     },
    sepolia: { id: 11155111, name: "Ethereum Sepolia" },
  };

  const [user] = await db.select().from(users).where(eq(users.telegramId, chatId));
  if (!user) { await ctx.reply("No wallet linked. Send your address first."); return; }

  const agentList = await db.select().from(agents).where(eq(agents.userId, user.id));

  if (!arg || !SHORT_TO_ID[arg]) {
    const current = agentList.length > 0
      ? (() => {
          const cid = (agentList[0]!.policy as { executionChainId?: number } | null)?.executionChainId;
          if (cid === 11155111) return "Ethereum Sepolia";
          if (cid === 84532)    return "Base Sepolia";
          return "Base Sepolia _(default)_";
        })()
      : "_no agents yet_";
    await ctx.reply(
      `Usage: \`/chain base\` or \`/chain sepolia\`\n\n` +
      `Current: *${current}*\n\n` +
      `• *base* — Base Sepolia (84532)\n` +
      `• *sepolia* — Ethereum Sepolia (11155111)`,
      { parse_mode: "Markdown" },
    );
    return;
  }

  if (agentList.length === 0) { await ctx.reply("No agents found. Send your address first."); return; }

  const target = SHORT_TO_ID[arg]!;
  await Promise.all(
    agentList.map((a) => {
      const nextPolicy = { ...(a.policy as Record<string, unknown>), executionChainId: target.id };
      return db.update(agents).set({ policy: nextPolicy as any }).where(eq(agents.id, a.id));
    }),
  );

  await ctx.reply(
    `🔗 Execution chain set to *${target.name}* for all ${agentList.length} agent(s).\n\n` +
    `Next Approve will execute on ${target.name}. Make sure your wallet has funds + delegation there.`,
    { parse_mode: "Markdown" },
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

    const pending = getPendingPolicy(chatId) as PendingAgentPolicy | undefined;
    const [priorAgent] = await db
      .select({ policy: agents.policy })
      .from(agents)
      .where(and(eq(agents.userId, user.id), eq(agents.walletAddress, normalized)))
      .limit(1);
    const walletConnectionType: WalletConnectionType =
      pending?.walletConnectionType ??
      (priorAgent?.policy as { walletConnectionType?: WalletConnectionType } | undefined)
        ?.walletConnectionType ??
      "external_eip7702";

    const agent = await getOrCreateAgentForWallet(
      user.id,
      normalized,
      chatId,
      walletLabel,
      user.jurisdiction,
      walletConnectionType,
    );
    const isNew = !alreadyLinked;
    const connLabel = WALLET_CONNECTION_LABELS[walletConnectionType];

    await ctx.reply(
      `${isNew ? "✅ *New wallet added!*" : "✅ *Wallet already linked — refreshing...*"}\n\n` +
      `• Address: \`${normalized}\`\n` +
      `• Agent: *${agent.name}* (${agent.status})\n` +
      `• Connection: *${connLabel}*\n` +
      `• Approval: ${agent.approvalMode}\n` +
      `• Total wallets: ${walletNumber}\n\n` +
      `/wallets — see all linked wallets`,
      { parse_mode: "Markdown" }
    );

    const hint = walletConnectionHint(walletConnectionType);
    if (hint) {
      await ctx.reply(hint, { parse_mode: "Markdown" });
    }
    const nextStep = walletTypeNextStep(walletConnectionType, user.id);
    if (nextStep) {
      await ctx.reply(nextStep, { parse_mode: "Markdown", link_preview_options: { is_disabled: true } });
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

    const sync = await syncAgentLotsFromChain(agent.id, normalized, alchemyKey, geckoKey, {
      selectOpenLots: async (id) =>
        db.select().from(lots).where(and(eq(lots.agentId, id), eq(lots.status, "open"))),
      insertLots: async (rows) => {
        await db.insert(lots).values(rows);
      },
      closeLot: async (lotId) => {
        await db.update(lots).set({ status: "closed" }).where(eq(lots.id, lotId));
      },
      updateLotBasis: async (lotId, costBasisUsd) => {
        await db.update(lots).set({ costBasisUsd }).where(eq(lots.id, lotId));
      },
    });

    const openCount = await db
      .select({ id: lots.id })
      .from(lots)
      .where(and(eq(lots.agentId, agent.id), eq(lots.status, "open")));
    const syncParts = [
      sync.inserted > 0 ? `+${sync.inserted} new` : null,
      sync.closed > 0 ? `${sync.closed} stale closed` : null,
      sync.basisRefreshed > 0 ? `${sync.basisRefreshed} basis updated` : null,
    ].filter(Boolean);
    const syncNote = syncParts.length > 0 ? ` (${syncParts.join(", ")})` : " (matches chain)";

    await ctx.reply(
      `📚 *${openCount.length} open tax lots* for ${walletLabel}${syncNote}\n` +
        `_On-chain acquisitions: ${sync.openOnChain}_\n\n` +
        `🧠 Running tax analysis — I'll message you with opportunities shortly...`,
      { parse_mode: "Markdown" },
    );

    // ── Step 3: run tax scan (harvest / park / rebalance) + notify via Telegram ─
    void runHeartbeat(agent.id, { skipLotSync: true, notificationChatId: chatId })
      .then(async (result) => {
        console.log(
          `[bot] heartbeat agent=${agent.id} saved=${result.opportunitiesSaved} candidates=${result.candidatesFound} executed=${result.actionsExecuted}`,
        );
        if (result.opportunitiesSaved > 0) {
          await ctx.reply(
            `✅ *${result.opportunitiesSaved} opportunity(ies)* ready — see the message(s) above with *Approve / Defer / Skip* buttons.`,
            { parse_mode: "Markdown" },
          );
          return;
        }

        let body = formatScanDiagnosticsTelegram(result.scanDiagnostics);
        body += formatCandidateOutcomesTelegram(result.candidateOutcomes);
        if (sync.closed > 0 || sync.inserted > 0) {
          body +=
            `\n\n🔄 *Lot sync:* +${sync.inserted} new, ${sync.closed} removed from chain.`;
        }
        try {
          await ctx.reply(body, { parse_mode: "Markdown" });
        } catch (replyErr) {
          console.error("[bot] diagnostics reply failed (Markdown):", replyErr);
          await ctx.reply(body.replace(/\*/g, ""));
        }
      })
      .catch(async (err) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[bot] heartbeat failed:", err);
        const hint =
          /anthropic|api key|401|403/i.test(msg)
            ? "Check `ANTHROPIC_API_KEY` on the telegram-bot service."
            : /database|ECONNREFUSED|postgres/i.test(msg)
              ? "Check `DATABASE_URL` on the telegram-bot service."
              : /coingecko|429/i.test(msg)
                ? "CoinGecko rate limit — retry in a minute."
                : "See telegram-bot logs for the full error.";
        await ctx.reply(
          `⚠️ Tax analysis failed.\n\n${msg.slice(0, 280)}\n\n${hint}`,
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
    await ctx.reply(
      "🔗 *How do you want to connect your wallet?*",
      { parse_mode: "Markdown", reply_markup: walletTypeKeyboard() },
    );
    return;
  }

  if (data.startsWith("wallet:type:")) {
    const type = data.split(":")[2] as WalletConnectionType;
    if (type !== "watch" && type !== "external_eip7702" && type !== "circle") {
      await ctx.answerCallbackQuery({ text: "Unknown wallet type" });
      return;
    }
    setWalletConnectionType(chatId, type);
    await ctx.editMessageReplyMarkup(undefined);
    await ctx.answerCallbackQuery({ text: WALLET_CONNECTION_LABELS[type] });
    await ctx.reply(
      "⛓ *Which testnet chain do you want to execute on?*\n\n" +
      "Pick the chain where your funds + delegation live. You can switch later with /chain.",
      { parse_mode: "Markdown", reply_markup: executionChainKeyboard() },
    );
    return;
  }

  if (data.startsWith("policy:chain:")) {
    const chainId = parseInt(data.split(":")[2] ?? "0", 10);
    if (chainId !== 84532 && chainId !== 11155111) {
      await ctx.answerCallbackQuery({ text: "Unsupported chain" });
      return;
    }
    setExecutionChainId(chatId, chainId);
    await ctx.editMessageReplyMarkup(undefined);
    await ctx.answerCallbackQuery({
      text: chainId === 84532 ? "🟦 Base Sepolia" : "⟠ Ethereum Sepolia",
    });
    const pending = getPendingPolicy(chatId)! as PendingAgentPolicy;
    const [user] = await db.select().from(users).where(eq(users.telegramId, chatId));
    await ctx.reply(formatPolicySummary(pending, user?.id), {
      parse_mode: "Markdown",
      link_preview_options: { is_disabled: true },
    });
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
      const connType = (agent?.policy as { walletConnectionType?: WalletConnectionType } | undefined)
        ?.walletConnectionType;
      const frontendUrl = process.env["FRONTEND_URL"] ?? "http://localhost:3000";

      if (connType === "watch") {
        const candidate = (opp as { candidateAction?: CandidateAction }).candidateAction;
        if (!candidate || !agent?.walletAddress) {
          await ctx.answerCallbackQuery({ text: "Missing trade details" });
          await ctx.reply("⚠️ No transaction snapshot for this opportunity. Wait for a fresh scan.");
          return;
        }
        const assetIds = [...new Set(candidate.lots.map((l) => l.assetId))];
        const prices =
          assetIds.length > 0
            ? await fetchPrices(assetIds, process.env["COINGECKO_API_KEY"])
            : {};
        const plan = buildWatchTxPlan(candidate, prices, {
          walletAddress: agent.walletAddress,
          openInAppUrl: `${frontendUrl}/watch?oppId=${encodeURIComponent(oppId)}&wallet=${encodeURIComponent(agent.walletAddress)}`,
        });
        await db.update(opportunities).set({ approvedAt: new Date() }).where(eq(opportunities.id, oppId));
        await ctx.answerCallbackQuery({ text: "Tx steps ready" });
        if (plan) {
          const kb = plan.openInAppUrl
            ? new InlineKeyboard().url("🌐 Open in taxee app", plan.openInAppUrl)
            : undefined;
          await ctx.reply(formatWatchTxPlanTelegram(plan), {
            parse_mode: "Markdown",
            ...(kb ? { reply_markup: kb } : {}),
          });
        } else {
          await ctx.reply(
            "👀 Watch mode — execute the harvest in your wallet using the amounts in the opportunity message above.",
            { parse_mode: "Markdown" },
          );
        }
        return;
      }
      if (connType === "external_eip7702") {
        if (!(opp as { candidateAction?: unknown }).candidateAction) {
          await ctx.answerCallbackQuery({ text: "Missing snapshot" });
          await ctx.reply("⚠️ Wait for a fresh scan opportunity.");
          return;
        }
        const apiUrl = process.env["API_URL"] ?? "http://localhost:3001";
        try {
          await axios.post(`${apiUrl}/circle/opportunities/${oppId}/approve`, {
            userId: user.id,
            preferredExecution: "eip7702",
          });
          await ctx.answerCallbackQuery({ text: "Executing via EIP-7702" });
          await ctx.editMessageReplyMarkup(undefined);
          await ctx.reply(
            "✅ *Approved* — executing on Base Sepolia via your delegation.\n" +
              "_Tx hash will appear when the on-chain step completes._",
            { parse_mode: "Markdown" },
          );
        } catch (err: unknown) {
          console.error(`[bot] EIP-7702 approve failed for ${oppId}:`, err);
          await ctx.answerCallbackQuery({ text: "Execution failed" });
          await ctx.reply(
            `⚠️ Could not start execution. ${walletTypeNextStep("external_eip7702", user.id)}`,
            { parse_mode: "Markdown", link_preview_options: { is_disabled: true } },
          );
        }
        return;
      }
      if (connType === "circle" && !agent?.circleWalletId) {
        await ctx.answerCallbackQuery({ text: "Circle setup required" });
        await ctx.reply(
          `🔵 Finish Circle wallet + PIN setup first.\n\n${walletTypeNextStep("circle", user.id)}`,
          { parse_mode: "Markdown", link_preview_options: { is_disabled: true } },
        );
        return;
      }
      if (!agent?.circleWalletId) {
        await ctx.answerCallbackQuery({ text: "No execution wallet" });
        await ctx.reply(
          "⚠️ No execution wallet linked. Re-run setup with /wallettype and send your address again.",
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

        const executeUrl =
          `${frontendUrl}/execute?userToken=${encodeURIComponent(data.userToken)}` +
          `&encryptionKey=${encodeURIComponent(data.encryptionKey)}` +
          `&challengeId=${encodeURIComponent(data.challengeId)}` +
          `&oppId=${encodeURIComponent(oppId)}`;

        const execKb = new InlineKeyboard().webApp("🔐 Confirm with PIN", executeUrl);

        await ctx.reply(
          "🔐 *Confirm your tax action*\n\nTap below to authorise with your Circle PIN (inside Telegram).",
          { parse_mode: "Markdown", reply_markup: execKb },
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

/** User closed a Telegram Mini App and sent payload back to the bot */
bot.on("message:web_app_data", async (ctx) => {
  const raw = ctx.message.web_app_data?.data;
  if (!raw) return;

  let payload: { type?: string };
  try {
    payload = JSON.parse(raw) as { type?: string };
  } catch {
    await ctx.reply("⚠️ Could not read app response. Try again from the button.");
    return;
  }

  switch (payload.type) {
    case "delegation_complete":
      await ctx.reply(
        "✅ *Delegation signed* — you’re back in Telegram.\n\n" +
          "Approve opportunities here; execution uses your EIP-7702 policy on-chain.",
        { parse_mode: "Markdown" },
      );
      break;
    case "circle_setup_complete":
      await ctx.reply(
        "✅ *Circle wallet ready* — PIN set.\n\n" +
          "Send your Circle wallet `0x...` if you haven’t, or wait for the next scan.",
        { parse_mode: "Markdown" },
      );
      break;
    case "circle_execute_complete":
      await ctx.reply(
        "✅ *Transaction submitted* — back in Telegram.\n\n" +
          "_Check /opportunities or wait for the execution receipt._",
        { parse_mode: "Markdown" },
      );
      break;
    default:
      await ctx.reply("✅ Setup step completed.");
  }
});

// Global error handler — without this, any thrown error from a handler crashes
// the entire bot process (grammY's default behavior). Log + answer the callback
// query (so the user's tap UI doesn't spin forever) and keep running.
bot.catch(async (err) => {
  console.error("[telegram-bot] uncaught handler error:", err);
  try {
    if (err.ctx?.callbackQuery) {
      await err.ctx.answerCallbackQuery({ text: "Something went wrong — try again." });
    }
  } catch {
    // Best-effort recovery; ignore if even the callback ack fails.
  }
});

bot.start({ onStart: () => console.log("[telegram-bot] Bot running at t.me/TaxesManager_bot") });
