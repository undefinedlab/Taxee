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

---

## 3. Building Blocks

### 3.1 Data Aggregator

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
- Read lot history + YTD realized G/L from Arc (write path separate — see §3.6)
- Fetch prices from CoinGecko / Chainlink / Pyth
- Collect regime signals into a structured `RegimeSignals` object — no classification yet

---

### 3.2 LLM Goal Parser

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

### 3.3 LLM Regime Classifier

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

### 3.4 Decision Engine (deterministic code)

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

**Output:** list of `CandidateAction` objects passed to the LLM Action Reasoner.

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

### 3.5 LLM Action Reasoner — the judgment layer

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

### 3.6 Execution Layer (Circle stack)

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

### 3.7 LLM Explanation → Dashboard

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

## 4. Agent Orchestrator

Central loop — event-driven + scheduled:

```
on cycle (every N minutes) or on wallet event:

  1. Data Aggregator        → PortfolioSnapshot
  2. LLM Regime Classifier  → RegimeState (cached if fresh)
  3. Decision Engine        → CandidateAction[]
  4. for each candidate:
       LLM Action Reasoner   → ApprovedAction | DeferredAction
  5. Execution Layer        → broadcast approved actions
  6. Arc Ledger Write       → immutable record per tx
  7. LLM Explanation        → dashboard card
```

**Conflict resolution (code, not LLM):**
- Maturation parking (`PARK_IN_USYC`) overrides discretionary rebalances for lots within 30 days of long-term threshold
- LLM cannot approve actions outside `UserPolicy.allowedActions`
- If LLM API fails → fall back to deterministic recommendation; log and surface in dashboard

---

## 5. End-to-End Example

**Scenario:** wETH down 14%; wash sale window open; regime risk-off; deterministic engine flags harvest.

1. **Data Aggregator** → wETH lot: $4,200 basis, $3,600 value; YTD gains $8,400; last buy 18 days ago
2. **LLM Regime Classifier** → risk-off, 78% confidence
3. **Loss harvest scanner** → flags `HARVEST` (−14% > −8% threshold); replacement stETH (ρ 0.94)
4. **LLM Action Reasoner** → **DEFER 12 days**; park in USYC meanwhile; schedule harvest post wash-sale window
5. **Execution** → swap wETH → USYC via Circle Wallets + Paymaster gas
6. **Arc** → parking event logged (not a disposal); scheduled harvest queued
7. **LLM Explanation** → "Parked wETH in USYC while wash sale window closes. Harvest scheduled Jun 1 — estimated tax saving $180."
8. **Dashboard** → after-tax return updated; tax cost avoided +$180

---

## 6. Hackathon MVP Scope (6 days)

Build the vertical slice that demonstrates the LLM judgment layer — not the full cross-chain system.

| Day | Deliverable |
|-----|-------------|
| 1 | Circle Wallets integration (real balances or seeded demo wallet) |
| 1 | Hardcoded cost basis for demo portfolio (3–4 positions, realistic history) |
| 2 | Data Aggregator — balances + prices + Arc read (mock Arc OK initially) |
| 2 | Loss harvest scanner (simplest module, most demonstrable) |
| 3 | Holding period tracker + USYC parking for one flagged position |
| 3 | Claude API — Regime Classifier (can stub signals for demo) |
| 4 | Claude API — **Action Reasoner** (the demo moment: live reasoning chain) |
| 4 | Arc write per transaction |
| 5 | Dashboard: gross return vs after-tax return, harvested losses YTD, LLM explanation cards |
| 6 | Polish demo flow, edge-case prompt, rehearse narrative |

### MVP checklist

- [ ] Circle Wallets — read balances (demo wallet seeded with 3–4 positions)
- [ ] Hardcoded lot history — acquisition dates, cost basis, holding periods
- [ ] Loss harvest scanner — flags positions below threshold
- [ ] Holding period tracker — flags lots within 30 days of long-term
- [ ] Claude Action Reasoner — structured prompt → execute / defer / park decision
- [ ] USYC parking — one live or simulated swap for maturation demo
- [ ] Arc write — one record per disposal with lot ID and gain/loss
- [ ] Dashboard — gross vs after-tax return, harvested losses YTD, reasoning chain visible

### Explicitly out of scope for MVP

