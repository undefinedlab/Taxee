import { GoalParserOutputSchema } from "@taxee/shared";
import type { GoalParserOutput } from "@taxee/shared";
import { callLLM } from "./llmClient.js";
import {
  GOAL_PARSER_SYSTEM,
  GOAL_PARSER_USER,
} from "./prompts/goalParser.prompt.js";

/**
 * Parse a natural language goal statement into a structured UserPolicy.
 *
 * Called once at agent registration when the user provides a text description
 * of their financial goals. The output is stored and drives all future decisions.
 *
 * Example input: "I want to minimize taxes on my ETH and BTC. I'm fine with
 * automated harvesting but want to approve any sells over $10k."
 */
export async function parseGoal(naturalLanguageGoal: string): Promise<GoalParserOutput> {
  const result = await callLLM({
    systemPrompt: GOAL_PARSER_SYSTEM,
    userPrompt:   GOAL_PARSER_USER(naturalLanguageGoal),
    outputSchema: GoalParserOutputSchema,
    maxTokens:    512,
  });

  return result.output as unknown as GoalParserOutput;
}
