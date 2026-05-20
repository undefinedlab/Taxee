# taxee — System Architecture

How to build a DeFi portfolio agent that optimizes **after-tax return**, not gross performance.

**Core split:** deterministic code does math; the LLM does judgment on structured inputs.

---

## 1. Design Principles

| Principle | Implication |
|-----------|-------------|
| Tax is a first-class input | Every rebalance, rotation, and harvest decision runs through a tax-cost model before execution |
| Lots are the unit of truth | Positions decompose into identifiable tax lots (acquisition date, cost basis, quantity, chain) |
| Code computes, LLM judges | Thresholds, drift, lot selection, and gain/loss math are deterministic; ambiguous trade-offs go to the LLM |
| Cross-chain is native | Portfolio state aggregates across chains; execution routes through Circle CCTP / Gateway |
| Auditability by default | Every disposal is logged to Arc with lot selection rationale — Form 8949 is a projection, not an afterthought |
| Fail closed on tax ambiguity | If lot identity or holding period is unknown, defer or split rather than realize at worst-case rates |
| User chooses approval mode | **Manual** — approve each action (Execute / Defer / Skip). **Delegated** — agent acts autonomously within policy guardrails |
| Frictionless onboarding | Register once (wallet + history + prefs + approval mode); heartbeat runs forever without re-setup |

---

## 2. Architecture Overview

End-to-end pipeline from user intent to dashboard explanation:

```
User Goal (natural language)
        ↓
   LLM Goal Parser                    ← translate intent → policy constraints
        ↓
   Data Aggregator                     ← Circle Wallets + Arc + Price Oracles
        ↓
  LLM Regime Classifier                ← classify risk-on / risk-off from mixed signals
        ↓
   Decision Engine (deterministic)     ← flag candidate actions (rebalance, harvest, park)
        ↓
   LLM Action Reasoner                  ← execute, defer, or substitute — the judgment layer
        ↓
  Execution Layer (Circle stack)        ← Wallets, CCTP, USYC, Paymaster
        ↓
   Arc Ledger Write                    ← immutable record → Form 8949 pre-fill
        ↓
   LLM Explanation → Dashboard         ← plain-English rationale for every action
```

### What LLM does vs what code does

| Task | Owner |
|------|-------|
| Parse natural-language goals ("maximize after-tax return, avoid ST gains") | **LLM** |
| Regime classification from mixed onchain signals | **LLM** |
| Harvest threshold math (`unrealized_loss > −8%`) | **Code** |
| Edge-case judgment (wash sale + regime + gas cost) | **LLM** |
| Lot selection (HIFO / specific-ID) | **Code** |
| Rebalance drift vs tax cost calculation | **Code** |
| "Should we act now or defer?" | **LLM** |
| Plain-English explanation to user | **LLM** |
| Transaction execution | **Circle stack** |

The LLM is not doing math. It receives structured inputs and applies judgment — which is exactly what it's good at.

The pipeline above runs inside a **hosted heartbeat** (always-on scan) or is invoked on-demand via **MCP** from a user's own OpenClaw-style agent. User flows (§3–§7) define how people register, get notified, and approve actions.

---

## 3. User Lifecycle — Three Phases

taxee is an **always-on agent** attached to a registered wallet (or wallet set). The user experience splits into three phases:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  PHASE 1 — ONCE (Onboarding)                                                │
│                                                                             │
│   Connect wallet(s)  →  Import history  →  Set preferences  →  Done         │
│   (SIWE / Circle)       (CSV / onchain)    (jurisdiction,      (never       │
│                                             thresholds)        again)       │
└─────────────────────────────────────────────────────────────────────────────┘
                                      ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│  PHASE 2 — ALWAYS ON (Heartbeat)                                            │
│                                                                             │
│   Hourly scan  →  Agent reasons  →  Nothing? → wait, rescan                 │
│   prices, lots,      harvest?         │                                     │
│   regime              rebalance?       └── Opportunity? → NOTIFY USER       │
│                       park?                    (TG · email · push · MCP)    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│  PHASE 3 — ACTION LOOP (Human approves)                                     │
│                                                                             │
│   Manual: [ Execute ] [ Defer ] [ Skip ]   —or—   Delegated: auto-execute │
│         ↓                                                                   │
│   Circle Wallets  →  Arc records  →  USYC parks if needed  →  Confirmed     │
│   notify user (always) + LLM explanation                                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

| Phase | User effort | System behavior |
|-------|-------------|-----------------|
| **Once** | ~2 minutes | Bind identity, import lots, set policy — then never repeat |
| **Always on** | Zero | Heartbeat scans portfolio; LLM reasons; surfaces opportunities only |
| **Action loop** | Optional | **Manual:** Execute / Defer / Skip per opportunity. **Delegated:** agent executes when LLM + policy clear; user notified (can override/veto in UI) |

