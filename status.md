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
