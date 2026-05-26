# Taxee — Backend

Turborepo + pnpm monorepo running the taxee tax routing agent:
Fastify API, a heartbeat worker, the Telegram bot, an MCP server, plus all the shared packages (aggregator, tax-engine, llm, execution, compliance).

---

## 1. What runs here

| Process              | Purpose                                                                            |
|----------------------|------------------------------------------------------------------------------------|
| `apps/api`           | Fastify REST API — SIWE auth, agent CRUD, Circle wallet setup, action routes      |
| `apps/agent`         | node-cron heartbeat — scans every active agent on a 15-minute interval            |
| `apps/telegram-bot`  | grammy bot — onboarding, multi-wallet management, opportunity cards + approvals    |
| `apps/mcp-server`    | MCP tool server (Fastify) — exposes taxee to Claude Desktop / OpenClaw            |

Each app is its own Railpack target and can be deployed independently.

---

## 2. Folder Layout

```
backend/
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── index.ts             Fastify entry
│   │   │   ├── db/                  drizzle config + migrations
│   │   │   └── routes/
│   │   │       ├── auth.ts          SIWE nonce + verify → JWT
│   │   │       ├── agent.ts         List/get agents for the authed user
│   │   │       ├── circle.ts        Circle Web SDK setup / wallet-ready / challenge / token
│   │   │       ├── portfolio.ts     PortfolioSnapshot read
│   │   │       ├── lot.ts           Lot CRUD + CSV upload
│   │   │       └── action.ts        Execute / defer / skip
│   │   └── package.json
│   │
│   ├── agent/
│   │   └── src/
│   │       ├── index.ts             node-cron registration
│   │       ├── heartbeat.ts         9-step pipeline per agent
│   │       ├── trigger.ts           Manual trigger for all active agents
│   │       └── triggerOne.ts        Manual trigger for a single agentId
│   │
│   ├── telegram-bot/
│   │   └── src/
│   │       ├── index.ts             grammy entry, command + callback routing
│   │       └── onboarding.ts        Wallet capture, Circle user creation, multi-wallet
│   │
│   └── mcp-server/
│       └── src/index.ts             MCP tool manifest + JSON-RPC handlers
│
├── packages/
│   ├── db/                          Drizzle ORM schema, Postgres client
│   │   └── src/{schema.ts, client.ts}
│   ├── shared/                      Zod schemas, types, jurisdictions
│   ├── aggregator/                  Data plane
│   │   └── src/
│   │       ├── circleClient.ts          Circle W3S wrapper (entity-secret encryption)
│   │       ├── circleProvisioning.ts    Programmable Wallet bootstrap
│   │       ├── arcClient.ts             Arc ledger writer
│   │       ├── balanceReader.ts         viem multi-chain balance scan
│   │       ├── lotImporter.ts           Historical lot reconstruction from logs
│   │       ├── lotSync.ts               Reconcile DB lots vs onchain
│   │       ├── onchainSignals.ts        Funding rates / vol / flows
│   │       └── priceAggregator.ts       CoinGecko + Chainlink
│   ├── tax-engine/                  Pure-TS decision logic
│   │   └── src/
│   │       ├── lotSelector.ts           HIFO / FIFO / SPECIFIC_ID
│   │       ├── harvestScanner.ts        unrealized_loss > threshold → HARVEST
│   │       ├── rebalanceOptimizer.ts    drift_cost vs tax_cost
│   │       ├── maturationTracker.ts     near-LT lots → PARK_IN_USYC
│   │       ├── scanDiagnostics.ts       Per-lot eligibility traces
│   │       └── data/correlations.json   Asset replacement pairs
│   ├── llm/                         Claude integration
│   │   └── src/
│   │       ├── llmClient.ts             Anthropic SDK wrapper
│   │       ├── goalParser.ts            NL → UserPolicy
│   │       ├── regimeClassifier.ts      Signals → RegimeState
│   │       ├── actionReasoner.ts        CandidateAction → execute/defer/skip
│   │       ├── explanationGenerator.ts  Plain-English card
│   │       └── prompts/                 Versioned prompt templates
│   ├── execution/                   Onchain action layer
│   │   └── src/
│   │       ├── executeOpportunity.ts    Circle / EIP-7702 dispatcher
│   │       ├── eip7702Executor.ts       Calls TaxeeManager from authorized executor
│   │       ├── cctp.ts                  depositForBurn + Iris attestation polling
│   │       ├── watchTxPlan.ts           Read-only "what would happen" plan
│   │       ├── chainConfig.ts           Per-chain RPC, CCTP, explorer config
│   │       └── assetAddresses.ts        Symbol → address resolver
│   ├── compliance/                  Arc writer + Form 8949 projection
│   └── notifications/               Telegram OpportunityNotification adapter
│
├── scripts/                         smoke-production.mjs, check-telegram-bot.mjs, …
├── docker-compose.yml               Postgres + Redis for local dev
├── railpack.json                    API build (default)
├── railpack.agent.json              Heartbeat worker
├── railpack.telegram-bot.json       Telegram bot
├── railpack.mcp-server.json         MCP server
├── turbo.json                       Turborepo pipeline
└── pnpm-workspace.yaml
```

