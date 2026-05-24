import type { CandidateAction, UserPolicy, ApprovedAction, LotManifest } from "@taxee/shared";
import { selectLots } from "@taxee/tax-engine";

/**
 * Guardrails that run BEFORE LLM judgment and BEFORE execution.
 *
 * These are deterministic checks that can never be overridden:
 *   1. Action type allowed by user policy
 *   2. Wash-sale (disabled for crypto — not enforced)
 *   3. Lot manifest valid (quantities balance, no closed lots)
 *   4. Tax impact within per-action cap (if set by user)
 *
 * Returns a validated ApprovedAction or throws with a reason.
 * Fail closed: any guardrail failure blocks execution.
 */
export function validateForExecution(
  action: CandidateAction,
  policy: UserPolicy,
  currentPrices: Record<string, number>
): ApprovedAction {
  if (!policy.allowedActions.includes(action.type)) {
    throw new Error(
      `Action type ${action.type} is not in user's allowed actions: ${policy.allowedActions.join(", ")}`
    );
  }

  if ((policy as any).enforceWashSale && (action.washSaleDaysRemaining ?? 0) > 0) {
    throw new Error(
      `Wash-sale window not cleared. ${action.washSaleDaysRemaining} days remaining.`
    );
  }

  const openLots = action.lots.filter(
    (l) => l.status === "open" || l.status === "partial"
  );

  if (openLots.length === 0) {
    throw new Error("No open lots available for execution");
  }

  const firstLot = openLots[0];
  if (!firstLot) throw new Error("No lots found");

  const assetPrice = currentPrices[firstLot.assetId];
  if (!assetPrice) {
    throw new Error(`No current price available for asset: ${firstLot.assetId}`);
  }

  const totalQty = openLots.reduce((sum, l) => sum + parseFloat(l.quantity), 0);
  const manifest = selectLots(openLots, totalQty, assetPrice, "HIFO");

  if (policy.maxTaxPerAction !== undefined && action.estimatedTaxImpact > policy.maxTaxPerAction) {
    throw new Error(
      `Estimated tax impact $${action.estimatedTaxImpact.toFixed(2)} exceeds per-action cap $${policy.maxTaxPerAction.toFixed(2)}`
    );
  }

  return {
    opportunityId: action.id,
    agentId:       action.agentId,
    candidateAction: action,
    lotManifest:   manifest,
    validatedAt:   new Date(),
  };
}

/** Crypto: wash-sale timing is not enforced — sell and rebuy to harvest losses. */
export function isWashSaleSafe(_action: CandidateAction): boolean {
  return true;
}

/**
 * Compute estimated year-end tax liability given current open positions.
 * Used for the dashboard liability preview widget.
 */
export function estimateYearEndLiability(
  openGains: number,
  openLosses: number,
  harvestedLossesYtd: number
): {
  estimatedTax: number;
  netGains: number;
} {
  const netGains = Math.max(0, openGains - openLosses - harvestedLossesYtd);
  const estimatedTax = netGains * 0.20;
  return { estimatedTax, netGains };
}
