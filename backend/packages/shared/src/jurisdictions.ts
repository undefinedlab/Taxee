import type { ActionType, JurisdictionCode, UserPolicy } from "./types.js";

export const JURISDICTION_CODES: JurisdictionCode[] = [
  "US",
  "UK",
  "EU",
  "BR",
  "MX",
  "IN",
  "OTHER",
];

export interface JurisdictionProfile {
  code: JurisdictionCode;
  label: string;
  flag: string;
  /** Long-term holding threshold strategies (PARK) — enabled for all jurisdictions */
  supportsLongTermParking: boolean;
  /** Estimated marginal rate for harvest savings math */
  harvestTaxRate: number;
  defaultHarvestThresholdPct: number;
  defaultMaturationBufferDays: number;
  defaultAllowedActions: ActionType[];
}

export const JURISDICTION_PROFILES: Record<JurisdictionCode, JurisdictionProfile> = {
  US: {
    code: "US",
    label: "United States",
    flag: "🇺🇸",
    supportsLongTermParking: true,
    harvestTaxRate: 0.37,
    defaultHarvestThresholdPct: -8,
    defaultMaturationBufferDays: 30,
    defaultAllowedActions: ["HARVEST", "PARK", "REBALANCE"],
  },
  UK: {
    code: "UK",
    label: "United Kingdom",
    flag: "🇬🇧",
    supportsLongTermParking: true,
    harvestTaxRate: 0.2,
    defaultHarvestThresholdPct: -8,
    defaultMaturationBufferDays: 30,
    defaultAllowedActions: ["HARVEST", "PARK", "REBALANCE"],
  },
  EU: {
    code: "EU",
    label: "Europe",
    flag: "🇪🇺",
    supportsLongTermParking: true,
    harvestTaxRate: 0.25,
    defaultHarvestThresholdPct: -8,
    defaultMaturationBufferDays: 30,
    defaultAllowedActions: ["HARVEST", "PARK", "REBALANCE"],
  },
  BR: {
    code: "BR",
    label: "Brasil",
    flag: "🇧🇷",
    supportsLongTermParking: true,
    harvestTaxRate: 0.225,
    defaultHarvestThresholdPct: -10,
    defaultMaturationBufferDays: 30,
    defaultAllowedActions: ["HARVEST", "PARK", "REBALANCE"],
  },
  MX: {
    code: "MX",
    label: "Mexico",
    flag: "🇲🇽",
    supportsLongTermParking: true,
    harvestTaxRate: 0.35,
    defaultHarvestThresholdPct: -8,
    defaultMaturationBufferDays: 30,
    defaultAllowedActions: ["HARVEST", "PARK", "REBALANCE"],
  },
  IN: {
    code: "IN",
    label: "India",
    flag: "🇮🇳",
    supportsLongTermParking: true,
    harvestTaxRate: 0.3,
    defaultHarvestThresholdPct: -10,
    defaultMaturationBufferDays: 30,
    defaultAllowedActions: ["HARVEST", "PARK", "REBALANCE"],
  },
  OTHER: {
    code: "OTHER",
    label: "Other / multi-country",
    flag: "🌍",
    supportsLongTermParking: true,
    harvestTaxRate: 0.25,
    defaultHarvestThresholdPct: -8,
    defaultMaturationBufferDays: 30,
    defaultAllowedActions: ["HARVEST", "PARK", "REBALANCE"],
  },
};

export const HEARTBEAT_INTERVAL_OPTIONS = [15, 30, 60, 120] as const;
export type HeartbeatIntervalMinutes = (typeof HEARTBEAT_INTERVAL_OPTIONS)[number];

export const MIN_HARVEST_LOSS_USD_OPTIONS = [0, 50, 100, 250, 500, 1000] as const;

export const HARVEST_THRESHOLD_PCT_OPTIONS = [-5, -8, -10, -15] as const;

export function normalizeJurisdiction(
  value: string | null | undefined,
): JurisdictionCode {
  const upper = (value ?? "US").toUpperCase();
  if ((JURISDICTION_CODES as string[]).includes(upper)) {
    return upper as JurisdictionCode;
  }
  return "OTHER";
}

export function getJurisdictionProfile(
  code: string | null | undefined,
): JurisdictionProfile {
  return JURISDICTION_PROFILES[normalizeJurisdiction(code)];
}

export function jurisdictionDisplay(code: string | null | undefined): string {
  const p = getJurisdictionProfile(code);
  return `${p.flag} ${p.label}`;
}

export interface AgentPolicyOverrides {
  harvestThresholdPct?: number;
  maturationBufferDays?: number;
  minHarvestLossUsd?: number;
  heartbeatIntervalMinutes?: number;
  telegramChatId?: string;
  primaryObjective?: UserPolicy["primaryObjective"];
  rebalanceAggressiveness?: UserPolicy["rebalanceAggressiveness"];
  lastHeartbeatAt?: string;
}

/** Build persisted agent.policy JSON from jurisdiction + user choices */
export function buildAgentPolicy(
  jurisdiction: string | null | undefined,
  overrides: AgentPolicyOverrides = {},
): UserPolicy {
  const profile = getJurisdictionProfile(jurisdiction);

  return {
    primaryObjective:        overrides.primaryObjective ?? "minimize_tax",
    harvestThresholdPct:     overrides.harvestThresholdPct ?? profile.defaultHarvestThresholdPct,
    maturationBufferDays:    overrides.maturationBufferDays ?? profile.defaultMaturationBufferDays,
    rebalanceAggressiveness: overrides.rebalanceAggressiveness ?? "moderate",
    allowedActions: profile.defaultAllowedActions,
    jurisdiction:            profile.code,
    minHarvestLossUsd:       overrides.minHarvestLossUsd ?? 0,
    heartbeatIntervalMinutes: overrides.heartbeatIntervalMinutes ?? 30,
    ...(overrides.telegramChatId !== undefined
      ? { telegramChatId: overrides.telegramChatId }
      : {}),
    ...(overrides.lastHeartbeatAt !== undefined
      ? { lastHeartbeatAt: overrides.lastHeartbeatAt }
      : {}),
  };
}

export function getHarvestTaxRate(policy: UserPolicy): number {
  return getJurisdictionProfile(policy.jurisdiction).harvestTaxRate;
}

export function supportsLongTermParking(policy: UserPolicy): boolean {
  return getJurisdictionProfile(policy.jurisdiction).supportsLongTermParking;
}