---

## 4. Onboarding & Agent Registration

Goal: **frictionless registration** — wallet linked, history imported, agent running, reachable from any surface the user prefers.

### 4.1 Registration surfaces

| Surface | Flow | Best for |
|---------|------|----------|
| **Web app** | Connect wallet (SIWE) → import CSV or onchain scan → set prefs → agent spawned | Power users, demo |
| **Telegram bot** | `/start` → link wallet (deep link or paste address) → auto-import onchain history → prefs via chat | Mobile-first, lowest friction |
| **MCP / OpenClaw** | User's agent calls `taxee_register_wallet` → returns `agentId` + webhook URL | Developers, custom flows |

All surfaces write to the same **`Agent` record** in the backend — one wallet set, one heartbeat, many notification channels.

### 4.2 Telegram bot — onboarding angle

Telegram is a strong hackathon/demo channel: users already live there; no app install.

**Proposed TG flow:**

```
User: /start
Bot:  Welcome to taxee. I'll watch your portfolio for tax-smart moves.
      Send your wallet address (or tap to connect via WalletConnect link).

User: 0xabc... 
Bot:  Scanning onchain history on Base + Ethereum… (30–60s)
Bot:  Found 4 positions, 12 lots. Estimated YTD gains: $8,400.
      Jurisdiction? [US] [Other]
      Harvest when loss exceeds? [5%] [8%] [10%]

User: US, 8%
Bot:  Agent active. Heartbeat every hour. I'll message you when there's something to do.
      Dashboard: https://taxee.app/a/{agentId}
```

**Auto-import on registration:**
- Read-only RPC/indexer: reconstruct transfers → provisional lots
- User can upload CSV to correct cost basis (optional, post-registration)
- Arc stores canonical lots after first confirmed disposal

**TG is notification + lightweight approval**, not key custody — see §7.

### 4.3 `Agent` entity (backend)

```typescript
Agent {
  id: string
  userId: string
  status: "pending" | "active" | "paused"
  wallets: WalletBinding[]
  policy: UserPolicy
  approval: ApprovalSettings        // manual vs delegated — user choice at onboarding
  deploymentMode: "hosted" | "mcp"
  notificationChannels: Channel[]
  heartbeatIntervalMinutes: 60
  createdAt: timestamp
}

ApprovalSettings {
  mode: "manual" | "delegated"
  autoApproveTypes?: ("HARVEST" | "REBALANCE" | "PARK")[]  // delegated: default all in policy
  notifyOnExecute: boolean          // default true — post-action receipt even when autonomous
  vetoWindowSeconds?: number        // optional: notify-first, auto-execute after N sec unless Skip
}

WalletBinding {
  address: string
  chains: number[]
  circleWalletId?: string           // only if execution mode uses Circle Wallets
  importSource: "onchain" | "csv" | "manual"
}
```

### 4.4 Agent spawn (after onboarding)

On `Done`:
1. Persist `Agent` + `WalletBinding`(s) + imported lots
2. Enqueue first heartbeat job
3. Register notification webhooks (TG chat id, optional email)
4. Return deep link: dashboard + TG "View portfolio" button

User never configures cron or infrastructure — **registration = agent is live**.

---

## 5. Deployment Modes — Hosted vs MCP / OpenClaw

Two ways to run the same taxee brain:

```
                    ┌─────────────────────────────────────┐
                    │         taxee Core (shared)          │
                    │  Aggregator · Decision · LLM · Arc   │
                    └──────────────┬──────────────────────┘
                                   │
              ┌────────────────────┴────────────────────┐
              ▼                                         ▼
   ┌──────────────────────┐               ┌──────────────────────┐
   │  MODE A: Hosted       │               │  MODE B: MCP Bridge    │
   │  (OpenClaw-style)     │               │  (Bring your agent)    │
   │                       │               │                        │
   │  taxee runs heartbeat │               │  User's OpenClaw /     │
   │  on our infra         │               │  Claude Desktop agent  │
   │  TG + web notify      │               │  calls taxee MCP     │
   │  Circle executes      │               │  tools on demand       │
   └──────────────────────┘               └──────────────────────┘
```

| Aspect | **Hosted (Mode A)** | **MCP / OpenClaw (Mode B)** |
|--------|---------------------|-----------------------------|
| Who runs the loop | taxee worker (hourly cron) | User's agent invokes tools |
| Notifications | TG, email, push, web | MCP tool results → user's channel |
| Execution | Circle Wallets on our side (with user approval) | `taxee_propose_action` → user agent asks human → `taxee_execute` |
| Best for | Default retail UX | Power users, custom workflows, multi-agent stacks |
| Registration | Web or TG bot | `taxee_register_agent` MCP tool |

### 5.1 MCP toolset (sketch)

