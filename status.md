# taxee — Project Status

> Last updated: May 24, 2026

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

### Circle Integration (fully wired)
- [x] **Entity secret encryption** — RSA-OAEP-SHA256 via `node:crypto`; `encryptEntitySecret()` fetches + caches entity public key, encrypts the 32-byte hex secret per-request
- [x] **Developer-controlled wallets** — `createWalletSet()` + `createDeveloperWallet()` via `POST /v1/w3s/developer/wallets`; auto-provisions a Circle wallet per agent on creation
- [x] **Developer contract execution** — `createDeveloperContractExecution()` via `POST /v1/w3s/developer/transactions/contractExecution`; all on-chain calls go through this (commitDisposal, parkInUsyc, receiveMessage)
- [x] **Circle Paymaster** — pass `paymasterWalletId` to any execution call; sponsor gas in USDC via ERC-4337 Paymaster on Base (`feeConfig: { type: "PAYMASTER", sponsorWalletId }`)
- [x] **CCTP V1 bridge** — `burnUsdcForCCTP()` calls `depositForBurn` on `TokenMessenger`; `pollAttestation()` polls Circle Iris API (`iris-api.circle.com / iris-api-sandbox.circle.com`) until attestation is complete; relay via `receiveMessage` on destination
- [x] **CCTP domain map** — ETH=0, ETH-Sepolia=0, Base=6, Base-Sepolia=6, ARB=3, Polygon=7
- [x] **Full bridge utility** — `packages/execution/src/cctp.ts` → `bridgeUsdcViaCctp()`: burn → parse `MessageSent` event → keccak256 message hash → poll Iris → relay; end-to-end in one call
- [x] **Approve → Execute wired** — `POST /actions/:id/approve` now fire-and-forgets `executeOpportunity()`; Telegram approve callback does the same
- [x] **USYC park step** — after `commitDisposal` confirms for HARVEST type, calls `TaxeeExecutor.parkInUsyc(amount, lotId, agentId)` to park proceeds in USYC yield (non-fatal if it fails)
- [x] **`executeOpportunity` shared utility** — `packages/execution/src/executeOpportunity.ts`; reads `candidateAction` from DB, fetches current prices, runs `validateForExecution` guardrails, executes, updates `executedAt` + `arcRecordId` + `txHash` in DB
- [x] **`candidateAction` stored at heartbeat time** — `opportunities.candidate_action` (jsonb) stores the full `CandidateAction` at creation; approval at any time can re-validate + execute without needing a re-scan

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
- [x] `agents.circleWalletId` — auto-populated on agent creation via Circle developer wallet API
- [x] Sending a new 0x address in Telegram creates a new wallet + independent agent + Circle wallet
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
- [x] Action buttons: `[✅ Approve]  [⏰ Defer]  [❌ Skip]`
- [x] Approve button → triggers real Circle execution immediately (fire-and-forget)

### Tax Engine (pure TypeScript, zero API calls)
- [x] `harvestScanner.ts` — flags unrealized loss > `harvestThresholdPct`, attaches correlated replacement
- [x] `maturationTracker.ts` — flags lots within `maturationBufferDays` of 365-day long-term threshold
- [x] `rebalanceOptimizer.ts` — computes drift_cost vs tax_cost of HIFO disposal → REBALANCE or HOLD
- [x] `lotSelector.ts` — HIFO / FIFO / SPECIFIC_ID lot selection
- [x] `correlations.json` — ETH→stETH, wBTC→TBTC, SOL→mSOL, MATIC→stMATIC

### Database (PostgreSQL + Drizzle ORM)
- [x] `users` — Telegram identity; `address` nullable (supports multi-wallet)
- [x] `wallets` — per-user wallet addresses with auto-assigned labels (Wallet 1, Wallet 2, ...)
- [x] `agents` — one per wallet; stores `walletAddress`, `circleWalletId`, `policy` (JSONB), `approvalMode`
- [x] `lots` — tax lots: assetId, chainId, quantity, costBasisUsd, acquiredAt, txHash
- [x] `opportunities` — LLM decision, reasoning, headline, body, taxSavingEstimate, **`candidateAction` (jsonb)**
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

