// ─── Agent & Identity ─────────────────────────────────────────────────────────

export type AgentStatus = "pending" | "active" | "paused";
export type ApprovalMode = "manual" | "delegated";
export type DeploymentMode = "hosted" | "mcp";
export type ActionType = "HARVEST" | "REBALANCE" | "PARK" | "HOLD";
export type LotStatus = "open" | "partial" | "closed";
export type OpportunityStatus =
  | "pending"
  | "approved"
  | "deferred"
  | "skipped"
  | "executed"
  | "failed";
export type LLMDecision = "EXECUTE" | "DEFER" | "SKIP";
export type DeterministicRecommendation = "EXECUTE" | "DEFER";
export type TaxTerm = "short" | "long";
export type ImportSource = "onchain" | "csv" | "manual";
export type PrimaryObjective = "minimize_tax" | "maximize_return" | "balanced";
export type RebalanceAggressiveness = "conservative" | "moderate" | "aggressive";
export type RegimeLabel = "risk-on" | "risk-off" | "neutral";
export type NotificationChannelType = "telegram" | "email" | "webhook";

export interface NotificationChannel {
  type: NotificationChannelType;
  chatId?: string;
  email?: string;
  webhookUrl?: string;
}

export interface ApprovalSettings {
  mode: ApprovalMode;
  autoApproveTypes?: ActionType[];
  notifyOnExecute: boolean;
  vetoWindowSeconds?: number;
}

export interface UserPolicy {
  primaryObjective: PrimaryObjective;
  harvestThresholdPct: number;
  maturationBufferDays: number;
  rebalanceAggressiveness: RebalanceAggressiveness;
  allowedActions: ActionType[];
  maxTaxPerAction?: number;
  jurisdiction: "US" | "UK";
}

export interface WalletBinding {
  id: string;
  agentId: string;
  address: string;
  chains: number[];
  circleWalletId?: string;
  importSource: ImportSource;
}

