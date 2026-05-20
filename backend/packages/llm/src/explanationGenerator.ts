import { ExplanationOutputSchema } from "@taxee/shared";
import type { ActionType, LLMDecision, ExplanationOutput } from "@taxee/shared";
import { callLLM } from "./llmClient.js";
import {
  EXPLANATION_GENERATOR_SYSTEM,
  EXPLANATION_GENERATOR_USER,
} from "./prompts/explanationGenerator.prompt.js";

/**
 * Generate a user-facing explanation of a tax action decision.
 *
 * Called after the Action Reasoner returns a decision.
 * The output is sent to the user via Telegram/dashboard notification.
 *
 * The explanation anchors on dollar amounts — users care about
 * "you'll save $459 in taxes" more than "short-term rate applied".
 */
export async function generateExplanation(params: {
  actionType: ActionType;
  decision: LLMDecision;
  reasoning: string;
  estimatedTaxImpact: number;
  assetSymbol?: string;
  replacementAsset?: string;
  deferDays?: number;
  interimAction?: "PARK_IN_USYC";
}): Promise<ExplanationOutput> {
  const result = await callLLM({
    systemPrompt: EXPLANATION_GENERATOR_SYSTEM,
    userPrompt:   EXPLANATION_GENERATOR_USER(params),
    outputSchema: ExplanationOutputSchema,
    maxTokens:    512,
  });

  return result.output as ExplanationOutput;
}
