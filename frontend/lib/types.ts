export type AgentStatus = "pending" | "active" | "paused";
export type OpportunityType = "HARVEST" | "REBALANCE" | "PARK";
export type OpportunityStatus =
  | "pending"
  | "executed"
  | "deferred"
  | "skipped"
  | "auto_executed";
export type ExecutionTier = "watch" | "execute";
export type ApprovalMode = "manual" | "delegated";

export interface ApprovalSettings {
  mode: ApprovalMode;
  /** When delegated: which types the agent may execute without asking */
  autoApproveTypes?: OpportunityType[];
  /** Notify after autonomous execution (default true) */
  notifyOnExecute: boolean;
  /** Optional: notify first, auto-execute after N seconds unless user skips */
  vetoWindowSeconds?: number;
}

export interface UserPolicy {
  jurisdiction: "US" | "OTHER";
  harvestThresholdPct: number;
  maturationBufferDays: number;
  primaryObjective: "minimize_tax" | "maximize_return" | "balanced";
}

export interface WalletBinding {
  address: string;
  chains: string[];
  importSource: "onchain" | "csv" | "manual";
}

export interface Agent {
  id: string;
  status: AgentStatus;
  wallets: WalletBinding[];
  policy: UserPolicy;
  approval: ApprovalSettings;
  executionTier: ExecutionTier;
  heartbeatIntervalMinutes: number;
  createdAt: string;
}

export interface PortfolioMetrics {
  portfolioValueUsd: number;
  grossReturnPct: number;
  afterTaxReturnPct: number;
  benchmarkBtcReturnPct: number;
  lossesHarvestedYtd: number;
  taxCostAvoided: number;
  estimatedYearEndLiability: number;
  realizedGainsYtd: number;
}

export interface Position {
  assetId: string;
  chain: string;
  quantity: number;
  valueUsd: number;
  costBasisUsd: number;
  unrealizedGlUsd: number;
  holdingPeriodDays: number;
}

export interface Opportunity {
  id: string;
  agentId: string;
  type: OpportunityType;
  status: OpportunityStatus;
  headline: string;
  taxSavingEstimate: number;
  llmReasoning: string;
  deferDays?: number;
  deferReason?: string;
  createdAt: string;
  executedAutonomously?: boolean;
}

export interface RegimeState {
  label: "risk-on" | "risk-off" | "neutral";
  confidence: number;
  reasoning: string;
}
