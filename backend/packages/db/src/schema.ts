import {
  pgTable, text, numeric, integer, boolean,
  timestamp, jsonb, uuid, pgEnum, index, uniqueIndex,
} from "drizzle-orm/pg-core";

export const lotMethodEnum   = pgEnum("lot_method",   ["HIFO", "FIFO", "SPECIFIC_ID"]);
export const lotStatusEnum   = pgEnum("lot_status",   ["open", "partial", "closed"]);
export const agentStatusEnum = pgEnum("agent_status", ["active", "paused", "setup"]);
export const actionTypeEnum  = pgEnum("action_type",  ["HARVEST", "REBALANCE", "PARK", "HOLD"]);
export const approvalModeEnum = pgEnum("approval_mode", ["manual", "delegated"]);
export const decisionEnum    = pgEnum("llm_decision", ["EXECUTE", "DEFER", "SKIP"]);

export const users = pgTable("users", {
  id:         uuid("id").primaryKey().defaultRandom(),
  address:    text("address").notNull().unique(),
  telegramId: text("telegram_id").unique(),
  createdAt:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  addressIdx: uniqueIndex("users_address_idx").on(t.address),
}));

export const agents = pgTable("agents", {
  id:             uuid("id").primaryKey().defaultRandom(),
  userId:         uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  circleWalletId: text("circle_wallet_id").notNull(),
  name:           text("name").notNull().default("My taxee Agent"),
  status:         agentStatusEnum("status").notNull().default("setup"),
  approvalMode:   approvalModeEnum("approval_mode").notNull().default("manual"),
  policy:         jsonb("policy").notNull().default("{}"),
  createdAt:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:      timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdx: index("agents_user_id_idx").on(t.userId),
}));

export const lots = pgTable("lots", {
  id:           uuid("id").primaryKey().defaultRandom(),
  agentId:      uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  assetId:      text("asset_id").notNull(),
  chainId:      integer("chain_id").notNull(),
  quantity:     numeric("quantity", { precision: 36, scale: 18 }).notNull(),
  costBasisUsd: numeric("cost_basis_usd", { precision: 20, scale: 4 }).notNull(),
  acquiredAt:   timestamp("acquired_at", { withTimezone: true }).notNull(),
  status:       lotStatusEnum("status").notNull().default("open"),
  txHash:       text("tx_hash"),
  createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  agentIdx:  index("lots_agent_id_idx").on(t.agentId),
  assetIdx:  index("lots_asset_id_idx").on(t.assetId),
  statusIdx: index("lots_status_idx").on(t.status),
}));

export const opportunities = pgTable("opportunities", {
  id:                  uuid("id").primaryKey().defaultRandom(),
  agentId:             uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  type:                actionTypeEnum("type").notNull(),
  llmDecision:         decisionEnum("llm_decision").notNull(),
  llmReasoning:        text("llm_reasoning").notNull(),
  estimatedTaxImpact:  numeric("estimated_tax_impact", { precision: 20, scale: 4 }).notNull(),
  headline:            text("headline").notNull(),
  body:                text("body").notNull(),
  taxSavingEstimate:   numeric("tax_saving_estimate", { precision: 20, scale: 4 }).notNull().default("0"),
  deferDays:           integer("defer_days"),
  interimAction:       text("interim_action"),
  arcRecordId:         text("arc_record_id"),
  txHash:              text("tx_hash"),
  promptVersion:       text("prompt_version").notNull(),
  executedAt:          timestamp("executed_at", { withTimezone: true }),
  approvedAt:          timestamp("approved_at", { withTimezone: true }),
  deferredUntil:       timestamp("deferred_until", { withTimezone: true }),
  createdAt:           timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  agentIdx: index("opportunities_agent_id_idx").on(t.agentId),
}));

export const llmLogs = pgTable("llm_logs", {
  id:            uuid("id").primaryKey().defaultRandom(),
  agentId:       uuid("agent_id").references(() => agents.id, { onDelete: "set null" }),
  opportunityId: uuid("opportunity_id").references(() => opportunities.id, { onDelete: "set null" }),
  promptVersion: text("prompt_version").notNull(),
  model:         text("model").notNull(),
  inputTokens:   integer("input_tokens").notNull(),
  outputTokens:  integer("output_tokens").notNull(),
  latencyMs:     integer("latency_ms").notNull(),
  inputHash:     text("input_hash").notNull(),
  outputRaw:     text("output_raw").notNull(),
  createdAt:     timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  agentIdx: index("llm_logs_agent_id_idx").on(t.agentId),
}));

export const heartbeats = pgTable("heartbeats", {
  id:                  uuid("id").primaryKey().defaultRandom(),
  agentId:             uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  triggeredAt:         timestamp("triggered_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt:         timestamp("completed_at", { withTimezone: true }),
  opportunitiesFound:  integer("opportunities_found").notNull().default(0),
  actionsExecuted:     integer("actions_executed").notNull().default(0),
  errorMessage:        text("error_message"),
}, (t) => ({
  agentIdx: index("heartbeats_agent_id_idx").on(t.agentId),
}));
