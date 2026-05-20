# taxee — Backend & Smart Contract Architecture

> **The first DeFi portfolio agent that optimizes after-tax return, not gross performance.**  
> Built for Circle Hackathon 2026.

---

## Table of Contents

1. [What Is Taxee](#1-what-is-taxee)
2. [System Architecture Overview](#2-system-architecture-overview)
3. [Monorepo Structure](#3-monorepo-structure)
4. [Backend Apps](#4-backend-apps)
   - [apps/api](#41-appsapi)
   - [apps/agent](#42-appsagent)
   - [apps/telegram-bot](#43-appstelegram-bot)
   - [apps/mcp-server](#44-appsmcp-server)
5. [Shared Packages](#5-shared-packages)
   - [packages/shared](#51-packagesshared)
   - [packages/tax-engine](#52-packagestax-engine)
   - [packages/aggregator](#53-packagesaggregator)
   - [packages/llm](#54-packagesllm)
   - [packages/execution](#55-packagesexecution)
   - [packages/compliance](#56-packagescompliance)
   - [packages/notifications](#57-packagesnotifications)
6. [Smart Contracts](#6-smart-contracts)
   - [External Contracts (Circle Stack)](#61-external-contracts-circle-stack)
   - [Custom Contracts](#62-custom-contracts)
7. [Core Data Models](#7-core-data-models)
8. [API Reference](#8-api-reference)
9. [LLM Pipeline](#9-llm-pipeline)
10. [Database Schema](#10-database-schema)
11. [Environment Variables](#11-environment-variables)
12. [Getting Started](#12-getting-started)
13. [Testing Strategy](#13-testing-strategy)
14. [Hackathon MVP Scope](#14-hackathon-mvp-scope)

---

## 1. What Is Taxee

DeFi portfolio agents today are tax-blind — they rebalance on drift, rotate on regime, and harvest gains across chains, silently destroying after-tax returns. Every disposal is a taxable event. Every rebalance has a tax cost. Every win held one day short of long-term treatment is money left on the table.

**taxee** embeds tax awareness as a first-class input into every agent decision:

| Decision     | Without taxee              | With taxee                                        |
|--------------|----------------------------|---------------------------------------------------|
| Rebalance    | Execute on drift threshold | Weigh disposal tax cost vs drift cost first       |
| Rotate       | Follow regime signal       | Factor realized gains before switching            |
| Hold         | No opinion on lot age      | Park near-LT lots in USYC to mature               |
| Harvest      | Manual or never            | Auto-scan all chains, book losses, replace exposure |

Users choose how hands-on to be: **manual approval** (Execute / Defer / Skip per opportunity) or **delegated** (agent runs autonomously within policy guardrails, always notifies).

---

## 2. System Architecture Overview

```
User Goal (natural language)
        │
        ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  LLM Goal Parser                                                          │
│  Translate intent → UserPolicy (structured JSON)                          │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  Data Aggregator                                                          │
│  Circle Wallets + Arc Ledger + Price Oracles + Onchain Signals           │
│  Output: PortfolioSnapshot                                                │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  LLM Regime Classifier                                                    │
│  Structured onchain signals → RegimeState { label, confidence, reasoning }│
└───────────────────────────────┬──────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  Decision Engine  (deterministic, pure TypeScript)                        │
│  ┌─────────────────────┐  ┌──────────────────────┐  ┌─────────────────┐ │
│  │ Rebalance Optimizer  │  │ Loss Harvest Scanner  │  │ Maturation      │ │
│  │ drift_cost vs        │  │ unrealized_loss >     │  │ Tracker         │ │
│  │ tax_cost of HIFO     │  │ threshold → HARVEST   │  │ days_to_LT < 30 │ │
│  │ disposal             │  │ + correlated replace  │  │ → PARK_IN_USYC  │ │
│  └─────────────────────┘  └──────────────────────┘  └─────────────────┘ │
│  Output: CandidateAction[]                                                │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  LLM Action Reasoner  (judgment layer)                                    │
│  Receives structured CandidateAction, applies edge-case reasoning:        │
│  wash-sale windows, regime direction, gas economics → EXECUTE/DEFER/SKIP  │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │
                    ┌───────────┴────────────┐
                    ▼                        ▼
          approval.mode = manual    approval.mode = delegated
          Notify user               Policy guardrail check
          await Execute/Defer/Skip  Auto-execute if clear
                    │                        │
                    └───────────┬────────────┘
                                ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  Execution Layer  (Circle Stack)                                          │
│  Circle Wallets → CCTP/Gateway → USYC park → Paymaster (USDC gas)        │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  Arc Ledger Write                                                         │
│  Immutable disposal record → Form 8949 pre-fill                           │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  LLM Explanation → Dashboard + Notification                               │
│  Plain-English rationale card, after-tax alpha metrics                    │
└──────────────────────────────────────────────────────────────────────────┘
```

### What LLM does vs what code does

| Task                                             | Owner              |
|--------------------------------------------------|--------------------|
| Parse natural-language goals                     | **LLM**            |
| Regime classification from mixed onchain signals | **LLM**            |
| Edge-case judgment (wash sale + regime + gas)    | **LLM**            |
| "Should we act now or defer?"                    | **LLM**            |
| Plain-English explanation to user                | **LLM**            |
| Harvest threshold math (`unrealized_loss > −8%`) | **Code**           |
| Lot selection (HIFO / specific-ID)               | **Code**           |
| Rebalance drift vs tax cost calculation          | **Code**           |
| Policy guardrail enforcement                     | **Code**           |
| Transaction execution                            | **Circle stack**   |
| Immutable disposal record                        | **Arc API**        |

---

## 3. Monorepo Structure

```
taxee/
├── apps/
│   ├── api/                    # REST API — Agent CRUD, action loop, webhooks
│   ├── agent/                  # Heartbeat worker — always-on portfolio scan
│   ├── telegram-bot/           # Telegram onboarding + notifications + inline approve
│   └── mcp-server/             # MCP tools for OpenClaw / Claude Desktop
│
├── packages/
│   ├── shared/                 # Core types: Agent, Lot, PortfolioSnapshot, CandidateAction
│   ├── tax-engine/             # Decision Engine — harvest, rebalance, maturation (pure TS)
│   ├── aggregator/             # Data Aggregator — Circle Wallets, Arc, oracles, signals
│   ├── llm/                    # Goal Parser, Regime Classifier, Action Reasoner, Explanation
│   │   ├── prompts/            # Versioned prompt templates (.v1.md, .v2.md)
│   │   └── schemas/            # Zod schemas for structured LLM output
│   ├── execution/              # Circle Wallets, Paymaster, USYC, CCTP adapters
│   ├── compliance/             # Arc writer, Form 8949 projection, lot store
│   └── notifications/          # TG, email, push adapters — shared OpportunityNotification
│
├── contracts/
│   ├── src/
│   │   ├── TaxeeLotRegistry.sol      # On-chain lot ID → cost basis registry
│   │   ├── TaxeeExecutor.sol         # Atomic harvest + USYC park executor
│   │   └── interfaces/
│   │       ├── ICircleCCTP.sol
│   │       └── IUsyc.sol
│   ├── test/
│   ├── script/
│   └── foundry.toml
│
├── fixtures/
│   └── demo-portfolio.json     # Deterministic demo portfolio for hackathon
│
├── frontend/                   # Next.js dashboard (separate package)
│
├── architecture.md             # Full system architecture reference
├── doc.md                      # Product overview
├── README.md                   # This file
├── package.json                # Workspace root
├── turbo.json                  # Turborepo build pipeline
└── tsconfig.base.json          # Shared TypeScript config
```

**Toolchain:**
- **Monorepo:** [Turborepo](https://turbo.build/) with npm workspaces
- **Runtime:** Node 20 + TypeScript 5
- **Smart contracts:** Foundry (Solidity 0.8.24)
- **DB migrations:** Drizzle ORM

---

## 4. Backend Apps

### 4.1 `apps/api`

Central REST + WebSocket API. All surfaces (web, Telegram, MCP) talk to this.

**Responsibilities:**
- Agent registration and CRUD
- Action loop state machine (`execute / defer / skip`)
- Opportunity retrieval and WebSocket push
- Telegram callback handler (inline button webhooks)
- Auth: SIWE (web), Telegram `chat_id` binding, MCP API key

**Folder layout:**
```
apps/api/
├── src/
│   ├── index.ts                  # Fastify app entry
│   ├── routes/
│   │   ├── agents.ts             # POST /agents, GET /agents/:id
│   │   ├── opportunities.ts      # GET /opportunities, PATCH /:id/decision
│   │   ├── actions.ts            # POST /actions/:id/execute|defer|skip
│   │   ├── portfolio.ts          # GET /portfolio/:agentId
│   │   ├── arc.ts                # GET /arc/:agentId (compliance export)
│   │   └── webhooks/
│   │       └── telegram.ts       # Telegram inline button callbacks
│   ├── middleware/
│   │   ├── auth.ts               # SIWE + TG + MCP API key verification
│   │   └── validate.ts           # Zod request validation
│   ├── db/
│   │   ├── schema.ts             # Drizzle schema
│   │   └── migrations/
│   └── lib/
│       └── actionStateMachine.ts # OPPORTUNITY_DETECTED → execute/defer/skip FSM
├── package.json
└── tsconfig.json
```

**Key endpoints — see [§8. API Reference](#8-api-reference) for full spec.**

---

### 4.2 `apps/agent`

Always-on heartbeat worker. One job per active `agentId`, running every `heartbeatIntervalMinutes` (default 60).

**Responsibilities:**
- Orchestrate the full scan cycle (Aggregator → Classifier → Decision Engine → LLM Reasoner)
- Dispatch execution (delegated mode) or emit notification (manual mode)
- Handle deferred action re-checks
- Log `"nothing found"` silently; surface opportunities to notification layer

**Folder layout:**
```
apps/agent/
├── src/
│   ├── index.ts                  # Worker entry point
│   ├── heartbeat.ts              # Main cycle: 9-step pipeline per agent
│   ├── scheduler.ts              # Inngest / BullMQ job registration
│   ├── guardrails.ts             # Policy enforcement before any execution
│   └── conflict.ts               # Conflict resolution: PARK overrides rebalance, etc.
├── package.json
└── tsconfig.json
```

**Heartbeat cycle (per agent):**

```
1.  Data Aggregator          → PortfolioSnapshot
2.  LLM Regime Classifier    → RegimeState  (cache hit: skip if < 4h old)
3.  Decision Engine          → CandidateAction[]
4.  if candidates == []      → log "no opportunities"; wait; rescan
5.  for each candidate:
    LLM Action Reasoner      → { decision, reasoning, scheduledAction? }
6a. [delegated] guardrail check → Execution Layer → Arc → notify (receipt)
6b. [manual]    emit OpportunityNotification with buttons → await user
7.  LLM Explanation          → dashboard card + notification body
```

**Job queue:** Inngest preferred (durable, retryable, per-agent fan-out). BullMQ as fallback.

---

### 4.3 `apps/telegram-bot`

Telegram bot handles frictionless onboarding and is the primary notification channel.

**Responsibilities:**
- `/start` command → guided onboarding flow
- Accept wallet address → trigger `aggregator` onchain history import
- Collect jurisdiction + harvest threshold preferences → call `Goal Parser`
- Notify on opportunities → inline **[Execute] [Defer] [Skip]** buttons
- Post-action receipts (delegated mode)
- `/mode manual|delegated` command to switch approval mode

**Folder layout:**
```
apps/telegram-bot/
├── src/
│   ├── index.ts                  # Bot entry (grammy)
│   ├── commands/
│   │   ├── start.ts              # /start onboarding wizard
│   │   ├── mode.ts               # /mode manual|delegated
│   │   ├── status.ts             # /status — active lots + YTD
│   │   └── portfolio.ts          # /portfolio — current snapshot
│   ├── handlers/
│   │   ├── callbackQuery.ts      # Inline button: execute/defer/skip
│   │   └── message.ts            # Address + preference capture
│   ├── notify.ts                 # Send OpportunityNotification cards
│   └── session.ts                # grammy session: onboarding state machine
├── package.json
└── tsconfig.json
```

**Onboarding flow:**
```
/start
  → "Send your wallet address (or WalletConnect link)"
  → [address received] → trigger onchain import stub
  → "Found N positions, M lots. Jurisdiction? [US] [Other]"
  → "Harvest when loss exceeds? [5%] [8%] [10%]"
  → "Approval mode? [Manual – I approve each move] [Delegated – agent runs autonomously]"
  → Agent spawned → "Agent active. Dashboard: https://taxee.app/a/{agentId}"
```

**Security:** Never request seed phrases. Execute tier upgrade via WalletConnect deep-link only. TG user `chat_id` bound to `agentId` in DB after wallet ownership verification.

---

### 4.4 `apps/mcp-server`

Exposes taxee as an MCP server so external agents (OpenClaw, Claude Desktop) can invoke taxee tools on demand, replacing the hosted heartbeat with user-controlled invocation.

**Folder layout:**
```
apps/mcp-server/
├── src/
│   ├── index.ts                  # MCP server entry (@modelcontextprotocol/sdk)
│   └── tools/
│       ├── registerWallet.ts     # taxee_register_wallet
│       ├── getPortfolio.ts       # taxee_get_portfolio
│       ├── scan.ts               # taxee_scan (run one heartbeat cycle)
│       ├── listOpportunities.ts  # taxee_list_opportunities
│       ├── approveAction.ts      # taxee_approve_action
│       └── getArcRecords.ts      # taxee_get_arc_records
├── package.json
└── tsconfig.json
```

**MCP tool manifest:**

| Tool                        | Input                                 | Output                                  |
|-----------------------------|---------------------------------------|-----------------------------------------|
| `taxee_register_wallet`     | `{ address, chains?, importSource? }` | `{ agentId, status, lotsImported }`     |
| `taxee_get_portfolio`       | `{ agentId }`                         | `PortfolioSnapshot`                     |
| `taxee_scan`                | `{ agentId }`                         | `CandidateAction[]` + LLM reasoning     |
| `taxee_list_opportunities`  | `{ agentId, status? }`                | `Opportunity[]`                         |
| `taxee_approve_action`      | `{ actionId, decision: execute/defer/skip }` | `ActionResult`               |
| `taxee_get_arc_records`     | `{ agentId, from?, to? }`             | `ArcRecord[]` (Form 8949 ready)         |

Auth: per-`agentId` API key, passed as MCP transport header. `taxee_scan` respects `agent.approval.mode` — delegated mode auto-executes; manual mode returns proposals only.

---

## 5. Shared Packages

### 5.1 `packages/shared`

Single source of truth for all TypeScript types used across apps and packages. No business logic — types, enums, and Zod schemas only.

```typescript
// Core entity types

Agent {
  id: string
  userId: string
  status: "pending" | "active" | "paused"
  wallets: WalletBinding[]
  policy: UserPolicy
  approval: ApprovalSettings
  deploymentMode: "hosted" | "mcp"
  notificationChannels: Channel[]
  heartbeatIntervalMinutes: number   // default: 60
  createdAt: Date
}

ApprovalSettings {
  mode: "manual" | "delegated"
  autoApproveTypes?: ("HARVEST" | "REBALANCE" | "PARK")[]
  notifyOnExecute: boolean           // default: true
  vetoWindowSeconds?: number         // notify-first + auto-execute after N sec
}

WalletBinding {
  address: string
  chains: number[]                   // chain IDs
  circleWalletId?: string
  importSource: "onchain" | "csv" | "manual"
}

UserPolicy {
  primaryObjective: "minimize_tax" | "maximize_return" | "balanced"
  harvestThresholdPct: number        // e.g. -8 (%)
  maturationBufferDays: number       // don't dispose lots within N days of LT threshold
  rebalanceAggressiveness: "conservative" | "moderate" | "aggressive"
  allowedActions: ("HARVEST" | "REBALANCE" | "PARK")[]
  maxTaxPerAction?: number           // USD cap
  jurisdiction: "US" | "OTHER"
}

// Portfolio types

PortfolioSnapshot {
  agentId: string
  capturedAt: Date
  positions: Position[]
  prices: Record<string, number>     // assetId → USD
  realizedYtd: {
    shortTerm: number
    longTerm: number
    lossesHarvested: number
  }
  regimeSignals: RegimeSignals
  userPolicy: UserPolicy
}

Position {
  assetId: string
  chainId: number
  quantity: string                   // Decimal as string
  lots: Lot[]
}

Lot {
  id: string
  agentId: string
  assetId: string
  chainId: number
  acquiredAt: Date
  costBasisUsd: string               // Decimal as string
  quantity: string
  sourceTx: string
  status: "open" | "partial" | "closed"
  holdingPeriodDays: number          // derived daily
  provisional: boolean               // true = not yet user-confirmed
}

// Decision types

CandidateAction {
  id: string
  type: "REBALANCE" | "HARVEST" | "PARK" | "HOLD"
  priority: number
  lots: Lot[]
  estimatedTaxImpact: number         // USD
  estimatedGas: number               // USD
  replacementAsset?: string
  washSaleDaysRemaining?: number
  deterministicRecommendation: "EXECUTE" | "DEFER"
}

Opportunity {
  id: string
  agentId: string
  candidateAction: CandidateAction
  llmDecision: "EXECUTE" | "DEFER" | "SKIP"
  llmReasoning: string
  scheduledAction?: ScheduledAction
  interimAction?: "PARK_IN_USYC"
  status: "pending" | "approved" | "deferred" | "skipped" | "executed" | "failed"
  createdAt: Date
  decidedAt?: Date
}
```

---

### 5.2 `packages/tax-engine`

**Pure TypeScript — zero API calls, zero side effects.** The deterministic brain of taxee.

Three modules, all unit-testable with no mocks:

#### Rebalance Optimizer (`rebalanceOptimizer.ts`)

```typescript
function computeRebalanceCandidates(
  snapshot: PortfolioSnapshot,
  regime: RegimeState,
  policy: UserPolicy
): CandidateAction[]
```

Logic:
```
drift_cost   = f(current_allocation, target_allocation, regime.targetAllocationDelta)
tax_cost     = Σ estimatedCapitalGains(requiredDisposals, lotSelection = HIFO)

if drift_cost > tax_cost → flag REBALANCE
else                     → flag HOLD, re-check in 24h
```

#### Loss Harvest Scanner (`harvestScanner.ts`)

```typescript
function scanForHarvestOpportunities(
  snapshot: PortfolioSnapshot,
  policy: UserPolicy
): CandidateAction[]
```

Logic:
```
for each position across all chains:
  unrealized_loss_pct = (current_value - cost_basis) / cost_basis

  if unrealized_loss_pct < policy.harvestThresholdPct:
    flag HARVEST
    attach correlated_replacement (correlation table in /data/correlations.json)
    check wash_sale_window (30d since last buy of same asset)
```

Correlation pairs (maintained in `packages/tax-engine/data/correlations.json`):
```json
{ "wETH": "stETH", "wBTC": "TBTC", "SOL": "mSOL", "MATIC": "stMATIC" }
```

#### Holding Period Tracker (`maturationTracker.ts`)

```typescript
function trackMaturationOpportunities(
  snapshot: PortfolioSnapshot,
  policy: UserPolicy
): CandidateAction[]
```

Logic:
```
for each lot:
  days_held        = today - lot.acquiredAt
  days_to_longterm = 365 - days_held

  if days_to_longterm <= policy.maturationBufferDays AND lot has unrealized gain:
    flag PARK_IN_USYC — do not dispose, park for yield while aging
```

#### HIFO Lot Selector (`lotSelector.ts`)

```typescript
function selectLotsHIFO(
  position: Position,
  quantityToDispose: Decimal,
  method: "HIFO" | "FIFO" | "SPECIFIC_ID"
): LotManifest
```

HIFO (Highest-In, First-Out) = select lots with highest cost basis first → minimizes realized gain. IRS-compliant when combined with specific identification at execution.

---

### 5.3 `packages/aggregator`

Pulls live portfolio data from all sources and assembles `PortfolioSnapshot`.

**Sources:**

| Source            | Data                                            | Implementation         |
|-------------------|-------------------------------------------------|------------------------|
| Circle Wallets    | Balances per chain, per asset                   | Circle Wallets REST API |
| Arc Ledger        | Cost basis per lot, YTD realized G/L            | Arc REST API            |
| Price Oracles     | Current USD mark-to-market                      | CoinGecko / Chainlink   |
| Onchain Signals   | Funding rates, vol, stablecoin flows, ETH/BTC   | Defillama + Glassnode stubs |

**Folder layout:**
```
packages/aggregator/
├── src/
│   ├── index.ts                  # assembleSnapshot(agentId): PortfolioSnapshot
│   ├── circle.ts                 # Circle Wallets API adapter
│   ├── arc.ts                    # Arc API read adapter
│   ├── prices.ts                 # CoinGecko / Chainlink price feed
│   ├── signals.ts                # Onchain regime signal collector
│   ├── onchainImport.ts          # viem-based history reconstruction (provisional lots)
│   └── cache.ts                  # Redis / in-memory price + regime signal cache
```

**Auto-import on registration:**
- `onchainImport.ts` uses `viem` to replay `eth_getLogs`, transfer events, DEX swap events
- Reconstructs provisional lots (`provisional: true`) — blocked from tax-critical execution until user confirms
- User can upload CSV to override cost basis post-registration

---

### 5.4 `packages/llm`

All four LLM-powered steps. Every call returns JSON matching a Zod schema. **Never parse free-form text for decisions.**

**Folder layout:**
```
packages/llm/
├── src/
│   ├── goalParser.ts             # UserPolicy from natural language
│   ├── regimeClassifier.ts       # RegimeState from structured signals
│   ├── actionReasoner.ts         # Execute/Defer/Skip judgment
│   └── explanationGenerator.ts  # Plain-English dashboard card
├── prompts/
│   ├── goal-parser.v1.md
│   ├── regime-classifier.v1.md
│   ├── action-reasoner.v1.md
│   └── explanation-generator.v1.md
├── schemas/
│   ├── userPolicy.schema.ts      # Zod
│   ├── regimeState.schema.ts
│   ├── actionReasoner.schema.ts
│   └── explanation.schema.ts
└── lib/
    └── client.ts                 # Anthropic SDK client + structured output wrapper
```

**All calls logged:** `{ promptVersion, agentId, input, output, latencyMs, timestamp }` — stored in `llm_call_log` table. Essential for demo debugging and reproducibility.

**Fallback policy:** If LLM API unavailable → use `deterministicRecommendation` from Decision Engine; surface `llm_unavailable: true` in dashboard.

**Temperature:** 0 for Goal Parser, Regime Classifier, Action Reasoner (determinism). 0.4 for Explanation Generator (natural prose).

---

### 5.5 `packages/execution`

Circle stack adapters. Wraps all execution primitives.

**Folder layout:**
```
packages/execution/
├── src/
│   ├── index.ts
│   ├── circleWallets.ts          # Circle Wallets API — create, read, sign tx
│   ├── cctp.ts                   # CCTP / Circle Gateway cross-chain USDC bridge
│   ├── usyc.ts                   # USYC deposit / withdraw (BlackRock yield token on Base)
│   ├── paymaster.ts              # Paymaster — gas abstraction, USDC-paid gas
│   ├── lotManifest.ts            # Build LotManifest from HIFO selection before signing
│   └── simulate.ts               # Dry-run: build tx, estimate, do NOT broadcast
```

**Execution pipeline (per approved action):**

```
ApprovedAction
  → lotManifest.build(action, HIFO)      # identify exact lots
  → simulate(lotManifest)                 # estimate tax + slippage + gas
  → circleWallets.sign(manifest)          # Circle API call with entity secret
  → broadcast()
  → await confirmation
  → compliance.arcWrite(receipt)
  → lotStore.updateLots(manifest)
  → notifications.sendReceipt(agentId)
```

**Policy guardrail (code, not LLM):**
```typescript
function validateApprovedAction(
  llmOutput: ActionReasonerOutput,
  candidate: CandidateAction,
  policy: UserPolicy
): ApprovedAction | null {
  if (!policy.allowedActions.includes(candidate.type)) return null;
  if (candidate.type === "PARK" && llmOutput.decision === "EXECUTE_HARVEST") return null;
  if (llmOutput.estimatedTaxImpact > (policy.maxTaxPerAction ?? Infinity)) return null;
  return { ...llmOutput, validatedAt: new Date() };
}
```

**taxee never stores user private keys.** `circleWalletId` + Circle entity secret (server-side only) is the execution model. Watch-tier users get execution proposals only.

---

### 5.6 `packages/compliance`

Arc ledger integration and Form 8949 projection.

**Folder layout:**
```
packages/compliance/
├── src/
│   ├── arcWriter.ts              # Write disposal record to Arc API
│   ├── lotStore.ts               # Update lot status after disposal (open → partial/closed)
│   ├── form8949.ts               # Project Form 8949 from Arc records
│   └── types.ts                  # ArcRecord, DisposalRecord
```

**Arc record written on every executed action:**
```typescript
ArcRecord {
  lotId: string               // "L-weth-003"
  description: string         // "0.5 wETH"
  dateAcquired: string        // ISO date
  dateSold: string
  proceeds: number            // USD
  costBasis: number           // USD
  gainLoss: number            // USD (negative = loss)
  term: "short" | "long"
  txHash: string
  chain: number
  rationale: string           // LLM reasoning summary
  agentId: string
}
```

**Form 8949 projection** (`form8949.ts`): Aggregate all `ArcRecord`s per agent per tax year → group short-term / long-term → compute net position → export as CSV.

---

### 5.7 `packages/notifications`

Shared notification types and channel adapters.

**Folder layout:**
```
packages/notifications/
├── src/
│   ├── index.ts
│   ├── types.ts                  # OpportunityNotification, ActionReceipt
│   ├── telegram.ts               # Send via grammy Bot API
│   ├── webhook.ts                # Generic webhook POST (web dashboard push)
│   └── formatters/
│       ├── manual.ts             # "Harvest opp — wETH down $600. [Execute] [Defer] [Skip]"
│       └── delegated.ts          # "Executed autonomously — parked wETH in USYC. Est. saving $180."
```

**OpportunityNotification:**
```typescript
OpportunityNotification {
  agentId: string
  actionId: string
  type: "HARVEST" | "REBALANCE" | "PARK"
  headline: string
  taxSavingEstimate: number
  llmReasoning: string
  approvalMode: "manual" | "delegated"
  buttons?: ["execute", "defer", "skip"]      // manual mode only
  autoExecuteAt?: Date                         // delegated + veto window
  deferOptions?: { days: number; reason: string }
  dashboardUrl: string
}
```

---

## 6. Smart Contracts

### 6.1 External Contracts (Circle Stack)

taxee integrates with these deployed contracts — no modifications:

| Contract                  | Chain       | Purpose                                      | ABI Source                          |
|---------------------------|-------------|----------------------------------------------|-------------------------------------|
| **CCTP TokenMessenger**   | ETH, Base, ARB | Cross-chain USDC burn/mint bridge         | Circle CCTP docs                    |
| **CCTP MessageTransmitter** | ETH, Base, ARB | CCTP attestation relay                   | Circle CCTP docs                    |
| **USYC (ERC-20)**         | Base (0x...)| BlackRock USD Institutional Digital Liquidity Fund — yield while parked | Hashnote / Base scan |
| **Paymaster**             | Base        | ERC-4337 paymaster — gas fees in USDC        | Circle Paymaster docs               |
| **Circle Wallets**        | Multi-chain | MPC-secured programmatic wallet              | Circle API (not contract-direct)    |

Interface files in `contracts/src/interfaces/`:

```solidity
// contracts/src/interfaces/ICircleCCTP.sol
interface ITokenMessenger {
    function depositForBurn(
        uint256 amount,
        uint32 destinationDomain,
        bytes32 mintRecipient,
        address burnToken
    ) external returns (uint64 nonce);
}

// contracts/src/interfaces/IUsyc.sol
interface IUSYC {
    function deposit(uint256 usdcAmount) external returns (uint256 shares);
    function redeem(uint256 shares) external returns (uint256 usdcAmount);
    function previewRedeem(uint256 shares) external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
}
```

---

### 6.2 Custom Contracts

Two lightweight contracts deployed on **Base** (primary execution chain):

#### `TaxeeLotRegistry.sol`

**Purpose:** On-chain commitment of lot metadata for non-repudiation. Backs the Arc write with an immutable onchain fingerprint. Optional but strengthens compliance story.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title TaxeeLotRegistry
 * @notice Immutable on-chain registry of disposal lot records.
 *         Complements Arc off-chain ledger with onchain hash commitment.
 *         Emits LotDisposed event indexable by tax tooling.
 */
contract TaxeeLotRegistry {
    event LotDisposed(
        address indexed agent,
        bytes32 indexed lotId,
        bytes32 dataHash,     // keccak256(abi.encode(ArcRecord))
        uint256 timestamp
    );

    mapping(bytes32 => bytes32) public lotHashes;

    function commitDisposal(
        bytes32 lotId,
        bytes32 dataHash
    ) external {
        require(lotHashes[lotId] == bytes32(0), "Lot already committed");
        lotHashes[lotId] = dataHash;
        emit LotDisposed(msg.sender, lotId, dataHash, block.timestamp);
    }

    function verifyDisposal(
        bytes32 lotId,
        bytes32 dataHash
    ) external view returns (bool) {
        return lotHashes[lotId] == dataHash;
    }
}
```

#### `TaxeeExecutor.sol`

**Purpose:** Atomic execution of harvest + USYC park in a single transaction. Prevents partial execution where the sell goes through but the park doesn't.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IUsyc.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title TaxeeExecutor
 * @notice Atomically swaps a harvested asset to USDC, then deposits into USYC.
 *         Called by Circle Programmable Wallet (authorized caller only).
 *         Prevents partial execution: both swap and park succeed or both revert.
 */
contract TaxeeExecutor {
    IUSYC public immutable usyc;
    IERC20 public immutable usdc;
    address public immutable authorizedCaller;  // Circle Wallet address

    event HarvestAndParked(
        address indexed agent,
        bytes32 indexed lotId,
        uint256 usdcAmount,
        uint256 usycShares,
        uint256 timestamp
    );

    constructor(address _usyc, address _usdc, address _authorizedCaller) {
        usyc = IUSYC(_usyc);
        usdc = IERC20(_usdc);
        authorizedCaller = _authorizedCaller;
    }

    modifier onlyAuthorized() {
        require(msg.sender == authorizedCaller, "Unauthorized");
        _;
    }

    /**
     * @notice Deposit USDC into USYC. Called after swap is settled.
     * @param usdcAmount Amount of USDC to park in USYC
     * @param lotId      The taxee lot ID being parked (for event indexing)
     * @param agentAddr  The taxee agent address (for event indexing)
     * @return shares    USYC shares received
     */
    function parkInUsyc(
        uint256 usdcAmount,
        bytes32 lotId,
        address agentAddr
    ) external onlyAuthorized returns (uint256 shares) {
        usdc.transferFrom(msg.sender, address(this), usdcAmount);
        usdc.approve(address(usyc), usdcAmount);
        shares = usyc.deposit(usdcAmount);
        emit HarvestAndParked(agentAddr, lotId, usdcAmount, shares, block.timestamp);
    }

    /**
     * @notice Redeem USYC shares back to USDC when lot matures or harvest executes.
     */
    function redeemFromUsyc(
        uint256 shares
    ) external onlyAuthorized returns (uint256 usdcAmount) {
        usyc.redeem(shares);
        usdcAmount = usdc.balanceOf(address(this));
        usdc.transfer(msg.sender, usdcAmount);
    }
}
```

**Foundry config (`contracts/foundry.toml`):**
```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc = "0.8.24"
optimizer = true
optimizer_runs = 200

[rpc_endpoints]
base = "${BASE_RPC_URL}"
base_sepolia = "${BASE_SEPOLIA_RPC_URL}"

[etherscan]
base = { key = "${BASESCAN_API_KEY}" }
```

---

## 7. Core Data Models

### Database tables (Drizzle + PostgreSQL)

```
agents                    Core Agent entity
wallet_bindings           WalletBinding[] per agent
lots                      Tax lots (provisional + confirmed)
portfolio_snapshots       Point-in-time snapshots (cached)
opportunities             CandidateAction + LLM output + approval state
arc_records               Immutable disposal records (mirrors Arc API)
scheduled_actions         Deferred PARK/HARVEST jobs
llm_call_log              Every LLM call: prompt version, input, output, latency
regime_cache              RegimeState cache (4h TTL)
```

---

## 8. API Reference

### Agents

| Method | Path                         | Description                              |
|--------|------------------------------|------------------------------------------|
| POST   | `/agents`                    | Register new agent (wallet + prefs)      |
| GET    | `/agents/:id`                | Get agent + current status               |
| PATCH  | `/agents/:id`                | Update policy / approval settings        |
| DELETE | `/agents/:id`                | Pause / deactivate agent                 |

**POST `/agents` body:**
```json
{
  "walletAddress": "0xabc...",
  "chains": [1, 8453],
  "jurisdiction": "US",
  "harvestThresholdPct": -8,
  "maturationBufferDays": 30,
  "approvalMode": "manual",
  "notificationChannels": [{ "type": "telegram", "chatId": "123456" }]
}
```

---

### Portfolio

| Method | Path                         | Description                              |
|--------|------------------------------|------------------------------------------|
| GET    | `/portfolio/:agentId`        | Current `PortfolioSnapshot`              |
| GET    | `/portfolio/:agentId/lots`   | All lots (open + provisional)            |
| POST   | `/portfolio/:agentId/import` | Upload CSV to override provisional lots  |

---

### Opportunities

| Method | Path                             | Description                                     |
|--------|----------------------------------|-------------------------------------------------|
| GET    | `/opportunities/:agentId`        | List pending/deferred opportunities             |
| GET    | `/opportunities/:agentId/:oppId` | Single opportunity + LLM reasoning              |

---

### Actions

| Method | Path                                | Description                                |
|--------|-------------------------------------|--------------------------------------------|
| POST   | `/actions/:id/execute`              | Execute approved opportunity               |
| POST   | `/actions/:id/defer`                | Defer with optional `{ days }` body        |
| POST   | `/actions/:id/skip`                 | Skip + 7-day cooldown on lot               |

---

### Compliance

| Method | Path                          | Description                               |
|--------|-------------------------------|-------------------------------------------|
| GET    | `/arc/:agentId`               | All Arc records for agent                 |
| GET    | `/arc/:agentId/form8949`      | Form 8949 projection (CSV download)       |

---

### Webhooks

| Method | Path                          | Description                               |
|--------|-------------------------------|-------------------------------------------|
| POST   | `/webhooks/telegram`          | Telegram inline button callback           |
| POST   | `/webhooks/circle`            | Circle Wallets event webhook              |

---

## 9. LLM Pipeline

### Step 1 — Goal Parser

**Trigger:** Onboarding or user preference update  
**Model:** `claude-3-5-haiku` (fast, cheap — single structured parse)  
**Input:** Natural language preference string  
**Output:** `UserPolicy` (Zod-validated JSON)

Example:
```
Input:  "Minimize taxes this year. Don't sell anything with less than 30 days to long-term. Harvest losses aggressively."
Output: { primaryObjective: "minimize_tax", harvestThresholdPct: -8, maturationBufferDays: 30, ... }
```

---

### Step 2 — Regime Classifier

**Trigger:** Each heartbeat cycle (cached 4h)  
**Model:** `claude-3-5-sonnet`  
**Input:** Structured `RegimeSignals` object  
**Output:** `RegimeState { label, confidence, reasoning, targetAllocationDelta }`

Example input to LLM:
```
BTC funding rate:      +0.08%  (elevated longs)
Stablecoin supply Δ7d: -2.1%   (capital leaving)
Realized vol 30d:       68%
Fear & Greed:           31     (fear)
ETH/BTC trend:          declining
```

---

### Step 3 — Action Reasoner

**Trigger:** Per `CandidateAction` flagged by Decision Engine  
**Model:** `claude-3-5-sonnet` (judgment quality matters here)  
**Input:** Full structured context — lot, regime, wash-sale state, gas estimate, YTD realized  
**Output:** `{ decision, reasoning, deferDays?, interimAction?, scheduledAction? }`

This is the **demo moment** — show the reasoning chain live in the dashboard.

Guardrails applied in code **after** LLM response before any execution fires.

---

### Step 4 — Explanation Generator

**Trigger:** After action executed or deferred  
**Model:** `claude-3-5-haiku`  
**Input:** `{ action, decision, before/after portfolio state, tax impact }`  
**Output:** Plain-English card rendered in dashboard and notification body

---

## 10. Database Schema

```sql
-- Core tables (Drizzle ORM, PostgreSQL)

CREATE TABLE agents (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending',  -- pending|active|paused
  policy        JSONB NOT NULL,
  approval      JSONB NOT NULL,
  deployment    TEXT NOT NULL DEFAULT 'hosted',   -- hosted|mcp
  channels      JSONB NOT NULL DEFAULT '[]',
  heartbeat_min INTEGER NOT NULL DEFAULT 60,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE wallet_bindings (
  id                TEXT PRIMARY KEY,
  agent_id          TEXT NOT NULL REFERENCES agents(id),
  address           TEXT NOT NULL,
  chains            INTEGER[] NOT NULL,
  circle_wallet_id  TEXT,
  import_source     TEXT NOT NULL DEFAULT 'onchain'
);

CREATE TABLE lots (
  id               TEXT PRIMARY KEY,
  agent_id         TEXT NOT NULL REFERENCES agents(id),
  asset_id         TEXT NOT NULL,
  chain_id         INTEGER NOT NULL,
  acquired_at      TIMESTAMPTZ NOT NULL,
  cost_basis_usd   NUMERIC(20, 8) NOT NULL,
  quantity         NUMERIC(30, 18) NOT NULL,
  source_tx        TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'open',  -- open|partial|closed
  provisional      BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE opportunities (
  id                    TEXT PRIMARY KEY,
  agent_id              TEXT NOT NULL REFERENCES agents(id),
  candidate_action      JSONB NOT NULL,
  llm_decision          TEXT,          -- EXECUTE|DEFER|SKIP
  llm_reasoning         TEXT,
  scheduled_action      JSONB,
  interim_action        TEXT,
  status                TEXT NOT NULL DEFAULT 'pending',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at            TIMESTAMPTZ
);

CREATE TABLE arc_records (
  id            TEXT PRIMARY KEY,
  agent_id      TEXT NOT NULL REFERENCES agents(id),
  lot_id        TEXT NOT NULL,
  description   TEXT NOT NULL,
  date_acquired DATE NOT NULL,
  date_sold     DATE NOT NULL,
  proceeds      NUMERIC(20, 8) NOT NULL,
  cost_basis    NUMERIC(20, 8) NOT NULL,
  gain_loss     NUMERIC(20, 8) NOT NULL,
  term          TEXT NOT NULL,           -- short|long
  tx_hash       TEXT NOT NULL,
  chain_id      INTEGER NOT NULL,
  rationale     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE llm_call_log (
  id              TEXT PRIMARY KEY,
  agent_id        TEXT,
  call_type       TEXT NOT NULL,        -- goal_parser|regime|action_reasoner|explanation
  prompt_version  TEXT NOT NULL,
  input           JSONB NOT NULL,
  output          JSONB NOT NULL,
  latency_ms      INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE regime_cache (
  agent_id    TEXT PRIMARY KEY,
  regime      JSONB NOT NULL,
  cached_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 11. Environment Variables

```bash
# ── API ──────────────────────────────────────────────────────────────────
DATABASE_URL=postgresql://user:pass@localhost:5432/taxee
REDIS_URL=redis://localhost:6379
PORT=3001

# ── LLM ──────────────────────────────────────────────────────────────────
ANTHROPIC_API_KEY=sk-ant-...

# ── Circle ───────────────────────────────────────────────────────────────
CIRCLE_API_KEY=...
CIRCLE_ENTITY_SECRET=...            # Server-side only — never expose to client
CIRCLE_ENVIRONMENT=sandbox          # sandbox | production

# ── Telegram ─────────────────────────────────────────────────────────────
TELEGRAM_BOT_TOKEN=...

# ── Chain RPCs ────────────────────────────────────────────────────────────
BASE_RPC_URL=https://mainnet.base.org
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
ETH_RPC_URL=https://...

# ── Contracts (Base) ──────────────────────────────────────────────────────
TAXEE_LOT_REGISTRY_ADDRESS=0x...
TAXEE_EXECUTOR_ADDRESS=0x...
USYC_ADDRESS=0x...                  # Base USYC token
USDC_ADDRESS=0x833589fCD6eDb6E08f4cEAA5e9...  # Base USDC

# ── Arc ───────────────────────────────────────────────────────────────────
ARC_API_KEY=...
ARC_API_URL=https://api.arc.io

# ── Prices ────────────────────────────────────────────────────────────────
COINGECKO_API_KEY=...               # Optional — free tier works for hackathon

# ── App ───────────────────────────────────────────────────────────────────
APP_URL=https://taxee.app
JWT_SECRET=...                      # SIWE session signing
MCP_API_KEY_SALT=...                # Per-agent MCP API key derivation

# ── Basescan (contracts) ──────────────────────────────────────────────────
BASESCAN_API_KEY=...
```

---

## 12. Getting Started

### Prerequisites

- Node 20+
- pnpm 9+
- Docker (for local PostgreSQL + Redis)
- Foundry (`curl -L https://foundry.paradigm.xyz | bash`)

### Install

```bash
git clone https://github.com/your-org/taxee
cd taxee
pnpm install
```

### Start local services

```bash
docker compose up -d   # PostgreSQL + Redis
```

### Database setup

```bash
pnpm --filter @taxee/api db:migrate
pnpm --filter @taxee/api db:seed       # loads fixture portfolio
```

### Run backend (all apps in parallel)

```bash
pnpm dev   # turbo: api + agent + telegram-bot hot-reload
```

### Run individual app

```bash
pnpm --filter @taxee/api dev
pnpm --filter @taxee/agent dev
pnpm --filter @taxee/telegram-bot dev
```

### Smart contracts (local)

```bash
cd contracts
forge build
forge test -vvv
forge script script/Deploy.s.sol --rpc-url $BASE_SEPOLIA_RPC_URL --broadcast
```

### Load demo fixture

```bash
pnpm --filter @taxee/api seed:demo
# Registers a demo agent with fixture portfolio (3 positions, varied holding periods)
# Agent ID printed to console — use in web dashboard or Telegram /start
```

---

## 13. Testing Strategy

| Module                | Approach                                                         | Command                          |
|-----------------------|------------------------------------------------------------------|----------------------------------|
| `packages/tax-engine` | Unit tests — pure functions, zero mocks, all edge cases          | `pnpm --filter @taxee/tax-engine test` |
| `packages/aggregator` | Integration tests against fixture + mocked Circle / Arc APIs     | `pnpm --filter @taxee/aggregator test` |
| `packages/llm`        | Snapshot tests on prompt + fixture input; assert Zod schema pass | `pnpm --filter @taxee/llm test`  |
| `packages/execution`  | Dry-run mode — build + simulate tx, do not broadcast             | `pnpm --filter @taxee/execution test` |
| `apps/api`            | Route tests with supertest + seeded DB                           | `pnpm --filter @taxee/api test`  |
| `contracts`           | Foundry unit + fuzz tests                                        | `forge test -vvv`                |
| End-to-end            | Feed fixture → run full cycle → assert opportunity + Arc write   | `pnpm e2e`                       |

**Tax engine test cases that MUST pass:**

```
✓ HIFO lot selector: picks highest-cost-basis lot first
✓ Harvest scanner: flags positions below threshold, skips above
✓ Wash sale detection: flags 30-day window correctly
✓ Maturation tracker: flags lots with < maturationBufferDays to LT
✓ Rebalance: HOLD when tax_cost > drift_cost
✓ Rebalance: REBALANCE when drift_cost > tax_cost
✓ Guardrails: LLM cannot override PARK on lots in maturation window
✓ Guardrails: action outside allowedActions returns null
```

---

## 14. Hackathon MVP Scope

### Day-by-day plan

| Day | Backend Deliverable                                                    |
|-----|------------------------------------------------------------------------|
| 1   | `packages/shared` types + DB schema + `POST /agents` registration API  |
| 1   | Fixture demo portfolio (`fixtures/demo-portfolio.json`) + seed script  |
| 2   | `packages/tax-engine` — harvest scanner + maturation tracker (with unit tests) |
| 2   | `apps/agent` heartbeat worker skeleton + BullMQ job per agent          |
| 3   | `packages/llm` — Action Reasoner (live Claude call, demo moment)       |
| 3   | `apps/telegram-bot` — `/start`, address capture, fixture import, notify card |
| 4   | Action loop API (`/actions/:id/execute|defer|skip`) + TG callback handler |
| 4   | `packages/notifications` — TG send + OpportunityNotification formatter |
| 5   | `packages/compliance` — Arc write stub + Form 8949 projection          |
| 5   | `packages/execution` — Circle Wallets read (watch tier) + dry-run simulate |
| 6   | `apps/mcp-server` skeleton — `taxee_scan` + `taxee_list_opportunities`  |
| 6   | Demo rehearsal: TG notify → Defer → explanation card → dashboard show  |

### Explicitly out of MVP scope

- Full onchain lot reconstruction (fixture + `provisional: true` flag is sufficient)
- Full cross-chain CCTP execution (stub only)
- Email / push notifications (TG + web sufficient)
- Production key custody (watch tier default; Circle execute for one demo tx only)
- Multi-jurisdiction tax rules (US federal only)

---

## Key Design Rules (TL;DR for contributors)

1. **LLM receives structured inputs, returns structured outputs.** No free-form text parsed for decisions. Every output validated against a Zod schema.
2. **tax-engine is pure TypeScript.** No API calls, no side effects, all unit-testable.
3. **Code enforces guardrails. LLM cannot bypass policy.** `validateApprovedAction` runs in code before any execution.
4. **Lots are the unit of truth.** Every disposal tracks the exact lot: acquisition date, cost basis, quantity, chain.
5. **Fail closed on tax ambiguity.** Unknown lot identity or holding period → defer, not execute.
6. **taxee never stores private keys.** Watch tier = address only. Execute tier = Circle Wallet (MPC). TG bot never asks for seed phrases.
7. **Every LLM call is logged.** `promptVersion + input + output` in `llm_call_log` — essential for debugging and compliance.
8. **Arc write is non-negotiable.** Every executed disposal writes to Arc before the agent considers the action complete.
