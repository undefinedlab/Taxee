import type { PortfolioSnapshot, UserPolicy, CandidateAction, Lot } from "@taxee/shared";

const LONG_TERM_THRESHOLD_DAYS = 365;

/**
 * Scan the portfolio for lots approaching the long-term capital gains threshold.
 *
 * For each lot with an unrealized gain:
 *   - Compute days remaining to 365-day long-term threshold
 *   - If days_remaining <= policy.maturationBufferDays → flag PARK_IN_USYC
 *
 * Purpose: Prevent premature disposal of lots at short-term rates when waiting
 * a few more days would qualify them for lower long-term treatment.
 * The lot is parked in USYC to earn yield while it ages.
 *
 * Pure function — no side effects, no API calls.
 */
export function trackMaturationOpportunities(
  snapshot: PortfolioSnapshot,
  policy: UserPolicy
): CandidateAction[] {
  // UK CGT has no holding-period distinction — gains taxed at the same rate
  // whether held 1 day or 10 years. PARK strategy is meaningless here.
  if (policy.jurisdiction === "UK") return [];

  const candidates: CandidateAction[] = [];
  const now = new Date();

  for (const position of snapshot.positions) {
    const currentPrice = snapshot.prices[position.assetId];
    if (!currentPrice) continue;

    for (const lot of position.lots) {
      if (lot.status === "closed") continue;
      if (lot.provisional) continue;

      const lotQty        = parseFloat(lot.quantity);
      const lotCostBasis  = parseFloat(lot.costBasisUsd);
      const currentValue  = lotQty * currentPrice;
      const unrealizedGain = currentValue - lotCostBasis;

      if (unrealizedGain <= 0) continue;

      const daysHeld           = computeDaysHeld(lot.acquiredAt, now);
      const daysToLongTerm     = LONG_TERM_THRESHOLD_DAYS - daysHeld;

      if (daysToLongTerm <= 0) continue;

      if (daysToLongTerm <= policy.maturationBufferDays) {
        const shortTermTax = unrealizedGain * 0.37;
        const longTermTax  = unrealizedGain * 0.20;
        const taxSaving    = shortTermTax - longTermTax;

        candidates.push({
          id: generateCandidateId("PARK", lot.id, position.chainId),
          agentId: snapshot.agentId,
          type: "PARK",
          priority: computeMaturationPriority(daysToLongTerm, taxSaving),
          lots: [lot],
          estimatedTaxImpact: -taxSaving,
          estimatedGas: estimateGasCost(position.chainId),
          deterministicRecommendation: "EXECUTE",
          createdAt: now,
        });
      }
    }
  }

  return candidates.sort((a, b) => b.priority - a.priority);
}

/**
 * Return the exact date a lot will cross the 365-day long-term threshold.
 * Used by the agent scheduler to set up a re-check on that day.
 */
export function getLongTermCrossoverDate(lot: Lot): Date {
  const acquired = new Date(lot.acquiredAt);
  return new Date(acquired.getTime() + LONG_TERM_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * Get lots that have already crossed the long-term threshold.
 * Used to trigger harvest execution for previously parked lots.
 */
export function getMaturedLots(lots: Lot[]): Lot[] {
  const now = new Date();
  return lots.filter((lot: Lot) => {
    if (lot.status === "closed") return false;
    const daysHeld = computeDaysHeld(lot.acquiredAt, now);
    return daysHeld >= LONG_TERM_THRESHOLD_DAYS;
  });
}

function computeDaysHeld(acquiredAt: Date | string, now: Date): number {
  return Math.floor(
    (now.getTime() - new Date(acquiredAt).getTime()) / (1000 * 60 * 60 * 24)
  );
}

function computeMaturationPriority(daysToLongTerm: number, taxSaving: number): number {
  const urgency = 1 / Math.max(daysToLongTerm, 1);
  return urgency * Math.min(taxSaving, 10000);
}

function estimateGasCost(chainId: number): number {
  const gasCosts: Record<number, number> = {
    1:     8,
    8453:  0.1,
    42161: 0.2,
    137:   0.05,
  };
  return gasCosts[chainId] ?? 1;
}

function generateCandidateId(type: string, lotId: string, chainId: number): string {
  return `candidate-${type.toLowerCase()}-${lotId.replace(/[^a-z0-9]/gi, "")}-${chainId}-${Date.now()}`;
}