Expose taxee as an MCP server so external agents can participate without hosted heartbeat:

| Tool | Purpose |
|------|---------|
| `taxee_register_wallet` | Bind address, trigger history import, return `agentId` |
| `taxee_get_portfolio` | Current snapshot + lots + YTD realized |
| `taxee_scan` | Run one heartbeat cycle (decision engine + LLM reasoner) |
| `taxee_list_opportunities` | Pending `CandidateAction`s awaiting approval |
| `taxee_approve_action` | Execute / defer / skip by action id |
| `taxee_get_arc_records` | Compliance export for user's agent to summarize |

Hosted mode uses the same tools internally; MCP mode exposes them to the user's OpenClaw instance.

### 5.2 Custom flows (OpenClaw)

Power users compose taxee into larger automations:

```
OpenClaw agent:
  1. taxee_scan(agentId)
  2. if opportunities → post to Slack + ask human
  3. on approval → taxee_approve_action(id, "execute")
  4. summarize Arc record → weekly tax report Notion page
```

taxee does not need to own the notification channel in this mode — the parent agent does.

---

## 6. Notifications & Action Loop

Approval is **user-configurable**. The same opportunity flows through either path depending on `ApprovalSettings.mode`.

### 6.1 Approval modes

| Mode | Behavior | Best for |
|------|----------|----------|
| **Manual** | Agent proposes → user must Execute / Defer / Skip before any tx | First-time users, large tax impact, learning the agent |
| **Delegated** | Agent executes autonomously when Decision Engine + LLM Reasoner agree and policy guardrails pass | Set-and-forget, OpenClaw-style always-on, power users |

Delegated does not mean reckless: code still enforces `UserPolicy`, maturation parking, max tax per action, and allowed action types. The LLM cannot bypass guardrails.

Optional hybrid: **notify-first delegated** — emit notification with `vetoWindowSeconds` (e.g. 300); auto-execute unless user taps Skip within window.

### 6.2 Notification payload

```typescript
OpportunityNotification {
  agentId: string
  actionId: string
  type: "HARVEST" | "REBALANCE" | "PARK"
  headline: string
  taxSavingEstimate: number
  llmReasoning: string
  approvalMode: "manual" | "delegated"
  buttons?: ["execute", "defer", "skip"]     // manual only
  autoExecuteAt?: timestamp                // delegated + veto window
  deferOptions?: { days: 12, reason: string }
  dashboardUrl: string
}
```

**Manual example:**

> Harvest opportunity — wETH down $600, save ~$180 tax.  
> [Execute] [Defer 12d] [Skip]

**Delegated example:**

> Executed autonomously — parked wETH in USYC while wash sale window closes. Harvest scheduled Jun 1. Est. saving $180.  
> [View in dashboard] [Undo not supported — Defer future actions in settings]

### 6.3 Channel matrix

| Channel | Onboarding | Notify | Manual approve | Delegated execute |
|---------|------------|--------|----------------|-------------------|
| **Web dashboard** | ✓ | ✓ | ✓ | ✓ + mode toggle |
| **Telegram** | ✓ bot | ✓ | inline buttons | post-action receipt |
| **MCP** | via tool | user's agent | `taxee_approve_action` | `taxee_scan` auto-runs pipeline |

### 6.4 Action loop state machine

**Manual path:**

```
OPPORTUNITY_DETECTED → notify → await_user_decision
  EXECUTE → execution → Arc → confirmation notify
  DEFER   → schedule re-check
  SKIP    → dismiss, cooldown 7d
```

**Delegated path:**

```
OPPORTUNITY_DETECTED
  → LLM Action Reasoner → decision EXECUTE | DEFER | SKIP
  → if EXECUTE and policy OK → execution layer → Arc → notify (receipt + reasoning)
  → if DEFER → schedule (no user tap required)
  → if SKIP → dismiss

optional veto window:
  → notify first → wait vetoWindowSeconds → auto-execute unless SKIP
```

User can switch `approval.mode` anytime in dashboard or TG `/mode manual|delegated`.

---

## 7. Identity & Key Management

The hardest onboarding question: **who holds keys, and what can taxee actually sign?**

### 7.1 Recommended model (hackathon → production)

**Tiered capability — start read-only, upgrade to execute:**

| Tier | Keys | Agent can | User gives |
|------|------|-----------|------------|
| **Watch** | User keeps all keys | Scan, reason, notify | Address(es) only |
| **Execute** | Circle Programmable Wallets or session key | Execute approved txs | Wallet creation / delegation via Circle |
| **Bring-your-own** | User's OpenClaw holds keys | taxee proposes only | MCP connection, no keys to taxee |

**Default onboarding = Watch tier.** User registers an address; taxee imports history and runs heartbeat with zero custody friction. Execute tier is opt-in when they first tap **Execute**.

### 7.2 Option comparison

