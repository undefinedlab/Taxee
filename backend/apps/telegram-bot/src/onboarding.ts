import { InlineKeyboard } from "grammy";
import {
  JURISDICTION_PROFILES,
  JURISDICTION_CODES,
  HEARTBEAT_INTERVAL_OPTIONS,
  HARVEST_THRESHOLD_PCT_OPTIONS,
  MIN_HARVEST_LOSS_USD_OPTIONS,
  WALLET_CONNECTION_LABELS,
  jurisdictionDisplay,
  type JurisdictionCode,
  type WalletConnectionType,
} from "@taxee/shared";

export interface PendingAgentPolicy {
  jurisdiction: JurisdictionCode;
  heartbeatIntervalMinutes: number;
  harvestThresholdPct: number;
  minHarvestLossUsd: number;
  walletConnectionType: WalletConnectionType;
}

const pendingByChat = new Map<string, Partial<PendingAgentPolicy>>();

export function getPendingPolicy(chatId: string): Partial<PendingAgentPolicy> | undefined {
  return pendingByChat.get(chatId);
}

export function clearPendingPolicy(chatId: string): void {
  pendingByChat.delete(chatId);
}

export function isPolicySetupComplete(chatId: string): boolean {
  const p = pendingByChat.get(chatId);
  return Boolean(
    p?.jurisdiction &&
      p.heartbeatIntervalMinutes != null &&
      p.harvestThresholdPct != null &&
      p.minHarvestLossUsd != null &&
      p.walletConnectionType,
  );
}

export function jurisdictionKeyboard() {
  const kb = new InlineKeyboard();
  for (const code of JURISDICTION_CODES) {
    const p = JURISDICTION_PROFILES[code];
    kb.text(`${p.flag} ${p.label}`, `region:${code}`).row();
  }
  return kb;
}

export function heartbeatKeyboard() {
  const kb = new InlineKeyboard();
  for (const mins of HEARTBEAT_INTERVAL_OPTIONS) {
    kb.text(`${mins} min`, `policy:heartbeat:${mins}`).row();
  }
  return kb;
}

export function harvestThresholdKeyboard() {
  const kb = new InlineKeyboard();
  for (const pct of HARVEST_THRESHOLD_PCT_OPTIONS) {
    kb.text(`${Math.abs(pct)}% loss`, `policy:harvest:${pct}`).row();
  }
  return kb;
}

export function minLossKeyboard() {
  const kb = new InlineKeyboard();
  for (const usd of MIN_HARVEST_LOSS_USD_OPTIONS) {
    const label = usd === 0 ? "Any loss size" : `≥ $${usd}`;
    kb.text(label, `policy:minloss:${usd}`).row();
  }
  return kb;
}

export function walletTypeKeyboard() {
  return new InlineKeyboard()
    .text("🦊 MetaMask / EIP-7702", "wallet:type:external_eip7702")
    .row()
    .text("🔵 Circle wallet", "wallet:type:circle")
    .row()
    .text("👀 Watch only", "wallet:type:watch");
}

export function setJurisdiction(chatId: string, code: JurisdictionCode) {
  const cur = pendingByChat.get(chatId) ?? {};
  pendingByChat.set(chatId, { ...cur, jurisdiction: code });
}

export function setHeartbeat(chatId: string, minutes: number) {
  const cur = pendingByChat.get(chatId) ?? {};
  pendingByChat.set(chatId, { ...cur, heartbeatIntervalMinutes: minutes });
}

export function setHarvestThreshold(chatId: string, pct: number) {
  const cur = pendingByChat.get(chatId) ?? {};
  pendingByChat.set(chatId, { ...cur, harvestThresholdPct: pct });
}

export function setMinLoss(chatId: string, usd: number) {
  const cur = pendingByChat.get(chatId) ?? {};
  pendingByChat.set(chatId, { ...cur, minHarvestLossUsd: usd });
}

export function setWalletConnectionType(chatId: string, type: WalletConnectionType) {
  const cur = pendingByChat.get(chatId) ?? {};
  pendingByChat.set(chatId, { ...cur, walletConnectionType: type });
}

function walletTypeNextStep(type: WalletConnectionType, frontendUrl: string): string {
  switch (type) {
    case "watch":
      return (
        "👀 *Watch only* — I scan your wallet and send *prefilled transaction steps* for MetaMask / Rabby.\n" +
        "You sign and broadcast — taxee never executes on your behalf.\n\n" +
        "Send the wallet address to monitor (`0x...`)."
      );
    case "external_eip7702":
      return (
        "🦊 *Self-custody (EIP-7702)* — MetaMask, Rabby, etc.\n" +
        "1. Send your wallet address (`0x...`).\n" +
        "2. Open the app to sign a one-time delegation so taxee can act within your policy:\n" +
        `${frontendUrl}/onboarding`
      );
    case "circle":
      return (
        "🔵 *Circle wallet* — hosted wallet with PIN + gas sponsorship.\n" +
        "1. Send your wallet address (`0x...`) after setup, or open Circle setup first:\n" +
        `${frontendUrl}/setup-wallet\n\n` +
        "_You can paste the address once your Circle wallet is created._"
      );
  }
}

export function formatPolicySummary(
  p: PendingAgentPolicy,
  frontendUrl = process.env["FRONTEND_URL"] ?? "https://taxee.app",
): string {
  const walletLine = `🔗 Wallet mode: *${WALLET_CONNECTION_LABELS[p.walletConnectionType]}*`;
  return (
    `🌍 *${jurisdictionDisplay(p.jurisdiction)}*\n` +
    `⏱ Scan every *${p.heartbeatIntervalMinutes}* min\n` +
    `🌾 Harvest when loss ≥ *${Math.abs(p.harvestThresholdPct)}%*\n` +
    `💵 Min loss to act: *${p.minHarvestLossUsd === 0 ? "any" : `$${p.minHarvestLossUsd}`}*\n` +
    `${walletLine}\n\n` +
    walletTypeNextStep(p.walletConnectionType, frontendUrl)
  );
}

export function walletConnectionHint(
  type: WalletConnectionType,
  frontendUrl: string,
  userId?: string,
): string | null {
  switch (type) {
    case "watch":
      return "👀 *Watch mode* — each opportunity includes copy-paste tx steps for your wallet.";
    case "external_eip7702":
      return (
        `🦊 *Next:* sign EIP-7702 delegation in the app:\n${frontendUrl}/onboarding` +
        (userId ? `?userId=${encodeURIComponent(userId)}` : "")
      );
    case "circle":
      return (
        `🔵 *Next:* set up Circle PIN (if new):\n${frontendUrl}/setup-wallet` +
        (userId ? `?userId=${encodeURIComponent(userId)}` : "")
      );
  }
}
