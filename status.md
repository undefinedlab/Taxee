# taxee — Project Status

> Last updated: May 22, 2026

---

## Deployed Contracts

| Contract | Address | Chain | Status |
|---|---|---|---|
| `TaxeeLotRegistry` | `0x9a16c3d45A3e8Ad23152372405bf1F0dd58496ad` | Arc testnet (5042002) | ✅ Live + Verified |
| `TaxeeExecutor` | `0x7fD85458A0958C5EB52234f3FF4f0C6bf7cC999c` | Arc testnet (5042002) | ✅ Live + Verified |

Arc RPC: `https://rpc.testnet.arc-node.thecanteenapp.com/v1/<token>` (see `contracts/.env`)

---

## Live & Working

### Smart Contracts
- [x] `TaxeeLotRegistry.sol` — immutable on-chain lot disposal registry
- [x] `TaxeeExecutor.sol` — atomic USDC → USYC park + redeem executor
- [x] `TaxeeLotRegistry.t.sol` — 34 tests passing (invariants, fuzz, edge cases)
- [x] `TaxeeExecutor.t.sol` — 38 tests passing (NAV appreciation, multi-lot, partial redeems, fuzz)
- [x] `Deploy.s.sol` — deployment script via Arc RPC
- [x] Deployed + verified on Arc testnet (chain 5042002)

### Real-Time Portfolio Scanning
- [x] `packages/aggregator/src/balanceReader.ts` — live ETH + ERC-20 balances via Alchemy RPC
- [x] `packages/aggregator/src/lotImporter.ts` — real on-chain transfer history → tax lots with cost basis
- [x] CoinGecko price fetching: current prices + historical prices at acquisition date
- [x] Multi-chain: Ethereum mainnet (1), Ethereum Sepolia (11155111), Base mainnet (8453), Base Sepolia (84532)
- [x] Automatic deduplication via `txHash` — re-scanning never imports duplicate lots
- [x] `fetchWalletPositions` + `importLotsForWallet` exported from `@taxee/aggregator`

### Multi-Wallet Support (one agent per wallet)
- [x] `wallets` table — multiple wallet addresses per Telegram user, each with a label
- [x] `agents.walletAddress` — each agent is tied to one specific wallet address
- [x] Sending a new 0x address in Telegram creates a new wallet + independent agent
- [x] Each wallet has its own lots, opportunities, and heartbeat history
- [x] `/wallets` — lists all linked wallets with pending opportunity counts per wallet
- [x] `/opportunities` — shows pending actions across ALL wallets, labeled per wallet
- [x] `/mode` — updates approval mode for all wallets simultaneously

### Full LLM Pipeline (Claude API, no mocks)
- [x] **Regime Classifier** — classifies market regime from on-chain signals → `risk-on` / `risk-off` / `neutral`
- [x] **Action Reasoner** — per-candidate EXECUTE/DEFER/SKIP judgment with full reasoning chain
- [x] **Explanation Generator** — user-facing `headline` + `body` in plain English with specific dollar amounts
- [x] All LLM calls logged: `promptVersion`, token counts, latency, raw output → `llm_logs` table
- [x] Zod schema validation on all LLM outputs — fails closed on malformed responses

### Rich Telegram Notifications
- [x] Type-specific layouts: 🌾 HARVEST / 🏦 PARK / ⚖️ REBALANCE / ⏸ HOLD
- [x] Position snapshot per notification: quantity, cost basis, current value, unrealized P&L %, days held
- [x] HARVEST: replacement asset name, wash-sale window status (clear / days remaining)
- [x] PARK: days to long-term threshold, USYC strategy note
- [x] REBALANCE: market regime label, allocation drift %
- [x] Claude's analysis body (from `generateExplanation`) — 2–4 plain-English sentences
- [x] Action buttons: `[✅ Approve]  [⏰ Defer]  [❌ Skip]`
- [x] No dead "View on dashboard" link

### Tax Engine (pure TypeScript, zero API calls)
- [x] `harvestScanner.ts` — flags unrealized loss > `harvestThresholdPct`, attaches correlated replacement
- [x] `maturationTracker.ts` — flags lots within `maturationBufferDays` of 365-day long-term threshold
- [x] `rebalanceOptimizer.ts` — computes drift_cost vs tax_cost of HIFO disposal → REBALANCE or HOLD
- [x] `lotSelector.ts` — HIFO / FIFO / SPECIFIC_ID lot selection
- [x] `correlations.json` — ETH→stETH, wBTC→TBTC, SOL→mSOL, MATIC→stMATIC