### Execution (needs env vars filled)
- [ ] **Fill credentials** — set `CIRCLE_API_KEY`, `CIRCLE_ENTITY_SECRET`, `CIRCLE_WALLET_SET_ID` in `backend/.env`; everything is wired, execution activates immediately
- [ ] **USYC on Base mainnet** — TaxeeExecutor on testnet; re-deploy on Base mainnet with real Hashnote USYC address
- [ ] **CCTP end-to-end test** — test `bridgeUsdcViaCctp` on Base-Sepolia → ETH-Sepolia before mainnet

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

# 3. Run migrations (adds candidateAction column)
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
ALCHEMY_API_KEY=...              # required for real portfolio scanning
COINGECKO_API_KEY=...            # optional — free tier works
DATABASE_URL=postgresql://taxee:taxee@localhost:5432/taxee

# Circle (fill these to activate execution)
CIRCLE_API_KEY=...
CIRCLE_ENTITY_SECRET=...         # 32-byte hex — from Circle developer console
CIRCLE_WALLET_SET_ID=...         # pre-created wallet set ID
CIRCLE_ENVIRONMENT=sandbox       # or production
CIRCLE_PAYMASTER_WALLET_ID=...   # optional — USDC gas abstraction on Base

# Contracts
TAXEE_LOT_REGISTRY_ADDRESS=...
TAXEE_EXECUTOR_ADDRESS=...
USDC_ADDRESS=...
```

### Full real-time execution flow (all Circle pieces wired)
1. `/start` in Telegram → send wallet address (0x...)
2. Bot scans live balances + imports tax lots (Alchemy + CoinGecko)
3. Agent creation auto-provisions a Circle developer wallet (`/developer/wallets`)
4. Heartbeat runs Claude pipeline → stores `candidateAction` with every opportunity
5. Claude sends rich Telegram notification with Approve/Defer/Skip buttons
6. User taps **Approve** → bot fires `executeOpportunity()`:
   - Validates guardrails (wash-sale, policy cap)
   - `commitDisposal()` via Circle developer wallet → Arc record written
   - `parkInUsyc()` for HARVEST type → proceeds parked in USYC yield
   - `executedAt` + `arcRecordId` + `txHash` written back to DB
7. Cross-chain: `bridgeUsdcViaCctp()` burns on source → polls Iris attestation → relays on Base

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
  Tax Engine (pure TS) → CandidateAction[]  ← stored in opportunities.candidate_action
  LLM Action Reasoner → EXECUTE / DEFER / SKIP
  LLM Explanation Generator → headline + body
        ↓
  Telegram notification (manual) or immediate execute (delegated)
        ↓
  User approves (Telegram button / POST /actions/:id/approve)
        ↓
  executeOpportunity()
    → validateForExecution() guardrails
    → ArcClient.writeDisposalRecord()            [MANDATORY — fails closed]
    → Circle /developer/transactions/contractExecution
        → TaxeeLotRegistry.commitDisposal()
        → TaxeeExecutor.parkInUsyc()             [HARVEST only]
    → opportunities.executedAt + txHash updated
        ↓
  (cross-chain) bridgeUsdcViaCctp()
    → TokenMessenger.depositForBurn()
    → poll Iris attestation
    → MessageTransmitter.receiveMessage() on Base
```

---

## Production Roadmap

Everything needed to go from working hackathon demo → production-grade service.

---

### 🔴 P0 — Blocks any real user

