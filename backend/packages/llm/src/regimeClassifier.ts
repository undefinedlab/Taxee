import { RegimeClassifierOutputSchema } from "@taxee/shared";
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
    outputSchema: RegimeClassifierOutputSchema,
    maxTokens:    768,
  });

  return {
    regime: {
      ...result.output.regime,
      cachedAt: new Date(),
    },
    promptVersion: result.output.promptVersion,
    latencyMs:     result.meta.latencyMs,
  };
}
