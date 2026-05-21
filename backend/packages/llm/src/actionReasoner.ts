import { ActionReasonerOutputSchema } from "@taxee/shared";
import type { CandidateAction, UserPolicy, RealizedYtd, ActionReasonerOutput } from "@taxee/shared";
import { callLLM } from "./llmClient.js";
import {
  ACTION_REASONER_SYSTEM,
  ACTION_REASONER_USER,
} from "./prompts/actionReasoner.prompt.js";

/**
 * Evaluate a single candidate action and return an EXECUTE / DEFER / SKIP decision.
 *
 * Called for every candidate action that passes the deterministic guardrails.
 * The LLM applies contextual judgment that the rule engine cannot:
 *   - YTD gain/loss context
 *   - Edge cases in wash-sale timing
 *   - Whether PARK_IN_USYC makes sense as an interim step
 *   - Year-end harvesting urgency
 */
export async function reasonAboutAction(
  action: CandidateAction,
  policy: UserPolicy,
  realizedYtd: RealizedYtd
): Promise<ActionReasonerOutput> {
  const result = await callLLM({
    systemPrompt: ACTION_REASONER_SYSTEM,
    userPrompt:   ACTION_REASONER_USER(action, policy, realizedYtd),
    outputSchema: ActionReasonerOutputSchema,
    maxTokens:    1024,
  });

  return {
    ...(result.output as unknown as ActionReasonerOutput),
    latencyMs: result.meta.latencyMs,
  };
}
