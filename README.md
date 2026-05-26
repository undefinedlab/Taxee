# Taxee

> **The DeFi portfolio agent that maximizes after-tax returns, not just gross performance.**  

---

## Table of Contents

1. [What Is Taxee](#1-what-is-taxee)
2. [System Architecture Overview](#2-system-architecture-overview)
   - [Circle Stack Integration](#circle-stack-integration)
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

**Taxee** embeds tax awareness as a first-class input into every agent decision:

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
│  Decision Engine  (deterministic)                        │
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

### Circle Stack Integration

How taxee uses each Circle product in production.

#### Programmable Wallets (user-controlled MPC)

**Goal:** Let a Telegram-only user create a self-custodial wallet without a seed phrase, then have taxee execute transactions on their behalf only after PIN confirmation.

**Build:**

- **Backend** (`backend/packages/aggregator/circleClient.ts`, `backend/apps/api/src/routes/circle.ts`) wraps the Circle W3S API. The entity secret is RSA-OAEP-SHA256 encrypted per request and never leaves the backend.
- **Onboarding** — when a user registers, the API calls `POST /v1/w3s/users` to register a Circle user keyed by the agent UUID, then issues a one-shot `userToken` + `encryptionKey` + `challengeId` for PIN setup.
- **Frontend** (`frontend/app/setup-wallet/page.tsx`, `frontend/components/wallet/circle-wallet-setup.tsx`) loads `@circle-fin/w3s-pw-web-sdk`, opens the PIN overlay, and creates the MPC wallet on Arc Testnet (`ARC-TESTNET` blockchain ID).
- **Execution** — when the agent decides to act, the backend creates an execution challenge (`POST /circle/challenge/:oppId`); the user opens `/execute`, taps Confirm, and Circle MPC nodes co-sign and broadcast.

**Key design:** taxee never holds the user's key. Every disposal requires a fresh challenge → PIN → MPC signature; there is no long-lived authority on the Circle side.

#### Arc — execution + compliance ledger

**Goal:** Use Arc as both an EVM execution chain (cheap, fast, USDC-native gas) and an append-only audit trail that backs every Form 8949 line item.

**Build:**

- **Execution chain** — custom contracts (`LotRegistry`, `Executor`, `DelegationRegistry`, `TaxeeManager`) deploy to Arc Testnet (chain `5042002`). USDC is native gas on Arc; Circle Programmable Wallets sign USDC-paid transactions with no ETH gas wallet.
- **Compliance ledger** — every executed disposal writes `ArcRecord { lotId, dateAcquired, dateSold, proceeds, costBasis, gainLoss, term, txHash, rationale }` via `backend/packages/aggregator/arcClient.ts`, then anchors `keccak256(ArcRecord)` on-chain via `TaxeeLotRegistry.commitDisposal`.
- **Form 8949 export** — `backend/packages/compliance` aggregates Arc records per agent / tax year, splits ST vs LT, and exports CSV.

Arc is the system of record (rich, queryable); the on-chain lot hash makes each record non-repudiable.

#### CCTP — cross-chain USDC

**Goal:** When taxee harvests on Base and parks proceeds in USYC (or rebalances to Arc), USDC moves natively — no wrapped tokens or drainable bridges.

**Build:** `backend/packages/execution/cctp.ts` wraps `depositForBurn` on the source TokenMessenger, polls the Circle Iris attestation API, then `receiveMessage` on the destination MessageTransmitter. Circle Programmable Wallets call `depositForBurn` directly — no separate relayer.

Per-chain addresses and CCTP domain numbers live in `backend/packages/execution/chainConfig.ts`:

| Chain            | chainId  | CCTP Domain | TokenMessenger                                      |
|------------------|----------|-------------|-----------------------------------------------------|
| Ethereum         | 1        | 0           | `0xbd3fa81b58ba92a82136038b25adec7066af3155`        |
| Ethereum Sepolia | 11155111 | 0           | `0x9f3b8679c73c2fef8b59b4f3444d4e156fb70aa5`        |
| Base             | 8453     | 6           | `0x1682ae6375c4e4a97e4b583bc394c861a46d8962`        |
| Base Sepolia     | 84532    | 6           | `0x9f3b8679c73c2fef8b59b4f3444d4e156fb70aa5`        |
| Arbitrum         | 42161    | 3           | (see `chainConfig.ts`)                              |
| Arc Testnet      | 5042002  | 7           | (Circle Iris)                                       |

#### Paymaster — gasless UX

**Goal:** New users should not need a separate ETH gas wallet before their first action.

**Build:** On Arc, USDC-native gas makes Paymaster optional (primary execution chain). On Base / Base Sepolia, `backend/packages/execution/executeOpportunity.ts` uses ERC-4337 with Circle Paymaster (`CIRCLE_PAYMASTER_WALLET_ID` in `backend/.env`) so gas is paid in USDC from the same balance being rebalanced.

#### USYC — yield while parked

**Goal:** When a lot is near the 365-day long-term threshold (or a wash-sale window must close), park capital in USYC (Hashnote / BlackRock USD Institutional Digital Liquidity) instead of leaving it idle.

**Build:** `TaxeeExecutor.parkInUsyc(usdcAmount, lotId, agent)` atomically transfers USDC, approves USYC, deposits, and emits `ParkedInUsyc`. `redeemFromUsyc(shares)` reverses when the lot matures. On testnet, `USYC_ADDRESS == USDC_ADDRESS` (pass-through); mainnet uses Hashnote USYC on Base.

#### EIP-7702 — self-custody delegation

**Goal:** MetaMask / Rainbow users delegate execution to `TaxeeManager` via signature without moving funds into Circle MPC.

**Build:** `DelegationRegistry` stores delegation limits and revocation; `TaxeeManager` executes harvest / rebuy / yield-move with slippage and cooldown guardrails; `backend/packages/execution/eip7702Executor.ts` is the heartbeat path for EIP-7702 agents; signing lives in `frontend/components/wallet/use-taxee-contracts.ts`.

#### Deployed contracts (authoritative)

Source: `contracts/deployments/` (one JSON per chain, written by Forge script).

**Arc Testnet** — chainId `5042002` (primary execution chain)

| Contract           | Address                                      |
|--------------------|----------------------------------------------|
| TaxeeLotRegistry   | `0x0a4aa21D151635e16DD659ad607Eb6cFD11E27A1` |
| DelegationRegistry | `0xbC8E45D8314EA7b46CaE4de0856d28262b3b244d` |
| TaxeeManager       | `0xd335C4B56Ac9664413120f21c10b9F7aaC651AE0` |
| TaxeeExecutor      | `0x7fD85458A0958C5EB52234f3FF4f0C6bf7cC999c` |
| USDC (native gas)  | `0x0000000000000000000000000000000000000000` |

RPC: `https://rpc.testnet.arc-node.thecanteenapp.com/v1/...`

**Ethereum Sepolia** — chainId `11155111`

| Contract           | Address                                      |
|--------------------|----------------------------------------------|
| DelegationRegistry | `0x786D17590AF61F06d6BBc2B77621a72a25F4A527` |
| TaxeeManager       | `0x919B8F07Ec889922AE08BA8CC64C43aaA9a34A37` |
| USDC               | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` |
| WETH               | `0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14` |

**Base Sepolia** — chainId `84532`

| Contract                        | Address                                      |
|---------------------------------|----------------------------------------------|
| DelegationRegistry (EIP-7702)   | `0x403Fe0408976b518b2952BdF590135Ec6ba12ebc` |
| TaxeeManager (EIP-7702)         | `0xEE8DAE2D3f142052bDb704Ba0D94e04eC1680193` |
| USDC                            | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| WETH                            | `0x4200000000000000000000000000000000000006` |

Full per-chain config (CCTP domains, RPC env vars, explorer URLs): `backend/packages/execution/chainConfig.ts`.

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
│   ├── aggregator/              # Data Aggregator — Circle Wallets, Arc, oracles, signals
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
│   ├── index.ts                  # Worker entry pointt
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
6. [delegated] guardrail check → Execution Layer → Arc → notify (receipt)
7. [manual]    emit OpportunityNotification with buttons → await user
8.  LLM Explanation          → dashboard card + notification body
```

**Job queue:** Inngest preferred (durable, retryable, per-agent fan-out). BullMQ as fallback.

---

### 4.3 `apps/telegram-bot`

Telegram bot handles frictionless onboarding and is the primary notification channel.

**Responsibilities:**
- `/start` → welcome + command overview
- Accept wallet address → live balance scan + lot import + heartbeat trigger
- **Multi-wallet:** each address sent creates a new independent agent
- `/wallets` → list all linked wallets with pending opportunity counts
- `/status` → per-wallet agent status
- `/opportunities` → pending actions across all wallets, labeled per wallet
- `/mode manual|delegated` → updates all wallets simultaneously
- Rich opportunity notifications → inline **[✅ Approve] [⏰ Defer] [❌ Skip]** buttons

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

**Wallet flow (triggered by any 0x address message):**
```
User sends: 0xabc...
  → Create user (telegramId) + wallet record + agent for that wallet
  → 🔍 Scan live balances across 4 chains (Alchemy)
  → 💼 Display: asset · quantity · price · USD value per chain
  → 📚 Import transfer history → tax lots with cost basis (Alchemy + CoinGecko)
  → 🧠 Trigger heartbeat (background) → Claude analysis → push notification

User sends another address:
  → Second wallet + independent agent created
  → Same scan pipeline runs for the new wallet
```

**Security:** Never requests seed phrases. `telegramId` bound to `userId` in DB. Each wallet address is checksummed and lowercased before storage.

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
| Alchemy RPC       | Live ETH + ERC-20 balances, transfer history    | `balanceReader.ts` + `lotImporter.ts` |
| CoinGecko         | Current prices + historical prices at lot acquisition | `priceAggregator.ts` |
| Arc Ledger        | Cost basis per lot, YTD realized G/L (execution path) | Arc REST API |
| Onchain Signals   | Funding rates, vol, stablecoin flows, ETH/BTC   | Defillama + Glassnode stubs |

**Chains supported:** Ethereum mainnet (1), Ethereum Sepolia (11155111), Base mainnet (8453), Base Sepolia (84532)

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
  type: "HARVEST" | "REBALANCE" | "PARK" | "HOLD"
  headline: string                       // Claude-generated, leads with $ saving
  explanationBody: string                // Claude 2-4 sentence plain-English explanation
  taxSavingEstimate: number
  llmReasoning: string                   // Full action reasoner reasoning chain
  approvalMode: "manual" | "delegated"
  buttons?: ["execute", "defer", "skip"]  // manual mode only
  autoExecuteAt?: Date                   // delegated + veto window
  // Position context (populated from real lot data)
  assetSymbol?: string
  quantity?: number
  costBasisUsd?: number
  currentValueUsd?: number
  unrealizedPct?: number
  daysHeld?: number
  // Strategy-specific
  replacementAsset?: string              // HARVEST: correlated replacement
  washSaleDaysRemaining?: number         // HARVEST: 0 = clear
  daysToLongTerm?: number                // PARK: days until LT threshold
  currentAllocationPct?: number          // REBALANCE: current weight
  targetAllocationPct?: number           // REBALANCE: target weight
  regime?: string                        // REBALANCE: market regime label
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
users             Telegram identity (telegramId, address nullable)
wallets           Per-user wallet addresses with labels (Wallet 1, 2, ...)
agents            One per wallet — walletAddress, policy JSONB, approvalMode
lots              Tax lots — assetId, chainId, quantity, costBasisUsd, acquiredAt, txHash
opportunities     LLM decision + reasoning + headline + body + taxSavingEstimate
llm_logs          Every Claude call — promptVersion, model, tokens, latency, raw output
heartbeats        Per-agent scan history — triggeredAt, opportunitiesFound, actionsExecuted
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
-- Actual Drizzle ORM schema (packages/db/src/schema.ts)

CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address     TEXT UNIQUE,                          -- nullable (multi-wallet users may have none)
  telegram_id TEXT UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE wallets (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  address    TEXT NOT NULL,
  label      TEXT NOT NULL DEFAULT 'Wallet',        -- Wallet 1, Wallet 2, ...
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, address)
);

CREATE TABLE agents (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_address   TEXT,                             -- the wallet this agent watches
  circle_wallet_id TEXT,
  name             TEXT NOT NULL DEFAULT 'My taxee Agent',
  status           agent_status NOT NULL DEFAULT 'setup',  -- active|paused|setup
  approval_mode    approval_mode NOT NULL DEFAULT 'manual', -- manual|delegated
  policy           JSONB NOT NULL DEFAULT '{}',      -- UserPolicy JSON
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE lots (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id       UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  asset_id       TEXT NOT NULL,
  chain_id       INTEGER NOT NULL,
  quantity       NUMERIC(36, 18) NOT NULL,
  cost_basis_usd NUMERIC(20, 4) NOT NULL,
  acquired_at    TIMESTAMPTZ NOT NULL,
  status         lot_status NOT NULL DEFAULT 'open',  -- open|partial|closed
  tx_hash        TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE opportunities (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id             UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  type                 action_type NOT NULL,          -- HARVEST|REBALANCE|PARK|HOLD
  llm_decision         llm_decision NOT NULL,         -- EXECUTE|DEFER|SKIP
  llm_reasoning        TEXT NOT NULL,
  estimated_tax_impact NUMERIC(20, 4) NOT NULL,
  headline             TEXT NOT NULL,                 -- Claude-generated
  body                 TEXT NOT NULL,                 -- Claude-generated explanation
  tax_saving_estimate  NUMERIC(20, 4) NOT NULL DEFAULT 0,
  defer_days           INTEGER,
  interim_action       TEXT,
  arc_record_id        TEXT,
  tx_hash              TEXT,
  prompt_version       TEXT NOT NULL,
  executed_at          TIMESTAMPTZ,
  approved_at          TIMESTAMPTZ,
  deferred_until       TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE llm_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        UUID REFERENCES agents(id) ON DELETE SET NULL,
  opportunity_id  UUID REFERENCES opportunities(id) ON DELETE SET NULL,
  prompt_version  TEXT NOT NULL,
  model           TEXT NOT NULL,
  input_tokens    INTEGER NOT NULL,
  output_tokens   INTEGER NOT NULL,
  latency_ms      INTEGER NOT NULL,
  input_hash      TEXT NOT NULL,
  output_raw      TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE heartbeats (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id            UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  triggered_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at        TIMESTAMPTZ,
  opportunities_found INTEGER NOT NULL DEFAULT 0,
  actions_executed    INTEGER NOT NULL DEFAULT 0,
  error_message       TEXT
);
```

---

## 11. Environment Variables

```bash
# ── API ──────────────────────────────────────────────────────────────────
DATABASE_URL=postgresql://user:pass@localhost:5432/taxee
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

# ── On-chain data ────────────────────────────────────────────────────────
ALCHEMY_API_KEY=...                 # Required for live balance + lot import

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
# No seed needed — real data is imported live from Alchemy when wallet is linked
# To reset all data: npx tsx apps/api/src/db/reset.ts
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

### Trigger a manual heartbeat scan

```bash
# Runs one full pipeline cycle for all active agents and sends Telegram notifications
export $(grep -v '^#' .env | xargs) && pnpm --filter @taxee/agent dev:trigger
```

---

## 13. Testing Strategy

| Layer              | What to run                                              |
|--------------------|----------------------------------------------------------|
| `packages/tax-engine` | Unit tests — pure functions, no mocks (`pnpm test`)   |
| `contracts`        | Foundry (`forge test -vvv`)                              |
| `apps/api`         | Route + DB integration tests against local Postgres      |
| `apps/agent`       | Heartbeat dry-run via `dev:trigger` on demo portfolio    |
| E2E                | Onboarding → scan → manual approve → Arc record written  |

Deterministic engine tests are the highest-value suite: they guard harvest thresholds, HIFO selection, and rebalance math without LLM variance.

---

## 14. Hackathon MVP Scope

**In scope**

- Register agent (web + Telegram) with manual or delegated approval
- Live portfolio import (Alchemy + CoinGecko) across Ethereum / Base testnets
- Heartbeat scan → LLM reasoner → opportunity notification
- Circle MPC wallet onboarding + PIN-gated execution
- Arc disposal record + Form 8949 CSV export
- Dashboard: opportunities, reasoning chain, portfolio snapshot

**Out of scope (post-hackathon)**

- Multi-jurisdiction tax rules beyond US Form 8949 framing
- Production mainnet deploy on all chains
- Full Glassnode / advanced regime data feeds