| Model | Friction | Security | Execute? | Notes |
|-------|----------|----------|----------|-------|
| **Address-only (watch)** | Lowest | Highest | No — notify only | TG bot works day one; user executes in their own wallet |
| **Circle Programmable Wallet** | Medium | Strong — MPC, policies | Yes | User creates/funds Circle wallet; taxee signs via API with spend limits |
| **Session key / smart wallet** | Medium | Good — scoped permissions | Yes | Delegate limited swap permissions on Base etc. |
| **Export private key to taxee** | Low | **Never** | Yes | ❌ Exclude — unacceptable for DeFi product |
| **MCP / OpenClaw BYO** | Low for devs | User owns keys | User's agent signs | taxee never sees keys; `approve_action` returns unsigned tx or Circle job id |

### 7.3 Telegram + keys (explicit)

**The TG bot must NOT ask for seed phrases or private keys.**

| TG can do | TG must not do |
|-----------|----------------|
| Accept **public address** for watch mode | Request seed phrase / private key |
| Deep-link to **WalletConnect** for Circle wallet setup | Store signing material in chat logs |
| Relay **Execute** as API call to Circle (server-side) | Broadcast txs with bot-held hot wallet |

Flow for execute via TG:

```
User taps [Execute] on harvest card
  → API validates agentId + actionId + TG user binding
  → If watch-only: return "Connect execution wallet" link (Circle onboarding)
  → If execute-enabled: Circle Wallets API signs tx (HIFO lot manifest)
  → Arc write + TG confirmation message
```

### 7.4 Circle Wallets as execution layer

Aligns with existing stack:

1. **Onboarding (execute tier):** User completes Circle wallet creation (web or WC link from TG)
2. **Funding:** User bridges/sends assets to Circle wallet OR authorizes delegation from existing wallet (product decision)
3. **Policy guardrails:** Max tx size, allowed contracts (USYC, DEX routers), daily spend cap — enforced in code before Circle API call
4. **Signing:** Server calls Circle API with **entity secret / API key** (taxee infra), not user private key in chat

taxee stores: `circleWalletId`, policy limits, **never** user seed.

### 7.5 History import without keys

Auto-import on registration is **read-only**:

- Indexer / RPC: `eth_getLogs`, transfer traces, DEX swap events
- Heuristic lot reconstruction → `provisional: true` flag
- User confirms or uploads CSV before first tax-critical execution

### 7.6 MCP / OpenClaw key model

```
User's machine (OpenClaw)
  ├── holds signing keys or Circle session
  └── calls taxee MCP (API key per agentId, read/write scoped)

taxee cloud
  ├── no user private keys
  └── returns Proposal + tx payload OR Circle job reference
```

User's agent decides whether to sign locally. taxee stays propose-only unless hosted execute tier is enabled.

---

## 8. Building Blocks

### 8.1 Data Aggregator

**Responsibility:** Pure data plumbing. Everything the agent needs before it can act. No LLM.

| Source | Data |
|--------|------|
| **Circle Wallets** | Balances across chains, per-asset quantities |
| **Arc ledger** | Cost basis per lot — acquisition date, price paid, holding period; realized G/L YTD |
| **Price oracles** | Current mark-to-market for unrealized G/L |
| **Onchain signals** | Funding rates, volatility index, stablecoin inflows, ETH/BTC ratio |

**Output:** a single `PortfolioSnapshot` consumed by downstream layers.

```typescript
PortfolioSnapshot {
  positions: Position[]       // balances + lots per chain
  prices: Record<assetId, usd>
  realizedYtd: { shortTerm, longTerm, lossesHarvested }
  regimeSignals: RegimeSignals
  userPolicy: UserPolicy      // from Goal Parser
}

Position {
  assetId: string
  chainId: number
  quantity: Decimal
  lots: Lot[]
}

Lot {
  id: string
  acquiredAt: timestamp
  costBasisUsd: Decimal
  quantity: Decimal
  sourceTx: string
  status: open | partial | closed
  holdingPeriodDays: number   // derived daily
}
```

**Implementation:**
- Poll Circle Wallets API on interval (or webhook on balance change)
- Read lot history + YTD realized G/L from Arc (write path separate — see §8.6)
- Fetch prices from CoinGecko / Chainlink / Pyth
- Collect regime signals into a structured `RegimeSignals` object — no classification yet

---

### 8.2 LLM Goal Parser

**Responsibility:** Translate natural-language user goals into machine-readable policy constraints.

**Input:** `"I want to minimize taxes this year. Don't sell anything with less than 30 days to long-term. Harvest losses aggressively."`

**Output:**

```typescript
UserPolicy {
  primaryObjective: "minimize_tax" | "maximize_return" | "balanced"
  harvestThresholdPct: -8
  maturationBufferDays: 30      // don't dispose lots within N days of LT threshold
  rebalanceAggressiveness: "conservative" | "moderate" | "aggressive"
  allowedActions: ["harvest", "rebalance", "park"]
}
```

