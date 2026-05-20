import Anthropic from "@anthropic-ai/sdk";
import { type ZodSchema } from "zod";

export type ClaudeModel = "claude-opus-4-5" | "claude-sonnet-4-5" | "claude-haiku-3-5";

export interface LLMCallMeta {
  promptVersion: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
}

export interface LLMCallResult<T> {
  output: T;
  meta: LLMCallMeta;
  rawText: string;
}

/**
 * Wrapper around Anthropic's Messages API that:
 *   1. Sends a structured prompt
 *   2. Parses the response as JSON
 *   3. Validates with a Zod schema
 *   4. Returns typed output + call metadata
 *
 * The `promptVersion` field in every output ensures we can:
 *   - Replay calls exactly (immutable prompt → same output for same input)
 *   - Detect drift when prompts change
 *   - Audit which version produced a given tax decision
 */
export async function callLLM<T>(params: {
  model?: ClaudeModel;
  systemPrompt: string;
  userPrompt: string;
  outputSchema: ZodSchema<T>;
  maxTokens?: number;
}): Promise<LLMCallResult<T>> {
  const client = new Anthropic();
  const model  = params.model ?? "claude-sonnet-4-5";
  const start  = Date.now();

  const response = await client.messages.create({
    model,
    max_tokens: params.maxTokens ?? 1024,
    system:     params.systemPrompt,
    messages:   [{ role: "user", content: params.userPrompt }],
  });

  const latencyMs = Date.now() - start;

  const textContent = response.content.find((c) => c.type === "text");
  if (!textContent || textContent.type !== "text") {
    throw new Error("LLM returned no text content");
  }

  const rawText = textContent.text.trim();

  let parsed: unknown;
  try {
    const jsonMatch = rawText.match(/```json\s*([\s\S]*?)```/) ?? rawText.match(/({[\s\S]*})/);
    const jsonStr   = jsonMatch ? jsonMatch[1] : rawText;
    parsed = JSON.parse(jsonStr ?? rawText);
  } catch {
    throw new Error(`LLM output is not valid JSON:\n${rawText.slice(0, 500)}`);
  }

  const validated = params.outputSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(
      `LLM output failed schema validation:\n${JSON.stringify(validated.error.issues, null, 2)}\n\nRaw:\n${rawText.slice(0, 500)}`
    );
  }

  return {
    output:  validated.data,
    rawText,
    meta: {
      promptVersion: "unknown",
      latencyMs,
      inputTokens:  response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
  };
}
