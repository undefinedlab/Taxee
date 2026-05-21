# taxee — Project Status

> Last updated: May 21, 2026

---

## Deployed

| Contract | Address | Chain | Status |
|---|---|---|---|
| `TaxeeLotRegistry` | `0x9a16c3d45A3e8Ad23152372405bf1F0dd58496ad` | Arc testnet (5042002) | ✅ Live + Verified |
| `TaxeeExecutor` | `0x7fD85458A0958C5EB52234f3FF4f0C6bf7cC999c` | Arc testnet (5042002) | ✅ Live + Verified |

Arc RPC: `https://rpc.testnet.arc-node.thecanteenapp.com/v1/<token>` (see `contracts/.env`)

---

## What's Done

### Smart Contracts
- [x] `TaxeeLotRegistry.sol` — immutable on-chain lot disposal registry
- [x] `TaxeeExecutor.sol` — atomic USDC → USYC park + redeem executor
- [x] `TaxeeLotRegistry.t.sol` — 34 tests passing (invariants, fuzz, edge cases)
- [x] `TaxeeExecutor.t.sol` — 38 tests passing (NAV appreciation, multi-lot, partial redeems, fuzz)
- [x] `Deploy.s.sol` — deployment script via Arc RPC
- [x] `foundry.toml` — configured with Arc + fuzz/invariant settings
- [x] Deployed + verified on Arc testnet (chain 5042002)

### Backend Scaffold
- [x] Turborepo monorepo with pnpm workspaces
- [x] `apps/api` — Fastify REST API (routes: auth, agent, action, lot, portfolio)
- [x] `apps/agent` — node-cron heartbeat worker (15min, full 9-step pipeline)
- [x] `apps/telegram-bot` — grammy bot (/start /link /status /opportunities + inline keyboard)
- [x] `apps/mcp-server` — Fastify MCP tool server for external LLM orchestrators
- [x] `packages/db` — Drizzle ORM schema + PostgreSQL client (shared by all apps)
- [x] `packages/shared` — TypeScript types: Agent, Lot, PortfolioSnapshot, CandidateAction
- [x] `packages/tax-engine` — pure TS: lotSelector, harvestScanner, maturationTracker, rebalanceOptimizer
- [x] `packages/aggregator` — CircleClient, ArcClient, priceAggregator, onchainSignals
- [x] `packages/llm` — llmClient, goalParser, regimeClassifier, actionReasoner, explanationGenerator + prompts
- [x] `packages/execution` — executeApprovedAction (Circle + Arc + on-chain)
- [x] `packages/compliance` — validateForExecution, isWashSaleSafe, estimateYearEndLiability
- [x] `packages/notifications` — sendOpportunityNotification, sendActionReceipt (Telegram + webhooks)
- [x] `backend/.env` — all vars filled (DB, Circle, Arc, Telegram, contracts, LLM)
- [x] `contracts/.env` — deployer key, Arc RPC, contract addresses

### Frontend
- [x] Next.js 14 + Tailwind scaffolded at `/frontend`
- [x] Components directory exists (29 components)

---

## What's Left

### Critical (blocks demo)

- [ ] **`pnpm install`** — run from `backend/` to install all workspace deps
- [ ] **DB migration** — `pnpm --filter @taxee/api db:migrate` once Postgres is up
- [ ] **Frontend ↔ API wiring** — frontend components not connected to real API endpoints; all data is currently static/mock
- [ ] **Telegram bot token** — fill `TELEGRAM_BOT_TOKEN` in `backend/.env` and start bot
- [ ] **Anthropic API key** — fill `ANTHROPIC_API_KEY` in `backend/.env`
- [ ] **Circle API key + entity secret** — fill in `backend/.env` for execution tier
- [ ] **Demo fixture data** — `fixtures/demo-portfolio.json` needs seeding via `pnpm --filter @taxee/api db:seed`

### Frontend Wiring (all manual right now)

- [ ] `/dashboard` — connect portfolio snapshot to `GET /portfolio/:agentId`
- [ ] `/opportunities` — connect opportunity list to `GET /opportunities/:agentId`
- [ ] Execute / Defer / Skip buttons — wire to `POST /actions/:id/execute|defer|skip`
- [ ] Agent registration form — wire to `POST /agents`
- [ ] Real-time opportunity push — WebSocket or polling from `apps/api`
- [ ] After-tax return chart — pull from `GET /portfolio/:agentId` realized YTD fields
- [ ] Arc compliance export — wire `GET /arc/:agentId/form8949` CSV download button

### Backend Integration Gaps

- [ ] **Circle Wallets** — `packages/aggregator/circle.ts` uses stub; needs real Circle API key to fetch live balances
- [ ] **Arc REST client** — `packages/aggregator/arc.ts` reads from Arc; needs `ARC_BASE_URL` and valid lot records
- [ ] **Onchain import** — `packages/aggregator/onchainImport.ts` viem-based; needs `BASE_RPC_URL` and an actual wallet address to reconstruct provisional lots
- [ ] **LLM prompts** — prompts in `packages/llm/prompts/` are templates; need real Claude calls tested end-to-end
- [ ] **Execution pipeline** — `packages/execution` is wired but Circle entity secret needed for live tx signing
- [ ] **job queue** — heartbeat runs on node-cron every 15 min; Inngest not integrated (cron works for demo)
- [ ] **CCTP** — cross-chain bridging is stubbed; not needed for single-chain demo

### Contracts (mainnet path)

- [ ] Source real Hashnote USYC address on Base mainnet → update `USYC_ADDRESS` in `contracts/.env`
- [ ] Fund deployer wallet with ETH on mainnet
- [ ] Re-deploy via Arc with mainnet `ARC_RPC_URL`
- [ ] Update `backend/.env` with mainnet contract addresses

### Testing

- [ ] Backend package unit tests — `pnpm test` (none written yet, scaffold only)
- [ ] API route tests — supertest against seeded DB
- [ ] End-to-end cycle test — fixture → heartbeat → opportunity → execute → Arc write

---

## How to Run Locally

```bash
# 1. Start Postgres
docker compose up -d

# 2. Install deps
cd backend && pnpm install

# 3. Run migrations
pnpm --filter @taxee/api db:migrate

# 4. Seed demo data
pnpm --filter @taxee/api db:seed

# 5. Start all backend apps
pnpm dev

# 6. Start frontend (separate terminal)
cd frontend && npm run dev
```

API runs on `:3001`, MCP server on `:3002`, frontend on `:3000`.

---

## Architecture in One Line

```
Telegram / Web / MCP
        ↓
  Fastify API (apps/api)
        ↓
  Heartbeat Worker (apps/agent)  ← node-cron, every 15min per active agent
        ↓
  Data Aggregator → LLM Regime → Tax Engine → LLM Reasoner
        ↓
  Circle Wallets → USYC park → Arc ledger write
        ↓
  TaxeeLotRegistry.commitDisposal()  ← on-chain fingerprint
        ↓
  Notification → Telegram / Dashboard
```

---

## Key Constraints Remaining

- No live Circle execution until `CIRCLE_ENTITY_SECRET` is filled — watch tier (notify-only) works today
- USYC is mainnet-only; testnet uses USDC as 1:1 pass-through (no yield, same interface)
- Frontend is a static shell — all wiring to backend is the last major work item
- Arc REST API read path (`packages/aggregator/arc.ts`) needs real lot records before compliance export works
