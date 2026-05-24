import { InlineKeyboard } from "grammy";
import {
  JURISDICTION_PROFILES,
  JURISDICTION_CODES,
  HEARTBEAT_INTERVAL_OPTIONS,
  HARVEST_THRESHOLD_PCT_OPTIONS,
  MIN_HARVEST_LOSS_USD_OPTIONS,
  jurisdictionDisplay,
  type JurisdictionCode,
} from "@taxee/shared";

export interface PendingAgentPolicy {
  jurisdiction: JurisdictionCode;
  heartbeatIntervalMinutes: number;
  harvestThresholdPct: number;
  minHarvestLossUsd: number;
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
      p.minHarvestLossUsd != null,
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

export function formatPolicySummary(p: PendingAgentPolicy): string {
  return (
    `🌍 *${jurisdictionDisplay(p.jurisdiction)}*\n` +
    `⏱ Scan every *${p.heartbeatIntervalMinutes}* min\n` +
    `🌾 Harvest when loss ≥ *${Math.abs(p.harvestThresholdPct)}%*\n` +
    `💵 Min loss to act: *${p.minHarvestLossUsd === 0 ? "any" : `$${p.minHarvestLossUsd}`}*\n\n` +
    `Send your wallet address (0x...) to link and start scanning.`
  );
}
