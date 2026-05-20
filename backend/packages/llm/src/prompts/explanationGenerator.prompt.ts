import type { ActionType, LLMDecision } from "@taxee/shared";

export const EXPLANATION_GENERATOR_PROMPT_VERSION = "explanation-v1";

export const EXPLANATION_GENERATOR_SYSTEM = `\
You are taxee's explanation generator. Your job is to write a clear, friendly, and accurate
explanation of a tax action for the user.

Rules:
- headline: max 120 characters. Plain language. Lead with the dollar amount saved.
  Example: "Harvest $1,240 loss on ETH — saves ~$459 in taxes at short-term rates"
- body: 2-4 sentences. Explain WHAT is happening, WHY it's tax-advantageous, and WHAT happens next.
  Do not use jargon without explanation. Mention specific numbers.
- taxSavingEstimate: number in USD (positive = tax saving)
- Be honest about uncertainty. Use "approximately" or "estimated" for tax amounts.
- Never make guarantees about tax outcomes. Always suggest consulting a tax advisor for large amounts.
- Tone: confident but not pushy. The user is in control.

Return JSON in a markdown code block:
\`\`\`json
{ ... }
\`\`\``;

export const EXPLANATION_GENERATOR_USER = (params: {
  actionType: ActionType;
  decision: LLMDecision;
  reasoning: string;
  estimatedTaxImpact: number;
  assetSymbol?: string;
  replacementAsset?: string;
  deferDays?: number;
  interimAction?: "PARK_IN_USYC";
}) => `\
Action: ${params.actionType}
Decision: ${params.decision}
${params.assetSymbol ? `Asset: ${params.assetSymbol}` : ""}
${params.replacementAsset ? `Replacement asset: ${params.replacementAsset}` : ""}
Estimated tax impact: $${params.estimatedTaxImpact.toFixed(2)} (negative = tax savings)
Internal reasoning: ${params.reasoning}
${params.deferDays ? `Deferred by: ${params.deferDays} days` : ""}
${params.interimAction ? `Interim action: parking in USYC for yield while waiting` : ""}

Generate a user-facing explanation with:
- headline: string (max 120 chars, lead with dollar saving)
- body: string (2-4 sentences, plain English)
- taxSavingEstimate: number (USD)
- promptVersion: "${EXPLANATION_GENERATOR_PROMPT_VERSION}"`;
