import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  PortfolioSnapshot,
  UserPolicy,
  CandidateAction,
  Lot,
  Position,
} from "@taxee/shared";

interface CorrelationData {
  pairs: Record<string, { replacement: string; correlation: number }>;
  minCorrelationThreshold: number;
}

const correlationData = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "data", "correlations.json"),
    "utf8",
  ),
) as CorrelationData;

/**
 * Scan the portfolio snapshot for loss-harvest opportunities.
 *
 * For each position across all chains:
 *   1. Compute unrealized loss percentage vs cost basis
 *   2. If loss exceeds policy.harvestThresholdPct → flag HARVEST
 *   3. Attach a correlated replacement asset (to maintain exposure post-harvest)
 *   4. Check wash-sale window (30 days since last purchase of the same asset)
 *
 * Pure function — no side effects, no API calls.
 */
export function scanForHarvestOpportunities(
  snapshot: PortfolioSnapshot,
  policy: UserPolicy
): CandidateAction[] {
  const candidates: CandidateAction[] = [];
  const now = new Date();

  for (const position of snapshot.positions) {
    if (position.lots.length === 0) continue;

    const currentPrice = snapshot.prices[position.assetId];
    if (!currentPrice) continue;

    const totalQuantity  = position.lots
      .filter((l: Lot) => l.status !== "closed")
      .reduce((sum: number, l: Lot) => sum + parseFloat(l.quantity), 0);

    const totalCostBasis = position.lots
      .filter((l: Lot) => l.status !== "closed")
      .reduce((sum: number, l: Lot) => sum + parseFloat(l.costBasisUsd), 0);

    if (totalCostBasis <= 0) continue;

    const currentValue     = totalQuantity * currentPrice;
    const unrealizedGainLoss = currentValue - totalCostBasis;
    const unrealizedPct    = (unrealizedGainLoss / totalCostBasis) * 100;

    if (unrealizedPct >= policy.harvestThresholdPct) continue;

    const openLots = position.lots.filter(
      (l: Lot) => l.status === "open" || l.status === "partial"
    );

    if (openLots.length === 0) continue;

    const washSaleDaysRemaining = computeWashSaleDaysRemaining(openLots, now);
    const replacementAsset      = getReplacementAsset(position.assetId);

    // Tax-saving estimate by jurisdiction:
    //   US — assume short-term ordinary income rate (37% top bracket; conservative upper bound)
    //   UK — Capital Gains Tax higher rate (20% on crypto/shares above the £3K allowance)
    const harvestRate           = policy.jurisdiction === "UK" ? 0.20 : 0.37;
    const estimatedTaxSaving    = Math.abs(unrealizedGainLoss) * harvestRate;

    candidates.push({
      id: generateCandidateId("HARVEST", position.assetId, position.chainId),
      agentId: snapshot.agentId,
      type: "HARVEST",
      priority: computeHarvestPriority(unrealizedPct, policy.harvestThresholdPct),
      lots: openLots,
      estimatedTaxImpact: -estimatedTaxSaving,
      estimatedGas: estimateGasCost(position.chainId),
      ...(replacementAsset !== undefined ? { replacementAsset } : {}),
      washSaleDaysRemaining,
      deterministicRecommendation: washSaleDaysRemaining > 0 ? "DEFER" : "EXECUTE",
      createdAt: now,
    });
  }

  return candidates.sort((a, b) => b.priority - a.priority);
}

/**
 * Compute how many days remain in the wash-sale window.
 *
 * Wash sale rule (US): if the same or substantially identical asset was purchased
 * within 30 days before or after a sale, the loss is disallowed.
 *
 * Here we check: was the most recent lot acquired within the last 30 days?
 * If so, we must wait before harvesting to avoid triggering wash sale.
 *
 * NOTE: Crypto wash sale rules are unsettled under current US law (as of 2026).
 * taxee applies them conservatively by default.
 */
function computeWashSaleDaysRemaining(lots: Lot[], now: Date): number {
  const WASH_SALE_DAYS = 30;
  let maxDaysRemaining = 0;

  for (const lot of lots) {
    const daysSinceAcquisition = Math.floor(
      (now.getTime() - new Date(lot.acquiredAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    const daysRemaining = WASH_SALE_DAYS - daysSinceAcquisition;
    if (daysRemaining > 0) {
      maxDaysRemaining = Math.max(maxDaysRemaining, daysRemaining);
    }
  }

  return maxDaysRemaining;
}

/**
 * Get the recommended replacement asset to maintain market exposure post-harvest.
 * Returns undefined if no correlated pair exists above the threshold.
 */
function getReplacementAsset(assetId: string): string | undefined {
  const pair = correlationData.pairs[assetId];
  if (!pair || pair.correlation < correlationData.minCorrelationThreshold) {
    return undefined;
  }
  return pair.replacement;
}

/**
 * Priority score: deeper losses score higher (more urgent to harvest).
 * Normalised so that a -16% loss (2× threshold at -8%) scores 2.0.
 */
function computeHarvestPriority(unrealizedPct: number, thresholdPct: number): number {
  if (thresholdPct === 0) return 0;
  return Math.abs(unrealizedPct / thresholdPct);
}

function estimateGasCost(chainId: number): number {
  const gasCosts: Record<number, number> = {
    1:    8,
    8453: 0.1,
    42161: 0.2,
    137:   0.05,
  };
  return gasCosts[chainId] ?? 1;
}

function generateCandidateId(type: string, assetId: string, chainId: number): string {
  return `candidate-${type.toLowerCase()}-${assetId.toLowerCase()}-${chainId}-${Date.now()}`;
}