export interface Agent {
  id: string;
  userId: string;
  status: AgentStatus;
  wallets: WalletBinding[];
  policy: UserPolicy;
  approval: ApprovalSettings;
  deploymentMode: DeploymentMode;
  notificationChannels: NotificationChannel[];
  heartbeatIntervalMinutes: number;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Tax Lots & Portfolio ─────────────────────────────────────────────────────

export interface Lot {
  id: string;
  agentId: string;
  assetId: string;
  chainId: number;
  acquiredAt: Date;
  costBasisUsd: string;
  quantity: string;
  sourceTx: string;
  status: LotStatus;
  holdingPeriodDays: number;
  provisional: boolean;
  createdAt: Date;
}

export interface Position {
  assetId: string;
  chainId: number;
  quantity: string;
  currentValueUsd: string;
  unrealizedGainLossUsd: string;
  lots: Lot[];
}

export interface RegimeSignals {
  btcFundingRatePct: number;
  stablecoinSupplyDelta7dPct: number;
  realizedVol30d: number;
  fearAndGreedIndex: number;
  ethBtcRatioTrend: "rising" | "declining" | "flat";
  capturedAt: Date;
}

export interface RegimeState {
  label: RegimeLabel;
  confidence: number;
  reasoning: string;
  targetAllocationDelta: Record<string, number>;
  cachedAt: Date;
}

export interface RealizedYtd {
  shortTerm: number;
  longTerm: number;
  lossesHarvested: number;
}

export interface PortfolioSnapshot {
  agentId: string;
  capturedAt: Date;
  positions: Position[];
  prices: Record<string, number>;
  realizedYtd: RealizedYtd;
  regimeSignals: RegimeSignals;
  userPolicy: UserPolicy;
}

// ─── Decision Engine ──────────────────────────────────────────────────────────

export interface LotManifest {
  lots: Lot[];
  totalQuantity: string;
  totalCostBasisUsd: number;
  estimatedProceedsUsd: number;
  estimatedGainLossUsd: number;
  selectionMethod: "HIFO" | "FIFO" | "SPECIFIC_ID";
}

export interface CandidateAction {
  id: string;
  agentId: string;
  type: ActionType;
  priority: number;
  lots: Lot[];
  estimatedTaxImpact: number;
  estimatedGas: number;
  replacementAsset?: string;
  washSaleDaysRemaining?: number;
  deterministicRecommendation: DeterministicRecommendation;
  createdAt: Date;
}

export interface ScheduledAction {
  type: ActionType;
  executeAt: Date;
  lotId: string;
  reason: string;
}

export interface Opportunity {
  id: string;
  agentId: string;
  candidateAction: CandidateAction;
  llmDecision?: LLMDecision;
  llmReasoning?: string;
  deferDays?: number;
  scheduledAction?: ScheduledAction;
  interimAction?: "PARK_IN_USYC";
  status: OpportunityStatus;
  createdAt: Date;
  decidedAt?: Date;
}

// ─── Execution & Compliance ───────────────────────────────────────────────────

export interface ApprovedAction {
  opportunityId: string;
  agentId: string;
  candidateAction: CandidateAction;
  lotManifest: LotManifest;
  validatedAt: Date;
}

export interface ArcRecord {
  id: string;
  agentId: string;
  lotId: string;
  description: string;
  dateAcquired: string;
  dateSold: string;
  proceeds: number;
  costBasis: number;
  gainLoss: number;
  term: TaxTerm;
  txHash: string;
  chainId: number;
  rationale?: string;
  createdAt: Date;
}

// ─── LLM Outputs ─────────────────────────────────────────────────────────────

export interface GoalParserOutput {
  policy: UserPolicy;
  promptVersion: string;
}

export interface RegimeClassifierOutput {
  regime: RegimeState;
  promptVersion: string;
  latencyMs: number;
}

export interface ActionReasonerOutput {
  decision: LLMDecision;
  reasoning: string;
  deferDays?: number;
  interimAction?: "PARK_IN_USYC";
  scheduledAction?: ScheduledAction;
  estimatedTaxImpact?: number;
  promptVersion: string;
  latencyMs: number;
}

export interface ExplanationOutput {
  headline: string;
  body: string;
  taxSavingEstimate: number;
  promptVersion: string;
}

// ─── Notifications ────────────────────────────────────────────────────────────

export interface OpportunityNotification {
  agentId: string;
  actionId: string;
  walletLabel?: string;
  walletAddress?: string;
  jurisdiction?: "US" | "UK";
  type: ActionType;
  headline: string;
  explanationBody: string;
  taxSavingEstimate: number;
  llmReasoning: string;
  approvalMode: ApprovalMode;
  buttons?: ("execute" | "defer" | "skip")[];
  autoExecuteAt?: Date;
  deferOptions?: { days: number; reason: string };
  assetSymbol?: string;
  quantity?: number;
  costBasisUsd?: number;
  currentValueUsd?: number;
  unrealizedPct?: number;
  daysHeld?: number;
  replacementAsset?: string;
  washSaleDaysRemaining?: number;
  daysToLongTerm?: number;
  currentAllocationPct?: number;
  targetAllocationPct?: number;
  regime?: string;
}

export interface ActionReceipt {
  agentId: string;
  actionId: string;
  type: ActionType;
  headline: string;
  taxSavingActual: number;
  arcRecordId: string;
  txHash?: string;
  executedAt: Date;
  llmReasoning: string;
  dashboardUrl: string;
}

// ─── API Request / Response shapes ───────────────────────────────────────────

export interface RegisterAgentRequest {
  walletAddress: string;
  chains: number[];
  jurisdiction: "US" | "UK";
  harvestThresholdPct: number;
  maturationBufferDays?: number;
  approvalMode: ApprovalMode;
  notificationChannels?: NotificationChannel[];
  naturalLanguageGoal?: string;
}

export interface ActionDecisionRequest {
  decision: "execute" | "defer" | "skip";
  deferDays?: number;
}
