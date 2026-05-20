import type { OpportunityNotification, ActionReceipt, NotificationChannel } from "@taxee/shared";
import axios from "axios";

/**
 * Send an opportunity notification to the user's configured channels.
 * Used for both manual approval requests and delegated execution receipts.
 *
 * Currently supported: Telegram (via Bot API), webhook.
 * Email TBD post-MVP.
 */
export async function sendOpportunityNotification(
  notification: OpportunityNotification,
  channels: NotificationChannel[]
): Promise<void> {
  await Promise.allSettled(
    channels.map((channel) => {
      switch (channel.type) {
        case "telegram":
          return sendTelegramOpportunity(notification, channel.chatId!);
        case "webhook":
          return sendWebhook(notification, channel.webhookUrl!);
        default:
          return Promise.resolve();
      }
    })
  );
}

export async function sendActionReceipt(
  receipt: ActionReceipt,
  channels: NotificationChannel[]
): Promise<void> {
  await Promise.allSettled(
    channels.map((channel) => {
      switch (channel.type) {
        case "telegram":
          return sendTelegramReceipt(receipt, channel.chatId!);
        case "webhook":
          return sendWebhook(receipt, channel.webhookUrl!);
        default:
          return Promise.resolve();
      }
    })
  );
}

async function sendTelegramOpportunity(
  n: OpportunityNotification,
  chatId: string
): Promise<void> {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN not set");

  const modeNote =
    n.approvalMode === "delegated" && n.autoExecuteAt
      ? `\n⏱ Auto-executes at ${n.autoExecuteAt.toISOString()} unless you defer`
      : "";

  const text = [
    `🔔 *taxee opportunity*`,
    ``,
    `${n.headline}`,
    ``,
    `💰 Est. tax saving: *$${n.taxSavingEstimate.toFixed(0)}*`,
    `📋 Reasoning: ${n.llmReasoning}`,
    modeNote,
    ``,
    `[View on dashboard](${n.dashboardUrl})`,
  ]
    .filter((l) => l !== undefined)
    .join("\n");

  const inlineKeyboard =
    n.approvalMode === "manual" && n.buttons
      ? {
          inline_keyboard: [
            n.buttons.map((btn: string) => ({
              text:          btn.charAt(0).toUpperCase() + btn.slice(1),
              callback_data: `action:${n.actionId}:${btn}`,
            })),
          ],
        }
      : undefined;

  await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
    chat_id:    chatId,
    text,
    parse_mode: "Markdown",
    ...(inlineKeyboard ? { reply_markup: inlineKeyboard } : {}),
  });
}

async function sendTelegramReceipt(receipt: ActionReceipt, chatId: string): Promise<void> {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN not set");

  const text = [
    `✅ *taxee executed*`,
    ``,
    `${receipt.headline}`,
    ``,
    `💰 Tax saved: *$${receipt.taxSavingActual.toFixed(0)}*`,
    receipt.txHash ? `🔗 Tx: \`${receipt.txHash}\`` : null,
    `📝 Arc record: \`${receipt.arcRecordId}\``,
    ``,
    `[View on dashboard](${receipt.dashboardUrl})`,
  ]
    .filter(Boolean)
    .join("\n");

  await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
    chat_id:    chatId,
    text,
    parse_mode: "Markdown",
  });
}

async function sendWebhook(payload: unknown, webhookUrl: string): Promise<void> {
  await axios.post(webhookUrl, payload, {
    headers: { "Content-Type": "application/json" },
    timeout: 5000,
  });
}