---

## 3. Prerequisites

| Tool       | Version |
|------------|---------|
| Node       | 22+ (required by pnpm 11 / `node:sqlite`) |
| pnpm       | 9+ (11+ recommended) |
| PostgreSQL | 15+ |
| Docker     | optional, for `docker compose up -d` |

---

## 4. Local Setup

```bash
# 1. Install workspace deps
pnpm install

# 2. Configure env
cp .env.example .env       # fill in keys (see §7)

# 3. Bring up Postgres
docker compose up -d

# 4. Migrate the schema
pnpm db:migrate

# 5. Run everything in parallel (turbo + --watch)
pnpm dev
```

### Individual processes

```bash
pnpm --filter @taxee/api dev          # :3001
pnpm --filter @taxee/telegram-bot dev
pnpm --filter @taxee/agent dev
pnpm --filter @taxee/mcp-server dev   # :3002
```

### Trigger one heartbeat manually

```bash
export $(grep -v '^#' .env | xargs) && pnpm --filter @taxee/agent dev:trigger
# Or for a single agent:
pnpm --filter @taxee/agent dev:trigger:one -- <agentId>
```

---

## 5. API Routes

Fastify, mounted from [`apps/api/src/index.ts`](apps/api/src/index.ts).

### Auth (SIWE)

| Method | Path                          | Description                                 |
|--------|-------------------------------|---------------------------------------------|
| POST   | `/auth/nonce`                 | Get a SIWE nonce                            |
| POST   | `/auth/verify`                | Verify SIWE signature → returns JWT         |

### Agents

| Method | Path                          | Description                                 |
|--------|-------------------------------|---------------------------------------------|
| GET    | `/agent`                      | List agents for the authed user             |

### Circle Programmable Wallets

| Method | Path                              | Auth     | Description                              |
|--------|-----------------------------------|----------|------------------------------------------|
| GET    | `/circle/setup/:userId`           | public   | Fresh userToken + encryptionKey + challengeId |
| POST   | `/circle/wallet-ready/:userId`    | public   | Store wallet ID after PIN setup           |
| POST   | `/circle/challenge/:oppId`        | JWT      | Create execution challenge for an opportunity |
| GET    | `/circle/token`                   | JWT      | Refresh Circle user token                 |

### Portfolio / lots / actions

| Method | Path                          | Description                                |
|--------|-------------------------------|--------------------------------------------|
| GET    | `/portfolio/:agentId`         | Current PortfolioSnapshot                  |
| GET    | `/lot/:agentId`               | All lots for the agent                     |
| POST   | `/lot/:agentId/import`        | CSV upload to override provisional lots    |
| POST   | `/action/:id/execute`         | Execute approved opportunity               |
| POST   | `/action/:id/defer`           | Defer with `{ days }`                      |
| POST   | `/action/:id/skip`            | Skip + 7-day cooldown on lot               |