#### Execution
- [ ] **Fill Circle credentials** — `CIRCLE_API_KEY` + `CIRCLE_ENTITY_SECRET` + `CIRCLE_WALLET_SET_ID`; all code is wired, execution is one env-var fill away
- [ ] **Mainnet contract deploy** — re-deploy `TaxeeLotRegistry` + `TaxeeExecutor` on Base mainnet with real Hashnote USYC address (`0x...`)
- [ ] **Transaction simulation** — run viem `simulateContract()` before every Circle execution; abort on revert or if tax impact > policy cap
- [ ] **CCTP mainnet test** — verify `bridgeUsdcViaCctp` end-to-end on Base mainnet before enabling for users

#### Security
- [ ] **Wallet ownership verification** — require SIWE signed message before linking a wallet to Telegram user; currently trusts address as-is
- [ ] **Telegram webhook mode** — switch from long-polling to HTTPS webhook + secret token validation
- [ ] **API authentication** — add JWT middleware to all Fastify routes (SIWE for web, `chat_id` binding for Telegram)
- [ ] **Secrets management** — move keys out of `.env` into AWS Secrets Manager / Vault; rotate on breach
- [ ] **Rate limiting** — `@fastify/rate-limit` on all public endpoints

#### Data integrity
- [ ] **DEX swap lot import** — current importer only catches inbound ETH transfers; add Uniswap V2/V3 `Swap` event parsing for cost-basis lots
- [ ] **Lot confirmation flow** — imported lots are provisional; add user confirmation before feeding tax decisions
- [ ] **Wash sale cross-wallet detection** — current check is per-agent; must check all wallets owned by the same user

---

### 🟠 P1 — Required before charging users

#### Reliability
- [ ] **Job queue** — replace `node-cron` with Inngest (durable, retryable, per-agent fan-out, dead-letter)
- [ ] **Heartbeat idempotency** — add `UNIQUE(agent_id, type, lot_id)` or dedup insert to prevent duplicate opportunity rows
- [ ] **LLM fallback** — Claude down → `deterministicRecommendation` from tax engine; surface `llm_unavailable: true`
- [ ] **DB connection pooling** — add PgBouncer or `pg` pool; Drizzle single connection won't survive concurrent agents
- [ ] **Error alerting** — Sentry on heartbeat failures, execution errors, LLM schema validation failures
- [ ] **Retry + circuit breaker** — exponential backoff on Alchemy, CoinGecko, Circle, Arc, Iris API calls

#### Compliance
- [ ] **Arc REST read path** — wire `arcClient.listDisposalRecords()` to real lot records for compliance export
- [ ] **Form 8949 export** — aggregate Arc records per tax year → CSV; `GET /arc/:agentId/form8949`
- [ ] **Audit log** — every state change (lot status, opportunity lifecycle) must be append-only with actor + timestamp

#### Lot data quality
- [ ] **CSV cost-basis override** — let users upload Coinbase/Kraken CSV to correct provisional lots
- [ ] **Historical price caching** — cache CoinGecko historical prices in Postgres; avoid re-fetching same date twice

---

### 🟡 P2 — Quality of life / scale

#### Real market signals
- [ ] **Regime signals** — replace stubs with real Defillama (TVL, stablecoin flows) + Glassnode (funding rate, realized vol)
- [ ] **Price feed fallback** — Chainlink on-chain price when CoinGecko is unavailable
- [ ] **Multi-asset correlation table** — expand `correlations.json` from 4 pairs to top-50 DeFi assets

#### Frontend
- [ ] **Dashboard** — connect Next.js to real API (`GET /portfolio/:agentId`, `GET /opportunities/:agentId`)
- [ ] **Opportunity approval UI** — web-based Execute/Defer/Skip (currently Telegram-only)
- [ ] **After-tax return chart** — realized YTD from `opportunities` table; gross vs after-tax delta
- [ ] **Arc compliance page** — Form 8949 preview + CSV download
- [ ] **SIWE login** — wallet-connect → sign → JWT; tie web session to existing `userId`

