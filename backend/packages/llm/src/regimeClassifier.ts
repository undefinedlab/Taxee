import { RegimeClassifierLLMOutputSchema } from "@taxee/shared";
import type { RegimeSignals, RegimeClassifierOutput } from "@taxee/shared";
import { callLLM } from "./llmClient.js";
import {
  REGIME_CLASSIFIER_SYSTEM,
  REGIME_CLASSIFIER_USER,
} from "./prompts/regimeClassifier.prompt.js";

/**
 * Classify the current market regime from onchain signals.
 *
 * Called at the start of every agent heartbeat cycle.
 * The regime drives rebalance decisions and portfolio allocation targets.
 *
 * Cached in the agent state for the duration of one heartbeat cycle
 * to avoid redundant LLM calls within a single run.
 */
export async function classifyRegime(
  signals: RegimeSignals
): Promise<RegimeClassifierOutput> {
  const result = await callLLM({
    systemPrompt: REGIME_CLASSIFIER_SYSTEM,
    userPrompt:   REGIME_CLASSIFIER_USER(signals),
    outputSchema: RegimeClassifierLLMOutputSchema,
    maxTokens:    768,
  });

  const llm = result.output;
  return {
    regime: {
      label:                 llm.label,
      confidence:            llm.confidence,
      reasoning:             llm.reasoning,
      targetAllocationDelta: llm.targetAllocationDelta,
      cachedAt:              new Date(),
    },
    promptVersion: llm.promptVersion,
    latencyMs:     result.meta.latencyMs,
  };
}