**Implementation:**
- Single Claude API call on onboarding or when user updates preferences
- Structured output (JSON schema / tool use) — never free-form policy
- Stored in DB; re-read by Decision Engine on every cycle

---

### 8.3 LLM Regime Classifier

**Responsibility:** Classify market regime from structured onchain signals. First place the LLM earns its keep.

**Input (structured, not raw chain data):**

```
BTC funding rate:     +0.08%  (elevated, leveraged longs)
Stablecoin supply Δ7d: -2.1%   (capital leaving)
Realized vol 30d:      68%
Fear & Greed index:    31     (fear)
ETH/BTC ratio trend:   declining
```

**Output:**

```typescript
RegimeState {
  label: "risk-off" | "risk-on" | "neutral"
  confidence: 0.78
  reasoning: "Funding elevated but stablecoin outflows and declining ETH/BTC suggest de-risking..."
  targetAllocationDelta: { ETH: -0.10, USDC: +0.10 }
}
```

**Why LLM over rules:** A rules engine handles clear cases. The LLM handles ambiguous middle ground — signals pointing in different directions — better than hard thresholds.

**Implementation:**
- Prompt template + structured JSON response
- Cache result for 1–4 hours; re-classify on significant signal moves
- Fallback: if LLM unavailable, default to `neutral` and widen rebalance bands

---

### 8.4 Decision Engine (deterministic code)

**Responsibility:** Continuously scan portfolio state and **flag candidate actions**. Fast, cheap, predictable. No LLM.

Three modules run in parallel every cycle:

#### Rebalance optimizer

```
drift_cost   = f(current_allocation, target_allocation, regime)
tax_cost     = Σ estimated_capital_gains(required_disposals, lot_selection=HIFO)

if drift_cost > tax_cost:
  flag → REBALANCE
else:
  flag → HOLD, re-check in 24h
```

#### Loss harvest scanner

```
for each position across all chains:
  unrealized_loss = current_value - cost_basis
  if unrealized_loss > threshold (e.g. -8%):
    flag → HARVEST
    attach → correlated_replacement (e.g. wETH → stETH, ρ = 0.94)
    check  → wash_sale_window (30 days since last buy of same asset)
```

#### Holding period tracker

```
for each lot:
  days_held        = today - acquisition_date
  days_to_longterm = 365 - days_held

  if days_to_longterm < 30 AND lot has unrealized gain:
    flag → PARK_IN_USYC, do not dispose
```

**Output:** list of `CandidateAction` objects passed to the LLM Action Reasoner.f
```typescript
CandidateAction {
  type: "REBALANCE" | "HARVEST" | "PARK" | "HOLD"
  priority: number              // drift benefit, loss size, urgency
  lots: Lot[]
  estimatedTaxImpact: Decimal
  estimatedGas: Decimal
  replacementAsset?: string
  washSaleDaysRemaining?: number
  deterministicRecommendation: "EXECUTE" | "DEFER"
}
```

**Implementation:** `packages/tax-engine` — pure TypeScript, unit-testable, no API calls.

---

### 8.5 LLM Action Reasoner — the judgment layer

**Responsibility:** The deterministic engine flags candidates. The LLM decides whether to **actually execute**, handling edge cases rules can't cover.

**Example prompt the system sends to Claude:**

```
Portfolio state:
- wETH position: $4,200 cost basis, current value $3,600 → -$600 unrealized loss
- YTD realized gains: $8,400
- Regime: risk-off (confidence 78%)
- Last wETH purchase: 18 days ago (wash sale window open for 12 more days)
- Replacement candidate: stETH (0.94 correlation)

Decision engine flagged: harvest wETH loss now

Should we execute? Consider:
- Wash sale window closes in 12 days — does waiting cost more than the tax saving?
- Regime is risk-off — does replacement exposure make sense right now?
- Is $600 harvest worth the gas + execution cost?
```

**Claude responds:**

```json
{
  "decision": "DEFER",
  "deferDays": 12,
  "interimAction": "PARK_IN_USYC",
  "reasoning": "Wash sale window closes in 12 days. Parking in USYC preserves optionality while earning yield. Harvest after window closes saves ~$180 vs acting now.",
  "scheduledAction": { "type": "HARVEST", "executeAt": "2026-06-01", "lotId": "L-weth-003" }
}
```

That judgment — weighing wash sale timing against regime direction against transaction cost — is where the LLM genuinely adds value over a rules engine.

**Implementation:**
- One Claude API call per flagged action (or batched if multiple flags same cycle)
- Structured output schema: `{ decision, reasoning, scheduledAction?, interimAction? }`
- **Demo moment:** show the reasoning chain live in the dashboard
- Hard guardrails in code: LLM cannot override maturation parking flags or exceed user policy bounds

