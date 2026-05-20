import type { PortfolioSnapshot, UserPolicy, CandidateAction, RegimeState, Lot } from "@taxee/shared";
import { selectLots, estimateTaxCost } from "./lotSelector.js";

/**
 * Evaluate whether a rebalance is tax-justified given current drift and regime.
 *
 * Core logic:
 *   drift_cost  = cost of NOT rebalancing (weighted by regime urgency)
 *   tax_cost    = estimated capital gains tax from required disposals (HIFO)
 *
 *   if drift_cost > tax_cost → flag REBALANCE
 *   else                     → flag HOLD, re-check in 24h
 *
 * Pure function — no side effects, no API calls.
 */
export function computeRebalanceCandidates(
  snapshot: PortfolioSnapshot,
  regime: RegimeState,
  policy: UserPolicy
): CandidateAction[] {
  const candidates: CandidateAction[] = [];
  const now = new Date();

  const targetAllocations = buildTargetAllocations(snapshot, regime);
  const totalPortfolioValue = computeTotalValue(snapshot);

  if (totalPortfolioValue <= 0) return [];

  for (const [assetId, targetPct] of Object.entries(targetAllocations)) {
    const position = snapshot.positions.find(
      (p: import("@taxee/shared").Position) => p.assetId === assetId
    );

    const currentPrice = snapshot.prices[assetId];
    if (!currentPrice) continue;

    const currentValue = position
      ? parseFloat(position.quantity) * currentPrice
      : 0;

    const currentPct    = currentValue / totalPortfolioValue;
    const driftPct      = Math.abs(currentPct - targetPct);
    const driftThreshold = getDriftThreshold(policy.rebalanceAggressiveness);

    if (driftPct < driftThreshold) continue;

    const targetValue      = targetPct * totalPortfolioValue;
    const valueToRebalance = currentValue - targetValue;

    if (valueToRebalance <= 0) continue;

    const openLots = position
      ? position.lots.filter((l: Lot) => l.status === "open" || l.status === "partial")
      : [];

    if (openLots.length === 0) continue;

    const quantityToDispose = valueToRebalance / currentPrice;

    let taxCost = 0;
    try {
      const manifest  = selectLots(openLots, quantityToDispose, currentPrice, "HIFO");
      taxCost         = estimateTaxCost(manifest, openLots);
    } catch {
      continue;
    }

    const driftCost    = computeDriftCost(driftPct, totalPortfolioValue, regime);
    const netBenefit   = driftCost - taxCost;

    const shouldRebalance = netBenefit > 0;

    candidates.push({
      id: generateCandidateId("REBALANCE", assetId),
      agentId: snapshot.agentId,
      type: shouldRebalance ? "REBALANCE" : "HOLD",
      priority: shouldRebalance ? netBenefit / totalPortfolioValue : 0,
      lots: openLots,
      estimatedTaxImpact: taxCost,
      estimatedGas: estimateGasCostForRebalance(snapshot),
      deterministicRecommendation: shouldRebalance ? "EXECUTE" : "DEFER",
      createdAt: now,
    });
  }

  return candidates
    .filter((c) => c.type === "REBALANCE")
    .sort((a, b) => b.priority - a.priority);
}

/**
 * Build target allocations merging base 60/40 with regime deltas.
 */
function buildTargetAllocations(
  snapshot: PortfolioSnapshot,
  regime: RegimeState
): Record<string, number> {
  const base: Record<string, number> = {};

  for (const position of snapshot.positions) {
    const totalValue = computeTotalValue(snapshot);
    if (totalValue <= 0) {
      base[position.assetId] = 0;
      continue;
    }
    const currentPrice = snapshot.prices[position.assetId] ?? 0;
    base[position.assetId] = (parseFloat(position.quantity) * currentPrice) / totalValue;
  }

  for (const [asset, delta] of Object.entries(regime.targetAllocationDelta) as [string, number][]) {
    if (base[asset] !== undefined) {
      base[asset] = Math.max(0, (base[asset] ?? 0) + delta);
    }
  }

  const total = Object.values(base).reduce((s: number, v: number) => s + v, 0);
  if (total > 0) {
    for (const asset of Object.keys(base)) {
      base[asset] = (base[asset] ?? 0) / total;
    }
  }

  return base;
}

/**
 * Estimate the cost of NOT rebalancing: opportunity cost from being off-target.
 * Amplified in risk-off regime (higher urgency to reduce exposure).
 */
function computeDriftCost(
  driftPct: number,
  portfolioValue: number,
  regime: RegimeState
): number {
  const regimeMultiplier = regime.label === "risk-off" ? 1.5
    : regime.label === "risk-on" ? 0.8
    : 1.0;

  return driftPct * portfolioValue * regimeMultiplier * 0.15;
}

/**
 * Drift threshold varies by user aggressiveness preference.
 */
function getDriftThreshold(aggressiveness: string): number {
  switch (aggressiveness) {
    case "conservative": return 0.08;
    case "moderate":     return 0.05;
    case "aggressive":   return 0.03;
    default:             return 0.05;
  }
}

function computeTotalValue(snapshot: PortfolioSnapshot): number {
  return snapshot.positions.reduce((total: number, position: import("@taxee/shared").Position) => {
    const price = snapshot.prices[position.assetId] ?? 0;
    return total + parseFloat(position.quantity) * price;
  }, 0);
}

function estimateGasCostForRebalance(snapshot: PortfolioSnapshot): number {
  const uniqueChains = new Set(snapshot.positions.map((p: import("@taxee/shared").Position) => p.chainId)).size;
  const baseGas = 5;
  return baseGas * uniqueChains;
}

function generateCandidateId(type: string, assetId: string): string {
  return `candidate-${type.toLowerCase()}-${assetId.toLowerCase()}-${Date.now()}`;
}