#### Tax engine improvements
- [ ] **Short-term vs long-term rate input** — user's marginal rate for accurate `taxSavingEstimate`
- [ ] **AMT / NIIT flags** — warn users approaching $200k where NIIT applies
- [ ] **Carry-forward loss tracking** — persist prior-year harvested losses; apply to offset current-year gains

#### Infrastructure
- [ ] **Redis caching** — CoinGecko prices (1min TTL), regime state (4h TTL), lot snapshots (per-heartbeat)
- [ ] **Observability** — pino structured logs, trace IDs per heartbeat, LLM + Alchemy latency histograms
- [ ] **MCP server production wiring** — connect `taxee_scan` to live heartbeat; per-`agentId` API key auth

---

### 🔵 P3 — Future product

- [ ] **Multi-jurisdiction** — UK CGT, EU per-country rules, carry-forward allowances
- [ ] **Tax-loss harvesting calendar** — proactive "best days to harvest" based on year-end liability
- [ ] **CEX import** — Binance, Coinbase, Kraken CSV parsers for full off-chain cost-basis history
- [ ] **Email / push notifications** — channel fallback when Telegram unavailable
- [ ] **Institutional tier** — multi-user org accounts, sub-agents per portfolio manager, consolidated Form 8949

---

### Production Readiness Checklist

```
Circle Integration
  ✅ Entity secret RSA-OAEP-SHA256 encryption (node:crypto)
  ✅ Developer-controlled wallet creation (POST /developer/wallets)
  ✅ Developer contract execution (POST /developer/transactions/contractExecution)
  ✅ Circle Paymaster wired (feeConfig.type = PAYMASTER)
  ✅ CCTP V1 burn (depositForBurn via Circle wallet)
  ✅ Iris attestation polling (iris-api.circle.com)
  ✅ CCTP relay (receiveMessage via Circle wallet on destination)
  ✅ USYC park step (TaxeeExecutor.parkInUsyc after commitDisposal)
  ✅ Approve → Execute wired end-to-end (API + Telegram bot)
  ✅ Circle wallet auto-provisioned per agent on creation
  ❌ Credentials not filled (CIRCLE_API_KEY, CIRCLE_ENTITY_SECRET, CIRCLE_WALLET_SET_ID)
  ❌ Contracts on testnet only — need Base mainnet deploy

Security
  ✅ Never stores private keys (Circle MPC developer wallets)
  ✅ LLM cannot bypass policy guardrails (code-enforced in compliance package)
  ❌ Wallet ownership not verified before linking
  ❌ API routes unauthenticated
  ❌ Telegram running in long-polling (not webhook)

Reliability
  ✅ Heartbeat runs every 15min for all active agents
  ✅ LLM outputs Zod-validated (fails closed)
  ✅ Arc write mandatory before on-chain execution (fails closed)
  ✅ USYC park is non-fatal (disposal already committed if park fails)
  ❌ Job queue has no durability (node-cron, drops on restart)
  ❌ No retry logic on external API calls
  ❌ No error alerting / Sentry

Data
  ✅ Lot deduplication via txHash
  ✅ Real on-chain transfer history (Alchemy)
  ✅ candidateAction stored per opportunity (enables any-time execution)
  ❌ DEX swaps not captured (Uniswap, etc.)
  ❌ Wash sale check is per-wallet, not per-user

Compliance
  ✅ Arc contracts deployed + verified
  ✅ Every LLM call logged with promptVersion + tokens
  ✅ Arc write wired to execution (writeDisposalRecord before commitDisposal)
  ❌ Arc REST read path not tested with live records
  ❌ Form 8949 export not connected

Execution
  ✅ Full execution pipeline wired (packages/execution)
  ✅ Policy guardrails enforced before execution (packages/compliance)
  ✅ USYC park step implemented (TaxeeExecutor.parkInUsyc)
  ✅ CCTP bridge implemented (bridgeUsdcViaCctp)
  ✅ Paymaster support implemented
  ❌ Credentials not filled — watch-tier only until then
  ❌ Contracts on testnet — mainnet deploy required
```
