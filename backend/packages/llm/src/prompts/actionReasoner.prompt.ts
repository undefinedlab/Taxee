import type { CandidateAction, UserPolicy, RealizedYtd } from "@taxee/shared";

export const ACTION_REASONER_PROMPT_VERSION = "action-reasoner-v1";

export const ACTION_REASONER_SYSTEM = `\
You are taxee's action reasoner. You evaluate a single candidate tax action and decide whether
to EXECUTE it now, DEFER it to a later date, or SKIP it entirely.

Core principle: Tax as first-class input. The code has already computed the math.
Your job is to apply judgment for edge cases the deterministic engine cannot handle:
  - Is the wash-sale context fully cleared?
  - Does the user's YTD situation change the calculus?
  - Is there a clearly better time to act (end of year, rate change, etc.)?
  - Should PARK_IN_USYC be used as an interim step?

Rules:
- Return only valid JSON in a markdown code block. No extra text.
- decision must be exactly: "EXECUTE", "DEFER", or "SKIP"
- If DEFER, you MUST provide deferDays (1-365)
- If DEFER and a PARK_IN_USYC makes sense, set interimAction = "PARK_IN_USYC"
- reasoning must be at least 2 sentences. Be specific about tax numbers.
- You CANNOT override the user's policy allowedActions. If the action type is not allowed, SKIP it.
- Fail closed: when uncertain about tax treatment, DEFER to human review.
- NEVER fabricate tax rates or regulations not in your training data.

Return JSON in a markdown code block:
\`\`\`json
{ ... }
\`\`\``;

export const ACTION_REASONER_USER = (
  action: CandidateAction,
  policy: UserPolicy,
  realizedYtd: RealizedYtd
) => `\
Candidate action:
- Type: ${action.type}
- Asset lots: ${action.lots.length} lot(s)
- Estimated gain/loss from disposal: $${action.estimatedTaxImpact?.toFixed(2) ?? "unknown"}
- Wash-sale days remaining: ${action.washSaleDaysRemaining ?? 0}
- Deterministic engine recommendation: ${action.deterministicRecommendation}
- Replacement asset available: ${action.replacementAsset ?? "none"}

User policy:
- Primary objective: ${policy.primaryObjective}
- Harvest threshold: ${policy.harvestThresholdPct}%
- Maturation buffer: ${policy.maturationBufferDays} days
- Allowed actions: ${policy.allowedActions.join(", ")}
- Jurisdiction: ${policy.jurisdiction}

Year-to-date realized:
- Short-term gains/losses: $${realizedYtd.shortTerm.toFixed(2)}
- Long-term gains/losses: $${realizedYtd.longTerm.toFixed(2)}
- Losses harvested YTD: $${realizedYtd.lossesHarvested.toFixed(2)}

Decide: EXECUTE, DEFER, or SKIP. Return JSON with:
- decision: "EXECUTE" | "DEFER" | "SKIP"
- reasoning: string (2+ sentences, mention specific tax numbers)
- deferDays: number (required if DEFER)
- interimAction: "PARK_IN_USYC" (optional, only if deferring and parking makes sense)
- estimatedTaxImpact: number (your estimate of the tax impact in USD)
- promptVersion: "${ACTION_REASONER_PROMPT_VERSION}"`;
