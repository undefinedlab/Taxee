import { Bot, InlineKeyboard } from "grammy";
import { eq } from "drizzle-orm";
import { db, users, agents, opportunities } from "@taxee/db";
import axios from "axios";

const token = process.env["TELEGRAM_BOT_TOKEN"];
if (!token) throw new Error("TELEGRAM_BOT_TOKEN is required");

const bot  = new Bot(token);
const API  = process.env["API_URL"] ?? "http://localhost:3001";

bot.command("start", async (ctx) => {
  await ctx.reply(
    "👋 Welcome to *taxee* — your AI tax-routing agent.\n\n" +
    "Connect your wallet at the dashboard to get started, then link your Telegram account:\n\n" +
    `/link <your_jwt_token>`,
    { parse_mode: "Markdown" }
  );
});

bot.command("link", async (ctx) => {
  const jwt = ctx.match?.trim();
  if (!jwt) { await ctx.reply("Usage: /link <jwt_token>"); return; }

  try {
    await axios.post(
      `${API}/auth/telegram/link`,
      { telegramChatId: String(ctx.chat.id), telegramUserId: String(ctx.from?.id ?? "") },
      { headers: { Authorization: `Bearer ${jwt}` } }
    );
    await ctx.reply("✅ Telegram account linked to your taxee agent.");
  } catch {
    await ctx.reply("❌ Failed to link account. Make sure your JWT token is valid.");
  }
});

bot.command("status", async (ctx) => {
  const chatId = String(ctx.chat.id);
  const [user] = await db.select().from(users).where(eq(users.telegramId, chatId));
  if (!user) { await ctx.reply("No taxee account linked. Use /link <jwt_token>."); return; }

  const agentList = await db
    .select()
    .from(agents)
    .where(eq(agents.userId, user.id));

  if (agentList.length === 0) { await ctx.reply("No agents found. Create one on the dashboard."); return; }

  const lines = agentList.map(
    (a) => `• *${a.name}* (${a.status}) — mode: ${a.approvalMode}`
  );
  await ctx.reply(`📊 Your agents:\n\n${lines.join("\n")}`, { parse_mode: "Markdown" });
});

bot.command("opportunities", async (ctx) => {
  const chatId = String(ctx.chat.id);
  const [user] = await db.select().from(users).where(eq(users.telegramId, chatId));
  if (!user) { await ctx.reply("No taxee account linked. Use /link <jwt_token>."); return; }

  const agentList = await db
    .select({ id: agents.id })
    .from(agents)
    .where(eq(agents.userId, user.id));

  if (agentList.length === 0) { await ctx.reply("No agents configured."); return; }

  const firstAgent = agentList[0];
  if (!firstAgent) { await ctx.reply("No agents configured."); return; }

  const opps = await db
    .select()
    .from(opportunities)
    .where(eq(opportunities.agentId, firstAgent.id));

  const pending = opps.filter((o) => !o.approvedAt && !o.executedAt && !o.deferredUntil);

  if (pending.length === 0) { await ctx.reply("No pending opportunities right now."); return; }

  for (const opp of pending.slice(0, 3)) {
    const kb = new InlineKeyboard()
      .text("✅ Approve", `action:${opp.id}:approve`)
      .text("⏳ Defer",   `action:${opp.id}:defer`)
      .text("❌ Skip",    `action:${opp.id}:skip`);

    await ctx.reply(
      `🔔 *${opp.headline}*\n\n${opp.body}\n\n💰 Est. tax saving: *$${parseFloat(opp.taxSavingEstimate ?? "0").toFixed(0)}*`,
      { parse_mode: "Markdown", reply_markup: kb }
    );
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
    const agentList = await db
      .select({ id: agents.id })
      .from(agents)
      .where(eq(agents.userId, user.id));

    const firstAgent = agentList[0];
    if (!firstAgent) { await ctx.answerCallbackQuery({ text: "No agent found." }); return; }

    await axios.post(
      `${API}/actions/${oppId}/${action}`,
      {},
      { headers: { "x-agent-id": firstAgent.id } }
    );

    const labels: Record<string, string> = {
      approve: "✅ Approved for execution",
      defer:   "⏳ Deferred 30 days",
      skip:    "❌ Skipped",
    };

    await ctx.editMessageReplyMarkup(undefined);
    await ctx.answerCallbackQuery({ text: labels[action] ?? "Done" });
  } catch {
    await ctx.answerCallbackQuery({ text: "Error processing action." });
  }
});

await bot.start();
console.log("[telegram-bot] Bot running");