---

## 6. Heartbeat Cycle

Each cron tick runs this pipeline per active agent ([`apps/agent/src/heartbeat.ts`](apps/agent/src/heartbeat.ts)):

```
1. Aggregator           → PortfolioSnapshot (parallel scan per chain)
2. Regime Classifier    → RegimeState  (LLM, 4-hour cache)
3. Tax engine           → CandidateAction[]
4. If no candidates     → log "no opportunities", exit
5. Action Reasoner      → { decision, reasoning, deferDays?, interimAction? }  (LLM)
6a. delegated mode      → guardrails → execute → Arc write → commit hash → notify
6b. manual mode         → emit OpportunityNotification with [Approve][Defer][Skip] buttons
7. Explanation Generator → human-readable card  (LLM)
```

Job durability is provided by node-cron + a `heartbeats` Postgres table; switch to Inngest / BullMQ if you outgrow it.

---

## 7. Environment Variables

| Variable                       | Required | Description |
|--------------------------------|---------:|-------------|
| `DATABASE_URL`                 | ✅       | Postgres connection string |
| `JWT_SECRET`                   | ✅       | ≥32 chars |
| `TELEGRAM_BOT_TOKEN`           | ✅       | From @BotFather |
| `ANTHROPIC_API_KEY`            | ✅       | Claude API key |
| `CIRCLE_API_KEY`               | ✅       | Circle PW key (testnet prefix `TEST_API_KEY:`) |
| `CIRCLE_ENTITY_SECRET`         | ✅       | Hex (64 chars), server-side only |
| `CIRCLE_ENVIRONMENT`           | ✅       | `sandbox` / `production` |
| `CIRCLE_APP_ID`                | ✅       | From Circle Console → User-Controlled → Configurator |
| `CIRCLE_WALLET_SET_ID`         | ✅       | Developer wallet set ID |
| `CIRCLE_WALLET_BLOCKCHAIN`     | ✅       | `ARC-TESTNET` / `BASE-SEPOLIA` / etc. |
| `EXECUTION_CHAIN_ID`           | ✅       | e.g. `5042002` (Arc Testnet) |
| `ARC_RPC_URL`                  | ✅       | Arc node RPC with bearer token |
| `ALCHEMY_API_KEY`              | ✅       | Multi-chain balance + history reads |
| `COINGECKO_API_KEY`            | ✅       | Price lookups |
| `FRONTEND_URL`                 | ✅       | e.g. `http://localhost:3000` (CORS + magic links) |
| `API_URL`                      | ✅       | e.g. `http://localhost:3001` |
| `TAXEE_LOT_REGISTRY_ADDRESS`   | ⚠️       | Arc Testnet `0x0a4aa21D…E27A1` |
| `DELEGATION_REGISTRY_ADDRESS`  | ⚠️       | EIP-7702 registry |
| `TAXEE_MANAGER_ADDRESS`        | ⚠️       | EIP-7702 manager |
| `TAXEE_EXECUTOR_ADDRESS`       | ⚠️       | USYC park/redeem |
| `USDC_ADDRESS` / `USYC_ADDRESS`| ⚠️       | Per-chain token addresses |
| `ETH_RPC_URL` / `ETH_SEPOLIA_RPC_URL` / `BASE_RPC_URL` / `BASE_SEPOLIA_RPC_URL` | ⚠️ | Read-only fallback RPCs |

Use `pnpm exec node scripts/check-telegram-bot.mjs` to validate the bot wiring.

---

## 8. Database

The schema is defined in [`packages/db/src/schema.ts`](packages/db/src/schema.ts) (Drizzle).

```bash
pnpm db:migrate            # apply pending migrations
pnpm --filter @taxee/api db:studio    # Drizzle Studio
pnpm --filter @taxee/api db:reset     # wipe + reseed (dev only)
pnpm db:seed:demo          # seed the fixture portfolio
```