### Database (PostgreSQL + Drizzle ORM)
- [x] `users` — Telegram identity; `address` nullable (supports multi-wallet)
- [x] `wallets` — per-user wallet addresses with auto-assigned labels (Wallet 1, Wallet 2, ...)
- [x] `agents` — one per wallet; stores `walletAddress`, `policy` (JSONB), `approvalMode`
- [x] `lots` — tax lots: assetId, chainId, quantity, costBasisUsd, acquiredAt, txHash
- [x] `opportunities` — LLM decision, reasoning, headline, body, taxSavingEstimate
- [x] `llm_logs` — every Claude call: promptVersion, model, tokens, latency, raw output
- [x] `heartbeats` — per-agent scan history
- [x] DB reset script: `npx tsx apps/api/src/db/reset.ts`

### Backend Infrastructure
- [x] Turborepo monorepo with pnpm workspaces — all packages build cleanly
- [x] Heartbeat worker (node-cron, every 15 min) — auto-iterates all active agents
- [x] `dev:trigger` script — manual one-shot heartbeat run for testing
- [x] Child process spawn from bot → heartbeat (avoids cross-package ESM import issues)
- [x] `apps/api`, `apps/agent`, `apps/telegram-bot`, `apps/mcp-server` all scaffolded

---

## What's Left

### Execution (watch-tier only until Circle key filled)
- [ ] **Circle Wallets execution** — `CIRCLE_ENTITY_SECRET` not filled; agent notifies only, does not execute
- [ ] **USYC park** — execution pipeline wired but blocked on Circle credentials
- [ ] **CCTP cross-chain bridging** — stubbed; single-chain works without it

### Frontend
- [ ] Dashboard not connected to real API endpoints (static Next.js scaffold)
- [ ] `/opportunities` UI not wired to real DB opportunities
- [ ] After-tax return chart uses static mock data
- [ ] Arc compliance export (CSV) button not wired

### Tax Strategies — Portfolio-Dependent
- [ ] **REBALANCE** — only fires with multi-asset portfolio; single-ETH wallet has no target allocation to drift from
- [ ] **PARK** — only fires when lots approach 335+ days held; newly imported lots won't trigger this

### Data & Integration
- [ ] Regime signals use stub data — Defillama/Glassnode not integrated (Claude still reasons correctly with stub inputs)
- [ ] Arc REST API read path needs real lot records before compliance export works
- [ ] `apps/mcp-server` scaffolded but not connected to live heartbeat

### Testing
- [ ] No backend unit tests written (tax-engine pure functions are ready to test)
- [ ] No API route tests
- [ ] No end-to-end fixture test

---

## How to Run

```bash
# 1. Start Postgres
docker compose up -d

# 2. Install deps
cd backend && pnpm install

# 3. Run migrations
pnpm --filter @taxee/api db:migrate

# 4. Start all backend apps
pnpm dev

# Or just the bot
pnpm --filter @taxee/telegram-bot dev
```

**Required env vars (`backend/.env`):**
```
TELEGRAM_BOT_TOKEN=...
ANTHROPIC_API_KEY=...
ALCHEMY_API_KEY=...        # required for real portfolio scanning
COINGECKO_API_KEY=...      # optional — free tier works
DATABASE_URL=postgresql://taxee:taxee@localhost:5432/taxee
```

### Full real-time flow
1. `/start` in Telegram → send wallet address (0x...)
2. Bot scans live balances across 4 chains (Alchemy)
3. Bot imports on-chain transfer history → tax lots with cost basis (Alchemy + CoinGecko)
4. Bot triggers Claude heartbeat in background
5. Claude analyzes portfolio → rich opportunity notification with Approve/Defer/Skip
6. Send another wallet address → second independent agent spun up
7. `/wallets` → see all wallets + pending opportunity counts
8. `/opportunities` → approve/defer/skip actions across all wallets

### Reset database
```bash
npx tsx apps/api/src/db/reset.ts
```

---

## Strategy Trigger Conditions

| Strategy | Fires when | Your single-ETH wallet |
|---|---|---|
| 🌾 **HARVEST** | Unrealized loss > `harvestThresholdPct` (default −8%) | ✅ Will fire if ETH is down from cost basis |
| 🏦 **PARK** | Lot held ≥ 335 days with unrealized gain (30d buffer before LT at 365d) | ❌ Needs aged lots |
| ⚖️ **REBALANCE** | Drift from target allocation > 5% AND drift cost > tax cost | ❌ Needs multi-asset portfolio |