- Full cross-chain CCTP (stub or single-chain only)
- Automated rebalance execution (show drift vs tax math in UI; defer execution)
- Production lot reconstruction from onchain history
- Form 8949 PDF export (CSV or Arc JSON sufficient for demo)

---

## 7. Tech Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Agent runtime | TypeScript / Node | Fast iteration; shared types with dashboard |
| LLM | Claude API (structured output) | Goal Parser, Regime Classifier, Action Reasoner, Explanation |
| Chain reads | viem + Circle Wallets SDK | Balances, tx broadcast |
| State DB | PostgreSQL or SQLite (hackathon) | Lots, policies, action log, LLM reasoning cache |
| Job queue | Inngest or cron | Scheduled harvests, maturation checks, 24h re-check |
| Prices | CoinGecko / Chainlink | Mark-to-market |
| Execution | Circle Wallets, Paymaster, USYC | CCTP stubbed for MVP |
| Audit | Arc API | Immutable disposal log |
| Dashboard | Next.js | After-tax alpha + LLM explanation cards |
| Auth | Circle Wallets session | Demo wallet for hackathon |

---

## 8. Repository Layout

```
taxee/
├── apps/
│   ├── agent/                  # orchestrator loop
│   ├── dashboard/              # Next.js UI
│   └── api/                    # REST/tRPC for dashboard reads
├── packages/
│   ├── aggregator/             # Data Aggregator — Wallets, Arc, oracles, signals
│   ├── tax-engine/             # Decision Engine — harvest, rebalance, maturation
│   ├── llm/                    # Goal Parser, Regime Classifier, Action Reasoner, Explanation
│   │   ├── prompts/            # versioned prompt templates
│   │   └── schemas/            # structured output JSON schemas
│   ├── execution/              # Circle Wallets, Paymaster, USYC, CCTP
│   ├── compliance/             # Arc writer, Form 8949 projection
│   └── shared/                 # types, PortfolioSnapshot, CandidateAction, etc.
├── fixtures/
│   └── demo-portfolio.json     # hardcoded lots for hackathon demo
└── doc.md
```

---

## 9. Implementation Notes

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

## 10. Risks & Open Questions

| Topic | Consideration |
|-------|---------------|
| LLM latency | Action Reasoner adds 1–3s per candidate; batch or async for multi-flag cycles |
| LLM consistency | Same inputs should produce same decision; use low temperature + structured output |
| Tax jurisdiction | MVP assumes US federal (365-day LT, ST/LT buckets); make rules pluggable |
| DeFi wash sales | No clear IRS wash-sale rule for crypto yet; document substitute logic conservatively |
| LLM override safety | Hard code guardrails; LLM recommends, code validates before broadcast |
| Oracle / basis accuracy | MVP uses hardcoded lots; production needs CSV import + onchain reconciliation |
| USYC substitute swaps | Confirm tax treatment with advisor; architecture preserves audit trail regardless |

---

## 11. Success Criteria

The architecture is working when:

1. A rebalance flagged by the Decision Engine is **deferred by the LLM** when wash sale + regime + gas cost don't justify action — with visible reasoning
2. A losing position is flagged by code, **approved or deferred by the LLM**, and the dashboard shows the reasoning chain
3. A lot at day 340 is **parked in USYC** — not sold — and the maturation flag cannot be overridden by the LLM
4. Every disposal produces an Arc record mappable to a Form 8949 row with specific lot ID
5. Dashboard headline metric shows **after-tax return diverging from gross** when tax-aware actions fire
6. Demo audience can watch the **LLM Action Reasoner** weigh trade-offs live and explain its decision in plain English

---

## 12. Next Steps

1. Scaffold monorepo with `packages/shared` types (`PortfolioSnapshot`, `CandidateAction`, `UserPolicy`)
2. Create `fixtures/demo-portfolio.json` with 3–4 realistic positions
3. Implement `packages/tax-engine` — loss harvest scanner + holding period tracker (unit tested)
4. Wire `packages/aggregator` — Circle Wallets read + price oracle + fixture fallback
5. Implement `packages/llm` — Action Reasoner prompt + structured output (highest demo value)
6. Build dashboard card that renders LLM reasoning chain alongside gross vs after-tax metrics
7. Integrate Arc write on first real (or simulated) disposal
