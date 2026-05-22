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

function buildOpportunityText(n: OpportunityNotification): string {
  const lines: string[] = [];

  // ── Header ────────────────────────────────────────────────────────────────
  const icons: Record<string, string> = {
    HARVEST:   "🌾",
    PARK:      "🏦",
    REBALANCE: "⚖️",
    ROTATE:    "🔄",
  };
  const icon = icons[n.type] ?? "🔔";
  lines.push(`${icon} *${n.headline}*`);

  if (n.walletLabel || n.walletAddress) {
    const short = n.walletAddress
      ? `\`${n.walletAddress.slice(0, 6)}…${n.walletAddress.slice(-4)}\``
      : "";
    const label = n.walletLabel ? `*${n.walletLabel}*` : "";
    const sep   = label && short ? " — " : "";
    lines.push(`_Wallet: ${label}${sep}${short}_`);
  }

  lines.push(``);

  // ── Position snapshot ─────────────────────────────────────────────────────
  if (n.assetSymbol) {
    lines.push(`📊 *Position*`);
    if (n.quantity !== undefined && n.costBasisUsd !== undefined) {
      const costPerUnit = n.quantity > 0 ? n.costBasisUsd / n.quantity : 0;
      lines.push(`  • ${n.quantity.toFixed(6)} ${n.assetSymbol} · cost basis $${n.costBasisUsd.toFixed(2)} @ $${costPerUnit.toFixed(2)}`);
    }
    if (n.currentValueUsd !== undefined && n.unrealizedPct !== undefined) {
      const sign  = n.unrealizedPct >= 0 ? "+" : "";
      const emoji = n.unrealizedPct >= 0 ? "📈" : "📉";
      lines.push(`  ${emoji} Current value $${n.currentValueUsd.toFixed(2)} (${sign}${n.unrealizedPct.toFixed(1)}%)`);
    }
    if (n.daysHeld !== undefined) {
      const ltStatus = n.daysHeld >= 365 ? "✅ long-term" : `⏳ ${365 - n.daysHeld}d to long-term`;
      lines.push(`  📅 Held ${n.daysHeld} days · ${ltStatus}`);
    }
    lines.push(``);
  }

  // ── Type-specific context ─────────────────────────────────────────────────
  if (n.type === "HARVEST") {
    if (n.replacementAsset) {
      lines.push(`🔄 *Replacement asset:* ${n.replacementAsset} _(maintains market exposure)_`);
    }
    if (n.washSaleDaysRemaining !== undefined) {
      const washOk = n.washSaleDaysRemaining === 0;
      lines.push(`${washOk ? "✅" : "⚠️"} *Wash-sale window:* ${washOk ? "clear" : `${n.washSaleDaysRemaining}d remaining — loss may be disallowed`}`);
    }
    lines.push(``);
  }

  if (n.type === "PARK") {
    if (n.daysToLongTerm !== undefined) {
      lines.push(`🏦 *Strategy:* Park proceeds in USYC for ${n.daysToLongTerm} days to lock in long-term treatment _(+earn yield)_`, ``);
    }
  }

  if (n.type === "REBALANCE") {
    if (n.regime) {
      lines.push(`📡 *Market regime:* ${n.regime}`, ``);
    }
    if (n.currentAllocationPct !== undefined && n.targetAllocationPct !== undefined) {
      lines.push(`� Allocation: ${n.currentAllocationPct.toFixed(0)}% → target ${n.targetAllocationPct.toFixed(0)}%`, ``);
    }
  }

  // ── Claude's analysis ─────────────────────────────────────────────────────
  lines.push(`🧠 *Claude's analysis:*`);
  lines.push(n.explanationBody ?? n.llmReasoning);
  lines.push(``);

  // ── Tax saving ────────────────────────────────────────────────────────────
  if (n.taxSavingEstimate > 0) {
    lines.push(`💰 *Est. tax saving: $${n.taxSavingEstimate.toFixed(0)}*`);
  }

  if (n.approvalMode === "delegated" && n.autoExecuteAt) {
    lines.push(``, `⏱ _Auto-executes ${n.autoExecuteAt.toISOString()} unless deferred_`);
  }

  return lines.join("\n");
}

async function sendTelegramOpportunity(
  n: OpportunityNotification,
  chatId: string
): Promise<void> {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN not set");

  const text = buildOpportunityText(n);

  const inlineKeyboard =
    n.approvalMode === "manual" && n.buttons
      ? {
          inline_keyboard: [
            n.buttons.map((btn: string) => {
              const labels: Record<string, string> = {
                execute: "✅ Approve",
                defer:   "⏰ Defer",
                skip:    "❌ Skip",
              };
              return {
                text:          labels[btn] ?? btn,
                callback_data: `action:${n.actionId}:${btn}`,
              };
            }),
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