---

### 8.6 Execution Layer (Circle stack)

**Responsibility:** Execute LLM-approved actions with minimal friction and full audit trail.

| Step | Component | Action |
|------|-----------|--------|
| 1 | **Circle Wallets** | Dispose from specific lot (HIFO / specific-ID selection) |
| 2 | **CCTP / Gateway** | Cross-chain move if loss on different chain than gain |
| 3 | **USYC** | Receive parked capital; earn yield while lot ages |
| 4 | **Paymaster** | USDC covers gas — no ETH needed in wallet |
| 5 | **Arc** | Write every disposal: lot ID, cost basis, proceeds, gain/loss, timestamp |

**Pipeline:**

```
ApprovedAction → LotManifest → Simulate (tax + slippage) → Sign → Broadcast
  → Confirm → ArcWrite → LotStoreUpdate → trigger LLM Explanation
```

**Arc record (Form 8949 pre-fill):**

```
{
  lotId: "L-weth-003",
  description: "0.5 wETH",
  dateAcquired: "2025-03-15",
  dateSold: "2026-06-01",
  proceeds: 1800.00,
  costBasis: 2100.00,
  gainLoss: -300.00,
  term: "short",
  txHash: "0x...",
  rationale: "Loss harvest after wash sale window closed"
}
```

---

### 8.7 LLM Explanation → Dashboard

**Responsibility:** Turn structured action outcomes into plain-English summaries for the user.

**Input:** `{ action, decision, reasoning, before/after portfolio state, tax impact }`

**Output:** Human-readable card on dashboard — what happened, why, and what was saved.

**Primary dashboard metrics:**

| Metric | Definition |
|--------|------------|
| After-tax return | `(endValue − startValue − netTaxPaid − fees) / startValue` |
| Gross return | Mark-to-market without tax adjustment — the contrast metric |
| Benchmark delta | vs BTC buy-and-hold or S&P 500 |
| Losses harvested YTD | Sum of realized losses from harvest agent |
| Tax cost avoided | Counterfactual gross rebalance tax − actual tax paid |
| Est. year-end liability | Projected ST/LT gains × assumed rates |

**Tech:** Next.js read-only UI over materialized views + LLM-generated explanation cards stored per action.

---

## 9. Agent Orchestrator & Heartbeat

The **heartbeat** is Phase 2 — OpenClaw-style always-on. Phase 3 is manual approval **or** delegated autonomous execution, per user settings.

### 9.1 Heartbeat worker

```
every agent.heartbeatIntervalMinutes (default 60):

  if agent.status != "active": skip

  1. Data Aggregator        → PortfolioSnapshot
  2. LLM Regime Classifier  → RegimeState (cached if fresh)
  3. Decision Engine        → CandidateAction[]
  4. if no candidates: log "nothing found" → wait, rescan
  5. for each candidate:
       LLM Action Reasoner   → { decision, reasoning, scheduledAction? }

  if agent.approval.mode == "delegated":
  6a. validate against policy guardrails
  7a. if decision == EXECUTE → Execution Layer → Arc → notify (receipt)
  8a. if DEFER/SKIP → schedule or dismiss without user tap

  if agent.approval.mode == "manual":
  6b. emit OpportunityNotification with buttons
  7b. await user Execute / Defer / Skip
  8b. on Execute → validate token → Execution Layer → Arc → notify

  (optional veto window on delegated: notify → sleep → auto-execute)
  9. LLM Explanation → dashboard + channels
```

**Deployment:**
- **Hosted:** `apps/agent` runs heartbeat via Inngest/cron — one job per `agentId`
- **MCP:** no cron; user's OpenClaw calls `taxee_scan` on their schedule (same pipeline, step 6 returns to caller)

### 9.2 Conflict resolution (code, not LLM)

- Maturation parking (`PARK_IN_USYC`) overrides discretionary rebalances for lots within 30 days of long-term threshold
- LLM cannot approve actions outside `UserPolicy.allowedActions`
- If LLM API fails → fall back to deterministic recommendation; log and surface in dashboard
- **Manual mode:** execution only after user Execute (or MCP `taxee_approve_action`)
- **Delegated mode:** execution after LLM + guardrails; user always gets post-action notify

---

## 10. End-to-End Example

**Scenario:** wETH down 14%; wash sale window open; regime risk-off; user registered via Telegram (watch → execute tier).

**Phase 1 (already done):** User sent `0xabc` to bot; onchain import found wETH lot; policy US, −8% harvest threshold.