---

## Architecture Flow

```
Telegram / Web / MCP
        ↓
  Fastify API (apps/api)
        ↓
  Heartbeat Worker (apps/agent)  ← node-cron every 15min, all active agents
        ↓
  Alchemy RPC → lots import
  CoinGecko → prices
  LLM Regime Classifier → RegimeState
  Tax Engine (pure TS) → CandidateAction[]
  LLM Action Reasoner → EXECUTE / DEFER / SKIP
  LLM Explanation Generator → headline + body
        ↓
  [watch tier]  Telegram rich notification → user approves
  [exec tier]   Circle Wallets → USYC park → Arc ledger write → TaxeeLotRegistry.commitDisposal()
        ↓
  Telegram receipt notification
```

---

## Production Roadmap

Everything needed to go from working hackathon demo → production-grade service.

---

### 🔴 P0 — Blocks any real user

#### Execution
- [ ] **Circle Wallets** — fill `CIRCLE_API_KEY` + `CIRCLE_ENTITY_SECRET`; wire `executeApprovedAction` end-to-end
- [ ] **USYC on Base mainnet** — swap testnet USDC stub for real Hashnote USYC (`packages/execution/usyc.ts`)
- [ ] **Mainnet contract deploy** — re-deploy `TaxeeLotRegistry` + `TaxeeExecutor` on Base mainnet with real USYC address
- [ ] **Transaction simulation** — run `simulate()` before every execution; abort if slippage or tax impact exceeds policy cap
- [ ] **Gas abstraction** — wire Circle Paymaster so users pay gas in USDC, not ETH

#### Security
- [ ] **Wallet ownership verification** — require signed message (SIWE or eth_sign) before linking a wallet to a Telegram user; currently trusts the address as-is
- [ ] **Telegram webhook mode** — switch from long-polling to HTTPS webhook + secret token validation (`setWebhook`)
- [ ] **API authentication** — all Fastify routes currently unprotected; add JWT middleware (SIWE for web, `chat_id` binding for Telegram)
- [ ] **Secrets management** — move all keys out of `.env` into AWS Secrets Manager / HashiCorp Vault; rotate on breach
- [ ] **Rate limiting** — add `@fastify/rate-limit` on all public endpoints; protect against wallet flooding

#### Data integrity
- [ ] **Lot import completeness** — current importer only catches inbound ETH transfers; add DEX swap event parsing (Uniswap V2/V3 `Swap` events) to capture trades as cost-basis lots
- [ ] **Lot confirmation flow** — imported lots are provisional; add user confirmation step before they feed tax decisions
- [ ] **Wash sale cross-wallet detection** — current check is per-agent only; wash sale window must be checked across all wallets owned by the same user

---

### 🟠 P1 — Required before charging users

#### Reliability
- [ ] **Job queue** — replace `node-cron` with Inngest (durable, retryable, per-agent fan-out, dead-letter); node-cron drops jobs on restart
- [ ] **Heartbeat idempotency** — prevent duplicate opportunity rows if heartbeat runs twice before prior one finishes (add `UNIQUE(agent_id, type, lot_id)` or dedup on insert)
- [ ] **LLM fallback** — if Claude API is down → use `deterministicRecommendation` from tax engine; surface `llm_unavailable: true` in notification
- [ ] **Database connection pooling** — add PgBouncer or switch to `pg` pool; Drizzle's default single connection won't survive concurrent agents
- [ ] **Error alerting** — integrate Sentry (or equivalent); alert on heartbeat failures, execution errors, LLM schema validation failures
- [ ] **Retry + circuit breaker** — wrap Alchemy, CoinGecko, Circle, Arc API calls with exponential backoff + circuit breaker

#### Compliance
- [ ] **Arc REST integration** — wire `arcWriter.ts` to real Arc API; every executed disposal must write an immutable Arc record before agent marks action complete
- [ ] **Form 8949 export** — `form8949.ts` aggregates Arc records per tax year → CSV download; hook into API route `GET /arc/:agentId/form8949`
- [ ] **Audit log** — every state change (lot status, opportunity approved/executed/skipped) must be append-only with actor + timestamp
- [ ] **Tax jurisdiction guardrails** — US federal only is fine for MVP; add disclaimer and block non-US users or add `jurisdiction: "OTHER"` handling

