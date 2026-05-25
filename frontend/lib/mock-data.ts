import type {
  Agent,
  ApprovalSettings,
  Opportunity,
  PortfolioMetrics,
  Position,
  RegimeState,
  UserPolicy,
} from "./types";

export const DEMO_WALLET = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb";

export const defaultPolicy: UserPolicy = {
  jurisdiction: "US",
  harvestThresholdPct: -8,
  maturationBufferDays: 30,
  primaryObjective: "minimize_tax",
  minHarvestLossUsd: 100,
  heartbeatIntervalMinutes: 30,
  maxPerTransaction: 5000,
  maxPerMonth: 20000,
  expirationDays: 90,
};

export const defaultApproval: ApprovalSettings = {
  mode: "manual",
  notifyOnExecute: true,
  autoApproveTypes: ["HARVEST", "REBALANCE", "PARK"],
};

export const delegatedApproval: ApprovalSettings = {
  mode: "delegated",
  notifyOnExecute: true,
  autoApproveTypes: ["HARVEST", "PARK"],
  vetoWindowSeconds: 0,
};

export const demoMetrics: PortfolioMetrics = {
  portfolioValueUsd: 52_400,
  grossReturnPct: 11.2,
  afterTaxReturnPct: 8.4,
  benchmarkBtcReturnPct: 9.1,
  lossesHarvestedYtd: 2_100,
  taxCostAvoided: 1_840,
  estimatedYearEndLiability: 3_200,
  realizedGainsYtd: 8_400,
};

export const demoPositions: Position[] = [
  {
    assetId: "wETH",
    chain: "Base",
    quantity: 1.2,
    valueUsd: 3_600,
    costBasisUsd: 4_200,
    unrealizedGlUsd: -600,
    holdingPeriodDays: 142,
  },
  {
    assetId: "cbETH",
    chain: "Ethereum",
    quantity: 0.8,
    valueUsd: 2_880,
    costBasisUsd: 2_400,
    unrealizedGlUsd: 480,
    holdingPeriodDays: 340,
  },
  {
    assetId: "USYC",
    chain: "Ethereum",
    quantity: 12_000,
    valueUsd: 12_000,
    costBasisUsd: 11_800,
    unrealizedGlUsd: 200,
    holdingPeriodDays: 45,
  },
  {
    assetId: "ARB",
    chain: "Arbitrum",
    quantity: 4_200,
    valueUsd: 3_920,
    costBasisUsd: 5_100,
    unrealizedGlUsd: -1_180,
    holdingPeriodDays: 89,
  },
];

export const demoRegime: RegimeState = {
  label: "risk-off",
  confidence: 0.78,
  reasoning:
    "Funding rates elevated but stablecoin outflows and declining ETH/BTC ratio suggest de-risking. Favor parking near long-term lots over discretionary sells.",
};

export const demoOpportunity: Opportunity = {
  id: "opp-demo-harvest",
  agentId: "agent-demo",
  type: "HARVEST",
  status: "pending",
  headline: "Harvest opportunity — wETH down $600",
  taxSavingEstimate: 180,
  llmReasoning:
    "Wash sale window closes in 12 days. Parking in USYC preserves optionality while earning yield. Harvest after the window saves ~$180 vs acting now. Regime is risk-off — replacement exposure via stETH (0.94 correlation) is acceptable once cleared.",
  deferDays: 12,
  deferReason: "wash sale window",
  createdAt: new Date().toISOString(),
};

export function createDemoAgent(
  walletAddress: string,
  policy: UserPolicy = defaultPolicy,
  approval: ApprovalSettings = defaultApproval,
): Agent {
  const conn = policy.walletConnectionType ?? "external_eip7702";
  const executionTier: Agent["executionTier"] =
    conn === "watch" ? "watch" : "execute";

  return {
    id: `agent-${walletAddress.slice(2, 10)}`,
    status: "active",
    wallets: [
      {
        address: walletAddress,
        chains: ["Ethereum", "Base", "Arbitrum"],
        importSource: "onchain",
      },
    ],
    policy: { ...policy, walletConnectionType: conn },
    approval: { ...defaultApproval, ...approval, mode: approval.mode ?? "manual" },
    executionTier,
    heartbeatIntervalMinutes: policy.heartbeatIntervalMinutes ?? 30,
    createdAt: new Date().toISOString(),
  };
}

export const demoAgent = createDemoAgent(DEMO_WALLET);

export const demoAgentDelegated = createDemoAgent(
  DEMO_WALLET,
  defaultPolicy,
  delegatedApproval,
);