**Phase 2 — Heartbeat:**
1. **Data Aggregator** → wETH lot: $4,200 basis, $3,600 value; YTD gains $8,400; last buy 18 days ago
2. **LLM Regime Classifier** → risk-off, 78% confidence
3. **Loss harvest scanner** → flags `HARVEST`; replacement stETH (ρ 0.94)
4. **LLM Action Reasoner** → proposes **DEFER 12 days** + park in USYC meanwhile
5. **Telegram notify** → "Harvest opportunity — wETH down $600, save ~$180. Defer 12d for wash sale? [Execute] [Defer 12d] [Skip]"

**Phase 3a — Manual:** User taps Defer 12d → scheduled re-check; optional park approved separately.

**Phase 3b — Delegated:** Action Reasoner returns DEFER + park → agent parks in USYC without user tap → TG receipt: "Parked wETH; harvest scheduled Jun 1."

7. **Arc** → events logged  
8. **TG + dashboard** → explanation card; tax cost avoided +$180 tracked

---

## 11. Hackathon MVP Scope (6 days)

Build the **full user loop**: register (pick manual or delegated) → heartbeat → notify → approve or autonomous execute → record. Demo both modes if time allows.

| Day | Deliverable |
|-----|-------------|
| 1 | `Agent` model + registration API (web: connect wallet + fixture import) |
| 1 | Hardcoded / fixture demo portfolio (3–4 positions) |
| 2 | Heartbeat worker (hourly cron) — scan → reason → notify stub |
| 2 | Loss harvest scanner + holding period tracker |
| 3 | Claude **Action Reasoner** — live reasoning chain (demo moment) |
| 3 | **Telegram bot** — `/start`, address in, auto-import stub, notify with inline buttons |
| 4 | Action loop API — Execute / Defer / Skip → state machine |
| 4 | Web dashboard — opportunity card + gross vs after-tax metrics |
| 5 | Circle Wallets read (watch tier); Arc write on simulated execute |
| 6 | MCP server skeleton (`taxee_scan`, `taxee_list_opportunities`) for OpenClaw slide |
| 6 | Rehearse: TG notify → Defer → explanation card |

### MVP checklist

**User flows**
- [ ] Register agent (web or TG) — wallet address only, no private keys
- [ ] Auto-import stub on registration (fixture lots marked `provisional`)
- [ ] Heartbeat runs hourly per agent; logs "nothing found" or creates opportunity
- [ ] Notify via TG (primary) + web dashboard
- [ ] Approval mode at onboarding (manual vs delegated)
- [ ] Manual: Execute / Defer / Skip from TG + web
- [ ] Delegated: auto-execute path + post-action notify

**Agent brain**
- [ ] Loss harvest scanner — flags positions below threshold
- [ ] Holding period tracker — flags lots within 30 days of long-term
- [ ] Claude Action Reasoner — structured execute / defer / park + reasoning
- [ ] Arc write — one record per approved action

**Stretch**
- [ ] MCP tools: `taxee_scan`, `taxee_approve_action`
- [ ] Circle execute tier (one demo tx) — else watch-only + simulated confirm

### Explicitly out of scope for MVP

- Full onchain lot reconstruction (fixture + provisional flag OK)
- Full cross-chain CCTP
- Delegated mode without policy guardrails or post-action notify
- Email/push (TG + web sufficient)
- Production key custody — watch tier default; Circle execute optional demo

---

## 12. Tech Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Agent runtime | TypeScript / Node | Heartbeat worker + API |
| LLM | Claude API (structured output) | Goal Parser, Regime Classifier, Action Reasoner, Explanation |
| Notifications | Telegram Bot API (`grammy` / `telegraf`) | Onboarding + inline Execute/Defer/Skip |
| Chain reads | viem + indexer stub | Watch tier — address-only import |
| State DB | PostgreSQL or SQLite | `Agent`, lots, opportunities, approvals, LLM cache |
| Job queue | Inngest or BullMQ | Per-agent heartbeat cron + deferred action queue |
| Prices | CoinGecko / Chainlink | Mark-to-market |
| Execution | Circle Wallets, Paymaster, USYC | Opt-in execute tier; CCTP stubbed |
| Audit | Arc API | Immutable disposal log |
| Dashboard | Next.js | After-tax alpha + opportunity cards |
| MCP | `@modelcontextprotocol/sdk` | OpenClaw / Claude Desktop integration |
| Auth | SIWE (web) + TG user id binding | No seed phrases; Circle for execute tier |

---

## 13. Repository Layout