Tables: `users`, `wallets`, `agents`, `lots`, `opportunities`, `llm_logs`, `heartbeats`.

---

## 9. User-controlled Wallet Flow

```
1.  User sends wallet address in Telegram
2.  Bot creates DB user + agent record
3.  Circle user registered (POST /v1/w3s/users)
4.  Bot sends:  <FRONTEND_URL>/setup-wallet?userId=<uuid>
5.  Frontend → GET /circle/setup/:userId  (fresh userToken + encryptionKey + challengeId)
6.  Circle Web SDK opens PIN entry overlay
7.  User sets PIN → MPC wallet created on Arc Testnet
8.  Frontend → POST /circle/wallet-ready/:userId  (wallet ID stored on agent)
9.  Heartbeat detects opportunity → Telegram notification
10. User taps  ✅ Approve
11. Bot → POST /circle/challenge/:oppId  (execution challenge)
12. User opens /execute → confirms with PIN
13. Circle MPC co-signs → broadcast → Arc write → LotRegistry hash commit
```

---

## 10. Railway Deployment

Each Railway service should set **Root Directory = `backend`** and pick the matching Railpack file:

| Service          | `RAILPACK_CONFIG_FILE`           | Start command                              |
|------------------|----------------------------------|--------------------------------------------|
| API              | `railpack.json` *(default)*       | `node apps/api/dist/index.js`              |
| Agent heartbeat  | `railpack.agent.json`             | `node apps/agent/dist/index.js`            |
| Telegram bot     | `railpack.telegram-bot.json`      | `node apps/telegram-bot/dist/index.js`     |
| MCP server       | `railpack.mcp-server.json`        | `node apps/mcp-server/dist/index.js`       |

API only: set `preDeploy = pnpm db:migrate` and `healthcheck = /health` in the Railway UI (do **not** put these in `railway.toml`, that file applies to every service with Root Directory `backend`).

Required Railway env vars: `DATABASE_URL` (e.g. `${{Postgres.DATABASE_URL}}`), plus the full list from §7.

Railpack uses Node 22 — driven by `engines.node`, `.nvmrc`, and the `packages.node` field in each `railpack.*.json`.

---

## 11. Testing

```bash
pnpm test                                       # turbo-fanned tests
pnpm --filter @taxee/tax-engine test            # pure-TS unit tests
pnpm --filter @taxee/aggregator test            # integration vs fixtures
pnpm --filter @taxee/llm test                   # prompt + Zod snapshot tests
pnpm --filter @taxee/api test                   # supertest route tests
```

Tax-engine cases that must pass:

```
✓ HIFO picks the highest-cost-basis lot first
✓ Harvest scanner flags below-threshold positions, skips above
✓ Wash-sale detection: 30-day window correctly applied
✓ Maturation: lots inside policy.maturationBufferDays flagged for PARK
✓ Rebalance: HOLD when tax_cost > drift_cost
✓ Rebalance: REBALANCE when drift_cost > tax_cost
✓ Guardrails: LLM cannot override PARK on a maturing lot
✓ Guardrails: actions outside allowedActions return null
```

---

## 12. Tech Stack

| Layer              | Technology                                                |
|--------------------|-----------------------------------------------------------|
| Runtime            | Node 22, TypeScript ESM                                   |
| API framework      | Fastify                                                   |
| Database           | PostgreSQL + Drizzle ORM                                  |
| LLM                | Anthropic Claude (Sonnet for judgment, Haiku for parsing) |
| Telegram           | grammy                                                    |
| Wallet execution   | Circle Programmable Wallets (user-controlled MPC)         |
| Self-custody       | EIP-7702 via `DelegationRegistry` + `TaxeeManager`         |
| Onchain reads      | viem + Alchemy                                            |
| Job scheduler      | node-cron + Postgres                                      |
| Monorepo           | Turborepo + pnpm workspaces                               |
