#!/usr/bin/env node
/**
 * Check Telegram bot token + polling vs webhook.
 * Usage: TELEGRAM_BOT_TOKEN=... node scripts/check-telegram-bot.mjs
 */

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("Set TELEGRAM_BOT_TOKEN (from @BotFather for @TaxesManager_bot)");
  process.exit(1);
}

const base = `https://api.telegram.org/bot${token}`;

async function tg(method) {
  const res = await fetch(`${base}/${method}`);
  const data = await res.json();
  return data;
}

const me = await tg("getMe");
if (!me.ok) {
  console.error("getMe failed:", me.description);
  process.exit(1);
}
console.log("Bot:", `@${me.result.username}`, `(${me.result.first_name})`, "id:", me.result.id);

const wh = await tg("getWebhookInfo");
console.log("Webhook URL:", wh.result.url || "(none — polling OK)");
if (wh.result.url) {
  console.warn(
    "WARNING: A webhook is set. This bot uses long polling (grammy bot.start()).",
    "Delete webhook: curl \"https://api.telegram.org/bot<TOKEN>/deleteWebhook\"",
  );
}

const updates = await tg("getUpdates?limit=1");
console.log("Pending updates:", updates.result?.length ?? 0);
console.log("\nIf Railway bot service is running with this token, /start should reply within seconds.");