#### Lot data quality
- [ ] **CSV cost-basis override** — let users upload a CSV to correct provisional lots (coinbase, kraken, etc. exports)
- [ ] **Multi-source reconciliation** — merge on-chain lots with CSV lots by asset + date window; flag conflicts for user review
- [ ] **Historical price accuracy** — CoinGecko free tier rate-limits; add caching layer (Redis or Postgres) for historical prices; avoid re-fetching the same date twice

---

### 🟡 P2 — Quality of life / scale

#### Real market signals
- [ ] **Regime signals** — replace stub regime signals with real Defillama (TVL, stablecoin flows) + Glassnode (funding rate, realized vol) API calls
- [ ] **Price feed fallback** — add Chainlink on-chain price as fallback when CoinGecko is unavailable or rate-limited
- [ ] **Multi-asset correlation table** — current `correlations.json` covers 4 pairs; expand to top-50 DeFi assets for better HARVEST replacement suggestions

#### Frontend
- [ ] **Dashboard** — connect Next.js components to real API (`GET /portfolio/:agentId`, `GET /opportunities/:agentId`)
- [ ] **Opportunity approval UI** — web-based Execute/Defer/Skip buttons (currently Telegram-only)
- [ ] **After-tax return chart** — pull realized YTD from `opportunities` table; chart gross vs after-tax return delta
- [ ] **Arc compliance page** — Form 8949 preview + CSV download button
- [ ] **SIWE login** — wallet-connect → sign → JWT; tie web session to existing `userId`

#### Tax engine improvements
- [ ] **CCTP cross-chain execution** — harvest on Ethereum, park USYC on Base in one atomic flow via Circle CCTP bridge
- [ ] **Short-term vs long-term tax rate input** — let users input their marginal rate for more accurate `taxSavingEstimate`
- [ ] **AMT / NIIT flags** — warn users approaching $200k income threshold where NIIT applies
- [ ] **Carry-forward loss tracking** — persist prior-year harvested losses; apply them to offset current-year gains in opportunity scoring

#### Infrastructure
- [ ] **Redis caching** — cache CoinGecko prices (1min TTL), regime state (4h TTL), lot snapshots (per-heartbeat)
- [ ] **Horizontal scaling** — stateless Fastify API behind load balancer; agent worker as separate horizontally-scalable process
- [ ] **Observability** — structured JSON logs (pino), trace IDs per heartbeat, latency histograms for LLM + Alchemy calls
- [ ] **MCP server production wiring** — connect `taxee_scan` tool to live heartbeat; add per-`agentId` API key auth

---

### 🔵 P3 — Future product

- [ ] **Multi-jurisdiction** — UK CGT, EU per-country rules, carry-forward allowances
- [ ] **Tax-loss harvesting calendar** — proactive "best days to harvest" based on year-end liability projection
- [ ] **Portfolio optimization mode** — beyond tax: suggest rebalance toward higher after-tax Sharpe ratio
- [ ] **CEX import** — Binance, Coinbase, Kraken CSV parsers to reconstruct full cost-basis history off-chain
- [ ] **Email / push notifications** — channel fallback when Telegram not available
- [ ] **Mobile app** — React Native wrapper around Telegram bot flows + dashboard
- [ ] **Institutional tier** — multi-user org accounts, sub-agents per portfolio manager, consolidated Form 8949 across clients

---

### Production Readiness Checklist

```
Security
  ✅ Never stores private keys (Circle MPC)
  ✅ LLM cannot bypass policy guardrails (code-enforced)
  ❌ Wallet ownership not verified before linking
  ❌ All API routes unauthenticated
  ❌ Telegram running in long-polling (not webhook)

Reliability
  ✅ Heartbeat runs every 15min for all active agents
  ✅ LLM outputs Zod-validated (fails closed)
  ❌ Job queue has no durability (node-cron, drops on restart)
  ❌ No retry logic on external API calls
  ❌ No error alerting / Sentry

Data
  ✅ Lot deduplication via txHash
  ✅ Real on-chain transfer history (Alchemy)
  ❌ DEX swaps not captured (Uniswap, etc.)
  ❌ Wash sale check is per-wallet, not per-user
  ❌ No user lot confirmation flow

Compliance
  ✅ Arc contracts deployed + verified
  ✅ Every LLM call logged with promptVersion + tokens
  ❌ Arc REST write not wired to live execution
  ❌ Form 8949 export not connected

Execution
  ✅ Execution pipeline wired (packages/execution)
  ✅ Policy guardrails enforced before execution
  ❌ Circle entity secret not filled (watch-tier only)
  ❌ No mainnet contract deployment
```
