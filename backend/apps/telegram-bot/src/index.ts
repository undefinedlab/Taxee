import { Bot, InlineKeyboard } from "grammy";
import { eq, and, inArray } from "drizzle-orm";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { db, users, wallets, agents, opportunities, lots } from "@taxee/db";
import { importLotsForWallet, fetchWalletPositions } from "@taxee/aggregator";

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_DIR = path.resolve(__dirname, "../../..");

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

async function getOrCreateAgentForWallet(
  userId: string,
  walletAddress: string,
  telegramChatId: string,
  walletLabel: string,
) {
  const normalized = walletAddress.toLowerCase();

  const [existingAgent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.userId, userId), eq(agents.walletAddress, normalized)));

  if (existingAgent) {
    const policy = existingAgent.policy as Record<string, unknown>;
    if (!policy["telegramChatId"]) {
      await db.update(agents)
        .set({ policy: { ...policy, telegramChatId } })
        .where(eq(agents.id, existingAgent.id));
    }
    return existingAgent;
  }

  const defaultPolicy = {
    primaryObjective:        "minimize_tax",
    harvestThresholdPct:     -8,
    maturationBufferDays:    30,
    rebalanceAggressiveness: "moderate",
    allowedActions:          ["HARVEST", "PARK", "REBALANCE"],
    jurisdiction:            "US",
    telegramChatId,
  };
  const [created] = await db
    .insert(agents)
    .values({
      userId,
      walletAddress: normalized,
      name:          walletLabel,
      status:        "active",
      approvalMode:  "manual",
      policy:        defaultPolicy,
    })
    .returning();
  return created!;
}

bot.command("start", async (ctx) => {
  await ctx.reply(
    "👋 Welcome to *taxee* — your AI tax-routing agent.\n\n" +
    "I watch your DeFi portfolio for tax-smart opportunities: loss harvesting, maturation parking, rebalancing.\n\n" +
    "Send me a wallet address (0x...) to start — you can add multiple wallets.\n\n" +
    "Commands:\n" +
    "/wallets — list all linked wallets\n" +
    "/opportunities — pending actions across all wallets\n" +
    "/status — agent overview\n" +
    "/mode manual|delegated — approval mode",
    { parse_mode: "Markdown" }
  );
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

bot.on("message:text", async (ctx) => {
  const text = ctx.message.text.trim();
  if (!ETH_ADDRESS.test(text)) return;

  const chatId    = String(ctx.chat.id);
  const normalized = text.toLowerCase();
  await ctx.reply("⏳ Linking wallet and setting up your agent...");

  try {
    const user = await getOrCreateUser(chatId);

    const existingWallets = await db.select().from(wallets).where(eq(wallets.userId, user.id));
    const alreadyLinked   = existingWallets.find((w) => w.address === normalized);
    const walletNumber    = existingWallets.length + (alreadyLinked ? 0 : 1);
    const walletLabel     = alreadyLinked ? alreadyLinked.label : `Wallet ${walletNumber}`;

    if (!alreadyLinked) {
      await db.insert(wallets).values({ userId: user.id, address: normalized, label: walletLabel });
    }

    const agent = await getOrCreateAgentForWallet(user.id, normalized, chatId, walletLabel);
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

    const alchemyKey = process.env["ALCHEMY_API_KEY"];
    const geckoKey   = process.env["COINGECKO_API_KEY"];

    if (!alchemyKey) {
      await ctx.reply("⚠️ Add ALCHEMY_API_KEY to .env to enable real portfolio scanning.");
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

    // ── Step 3: trigger heartbeat in background → sends Telegram notifs ───────
    const trigger = spawn(
      "pnpm",
      ["--filter", "@taxee/agent", "dev:trigger"],
      { cwd: BACKEND_DIR, env: process.env, stdio: "pipe" }
    );
    trigger.on("error", (err) => console.error("[bot] heartbeat spawn error:", err));
    trigger.on("close", (code) => console.log(`[bot] heartbeat exited ${code}`));
  } catch (err) {
    console.error("[bot] wallet handler error:", err);
    await ctx.reply("❌ Failed to set up agent. Please try again.");
  }
});

bot.on("callback_query:data", async (ctx) => {
  const data = ctx.callbackQuery.data;
  const [, oppId, action] = data.split(":");
  const chatId = String(ctx.chat?.id ?? "");

  const [user] = await db.select().from(users).where(eq(users.telegramId, chatId));
  if (!user) { await ctx.answerCallbackQuery({ text: "Account not linked." }); return; }
  if (!oppId || !action) { await ctx.answerCallbackQuery({ text: "Invalid action." }); return; }

  try {
    const [opp] = await db.select().from(opportunities).where(eq(opportunities.id, oppId));
    if (!opp) { await ctx.answerCallbackQuery({ text: "Opportunity not found." }); return; }

    if (action === "approve") {
      await db.update(opportunities).set({ approvedAt: new Date() }).where(eq(opportunities.id, oppId));
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