```
taxee/
├── apps/
│   ├── agent/                  # heartbeat worker (hosted mode)
│   ├── api/                    # Agent CRUD, action loop, webhooks
│   ├── dashboard/              # Next.js UI — register, opportunities, metrics
│   ├── telegram-bot/         # TG onboarding + notify + inline buttons
│   └── mcp-server/             # MCP tools for OpenClaw / Claude Desktop
├── packages/
│   ├── aggregator/             # Data Aggregator — Wallets, Arc, oracles, signals
│   ├── tax-engine/             # Decision Engine — harvest, rebalance, maturation
│   ├── llm/                    # Goal Parser, Regime Classifier, Action Reasoner, Explanation
│   │   ├── prompts/
│   │   └── schemas/
│   ├── notifications/          # TG, email, push adapters — shared OpportunityNotification
│   ├── execution/              # Circle Wallets, Paymaster, USYC, CCTP
│   ├── compliance/             # Arc writer, Form 8949 projection
│   └── shared/                 # Agent, WalletBinding, PortfolioSnapshot, etc.
├── fixtures/
│   └── demo-portfolio.json
└── doc.md
```

---

## 14. Implementation Notes

### Prompt versioning

Store prompts in `packages/llm/prompts/` with version suffixes (`action-reasoner.v1.md`). Log `{ promptVersion, input, output }` alongside every LLM call for reproducibility and demo debugging.

### Structured output everywhere

Every LLM call returns JSON matching a Zod schema. Never parse free-form text for decisions. The dashboard renders `reasoning` as prose; `decision` and `scheduledAction` drive code.

### Guardrails between LLM and execution

```typescript
function validateApprovedAction(
  llmOutput: ActionReasonerOutput,
  candidate: CandidateAction,
  policy: UserPolicy
): ApprovedAction | null {
  if (!policy.allowedActions.includes(candidate.type)) return null;
  if (candidate.type === "PARK" && llmOutput.decision === "EXECUTE_HARVEST") return null;
  if (llmOutput.estimatedTaxImpact > policy.maxTaxPerAction) return null;
  return llmOutput;
}
```

### Demo portfolio fixture

`fixtures/demo-portfolio.json` — 3–4 positions with varied holding periods, one deep loss (wETH), one near long-term threshold, one short-term gain. Enables deterministic demo without live wallet history reconstruction.

### Testing strategy

| Module | Test approach |
|--------|---------------|
| Decision Engine | Unit tests — pure functions, no mocks |
| Data Aggregator | Integration tests against fixture + mocked Circle/Arc APIs |
| LLM layers | Snapshot tests on prompt + fixture input; assert schema validity |
| Execution | Dry-run mode — build tx, simulate, don't broadcast |
| End-to-end | Script: feed fixture → run cycle → assert dashboard state |

---

## 15. Risks & Open Questions

| Topic | Consideration |
|-------|---------------|
| Key custody UX | Default watch-only; execute tier requires clear Circle onboarding — never ask for seed in TG |
| TG ↔ agent binding | Verify TG user owns wallet (signed message or WC link) before execute, not just address paste |
| LLM latency | Action Reasoner adds 1–3s per candidate; heartbeat can async notify when ready |
| LLM consistency | Low temperature + structured output; log prompt version per opportunity |
| Notification fatigue | Cooldown per lot (7d after Skip); batch multiple flags into one digest optional |
| Tax jurisdiction | MVP assumes US federal; pluggable rules later |
| DeFi wash sales | Document substitute logic conservatively |
| Provisional lots | Block execute on `provisional: true` until user confirms CSV or onchain reconcile |
| MCP auth | API key per agentId; scoped tools; rate limit `taxee_scan` |
| USYC substitute swaps | Confirm tax treatment with advisor; audit trail regardless |

---

## 16. Success Criteria

The architecture is working when:

1. User registers via **TG or web in under 2 minutes** — address only, no seed phrase — and agent status is `active`
2. Heartbeat runs hourly; when nothing to do, system waits and rescans without bothering user
3. When opportunity found, user gets **TG (or web) notification** with Execute / Defer / Skip and LLM reasoning visible
4. **Manual mode:** no broadcast until user taps Execute
5. **Delegated mode:** autonomous execute when LLM + policy agree; user receives receipt notify
6. Defer schedules re-check; Skip suppresses re-notify for cooldown period
7. LLM Action Reasoner defers harvest when wash sale + regime + gas don't justify — reasoning shown in notification
8. User can switch manual ↔ delegated without re-registering
9. Arc record written on every executed action; dashboard shows after-tax vs gross divergence
10. MCP `taxee_scan` respects agent approval mode for OpenClaw demo

---

## 17. Next Steps

1. Scaffold `Agent` + `WalletBinding` types and registration API
2. Build `apps/telegram-bot` — `/start`, address capture, fixture import, bind `telegramChatId`
3. Implement heartbeat in `apps/agent` — scan → reason → create `Opportunity` row → call notifier
4. Action loop endpoints: `POST /actions/:id/execute|defer|skip` + TG callback handler
5. `packages/llm` Action Reasoner + notification payload builder
6. Web dashboard — register page + opportunity card + metrics
7. `apps/mcp-server` skeleton for hackathon stretch
8. Document watch vs execute tier in onboarding copy; Circle wallet flow for execute demo only
