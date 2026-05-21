import { z } from "zod";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const AgentStatusSchema = z.enum(["pending", "active", "paused"]);
export const ApprovalModeSchema = z.enum(["manual", "delegated"]);
export const ActionTypeSchema = z.enum(["HARVEST", "REBALANCE", "PARK", "HOLD"]);
export const LotStatusSchema = z.enum(["open", "partial", "closed"]);
export const RegimeLabelSchema = z.enum(["risk-on", "risk-off", "neutral"]);
export const LLMDecisionSchema = z.enum(["EXECUTE", "DEFER", "SKIP"]);
export const TaxTermSchema = z.enum(["short", "long"]);
export const JurisdictionSchema = z.enum(["US", "OTHER"]);

// ─── Policy & Settings ────────────────────────────────────────────────────────

export const UserPolicySchema = z.object({
  primaryObjective: z.enum(["minimize_tax", "maximize_return", "balanced"]),
  harvestThresholdPct: z.number().min(-100).max(0),
  maturationBufferDays: z.number().min(0).max(365),
  rebalanceAggressiveness: z.enum(["conservative", "moderate", "aggressive"]),
  allowedActions: z.array(ActionTypeSchema).min(1),
  maxTaxPerAction: z.number().positive().optional(),
  jurisdiction: JurisdictionSchema,
});

export const ApprovalSettingsSchema = z.object({
  mode: ApprovalModeSchema,
  autoApproveTypes: z.array(ActionTypeSchema).optional(),
  notifyOnExecute: z.boolean(),
  vetoWindowSeconds: z.number().positive().optional(),
});

export const NotificationChannelSchema = z.object({
  type: z.enum(["telegram", "email", "webhook"]),
  chatId: z.string().optional(),
  email: z.string().email().optional(),
  webhookUrl: z.string().url().optional(),
});

// ─── Agent Registration ───────────────────────────────────────────────────────

export const RegisterAgentSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
  chains: z.array(z.number().int().positive()).min(1),
  jurisdiction: JurisdictionSchema,
  harvestThresholdPct: z.number().min(-50).max(-1),
  maturationBufferDays: z.number().min(0).max(365).default(30),
  approvalMode: ApprovalModeSchema,
  notificationChannels: z.array(NotificationChannelSchema).optional(),
  naturalLanguageGoal: z.string().optional(),
});

// ─── LLM Structured Outputs (validated on every LLM call) ────────────────────

export const GoalParserOutputSchema = z.object({
  policy: UserPolicySchema,
  promptVersion: z.string(),
});

export const RegimeStateSchema = z.object({
  label: RegimeLabelSchema,
  confidence: z.number().min(0).max(1),
  reasoning: z.string().min(10),
  targetAllocationDelta: z.record(z.string(), z.number()),
});

export const RegimeClassifierLLMOutputSchema = z.object({
  label: RegimeLabelSchema,
  confidence: z.number().min(0).max(1),
  reasoning: z.string().min(10),
  targetAllocationDelta: z.record(z.string(), z.number()),
  promptVersion: z.string(),
});

export const RegimeClassifierOutputSchema = z.object({
  regime: RegimeStateSchema,
  promptVersion: z.string(),
  latencyMs: z.number(),
});

export const ScheduledActionSchema = z.object({
  type: ActionTypeSchema,
  executeAt: z.string().datetime(),
  lotId: z.string(),
  reason: z.string(),
});

export const ActionReasonerOutputSchema = z.object({
  decision: LLMDecisionSchema,
  reasoning: z.string().min(10),
  deferDays: z.number().int().min(0).nullish(),
  interimAction: z.enum(["PARK_IN_USYC"]).nullish(),
  scheduledAction: ScheduledActionSchema.nullish(),
  estimatedTaxImpact: z.number().nullish(),
  promptVersion: z.string(),
});

export const ExplanationOutputSchema = z.object({
  headline: z.string().max(120),
  body: z.string(),
  taxSavingEstimate: z.number(),
  promptVersion: z.string(),
});

// ─── Action Decision (API input) ──────────────────────────────────────────────

export const ActionDecisionSchema = z.object({
  decision: z.enum(["execute", "defer", "skip"]),
  deferDays: z.number().int().min(1).max(365).optional(),
});

// ─── Type inference helpers ────────────────────────────────────────────────────

export type UserPolicyInput     = z.infer<typeof UserPolicySchema>;
export type RegisterAgentInput  = z.infer<typeof RegisterAgentSchema>;
export type ActionDecisionInput = z.infer<typeof ActionDecisionSchema>;
export type RegimeStateOutput   = z.infer<typeof RegimeStateSchema>;
export type ActionReasonerOut   = z.infer<typeof ActionReasonerOutputSchema>;
