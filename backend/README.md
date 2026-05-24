# taxee — Backend

TypeScript monorepo powering the taxee AI tax-routing agent. Built on Turborepo + pnpm workspaces.

---

## What It Does

taxee is the first DeFi portfolio agent that optimises for **after-tax return** (not gross). The backend runs the full pipeline:

1. **Heartbeat** — scans your wallet every 15 minutes
2. **Tax engine** — flags harvest, rebalance, park, and hold opportunities
3. **LLM reasoning** — Claude evaluates and explains each opportunity
4. **Telegram bot** — notifies you and collects approval
5. **Circle execution** — user-controlled MPC wallet signs the transaction with your PIN
6. **Compliance** — Arc ledger write + on-chain lot registry

---

## Monorepo Structure

```
apps/
  api/          Fastify REST API (auth, agent, lots, circle wallet routes)
  agent/        node-cron heartbeat worker (runs every 15 min)
  telegram-bot/ grammy bot (notifications, approvals, wallet linking)
  mcp-server/   Fastify MCP tool server for external LLM orchestrators

packages/
  db/           Drizzle ORM schema + client (PostgreSQL)
  shared/       Zod schemas + TypeScript types
  aggregator/   CircleClient, ArcClient, priceAggregator, onchainSignals
  tax-engine/   lotSelector, harvestScanner, rebalanceOptimizer (pure TS)
  llm/          Claude integration — goalParser, actionReasoner, explanationGenerator
  execution/    executeApprovedAction (Circle + Arc + on-chain)
  compliance/   validateForExecution, isWashSaleSafe, estimateYearEndLiability
  notifications/ sendOpportunityNotification, sendActionReceipt (Telegram)
```

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node | 22+ (required for pnpm 11; uses `node:sqlite`) |
| pnpm | 9+ |
| PostgreSQL | 15+ |

---

## Setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in the required values (see [Environment Variables](#environment-variables)).

### 3. Start PostgreSQL

```bash
docker compose up -d   # or use your own Postgres instance
```

### 4. Run database migrations

```bash
pnpm --filter @taxee/api db:migrate
```

### 5. Start all services

```bash
pnpm dev
```

This runs all apps in parallel via Turborepo with `--watch` hot-reload.

---

## Railway (Production)

Deploy from the **`backend/`** directory (set **Root Directory** to `backend` on every service). Builds use [Railpack](https://railpack.com); `railpack.json` at the repo root of that directory defines the default API build and start command.

### 1. Add PostgreSQL

In your Railway project:

1. Click **+ New** → **Database** → **PostgreSQL**
2. On the API service, add a variable reference:
   ```
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   ```
   (Use your Postgres service name if it is not `Postgres`.)

Redis from `docker-compose.yml` is optional locally; the app does not require it in production.

### 2. API service (`taxee-production.up.railway.app`)

| Setting | Value |
|---------|-------|
| Root Directory | `backend` |
| Config | default `backend/railpack.json` |
| Start Command | `node apps/api/dist/index.js` *(from `railpack.json`)* |
| Pre-deploy *(API only, set in Railway UI)* | `pnpm db:migrate` |
| Healthcheck *(API only)* | `/health` |

Do **not** put `startCommand` / `preDeploy` in `railway.toml` — that file applies to every service with Root Directory `backend` (including the Telegram bot).

If Railpack still reports “No start command”, confirm Root Directory is `backend` (not the monorepo root) and redeploy after pulling these config files.

Railpack uses Node 22 (`engines.node`, `.nvmrc`, and `railpack.json` `packages.node`) because **pnpm 11** depends on the built-in `node:sqlite` module (not available on Node 20).

Required env vars (set in Railway → Variables):

| Variable | Example |
|----------|---------|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `JWT_SECRET` | random 32+ char string |
| `APP_URL` | your frontend URL (CORS) |
| `FRONTEND_URL` | your frontend URL |
| `API_URL` | `https://taxee-production.up.railway.app` |
| `TELEGRAM_BOT_TOKEN` | from @BotFather |
| `ANTHROPIC_API_KEY` | Claude key |
| `CIRCLE_*` | Circle wallet keys |
| `ALCHEMY_API_KEY` | on-chain reads |
| `COINGECKO_API_KEY` | price lookups |

Railway sets `PORT` automatically — the API already reads it.

### 3. Worker services (optional, same repo)

Create **separate** Railway services with Root Directory `backend` and set **`RAILPACK_CONFIG_FILE`** so Railpack builds and starts the right app:

| Service | `RAILPACK_CONFIG_FILE` | Start command (in config) |
|---------|------------------------|---------------------------|
| Agent heartbeat | `railpack.agent.json` | `node apps/agent/dist/index.js` |
| Telegram bot | `railpack.telegram-bot.json` | `node apps/telegram-bot/dist/index.js` |
| MCP server | `railpack.mcp-server.json` | `node apps/mcp-server/dist/index.js` |

**Railpack “config file not found”?** The telegram/agent/mcp configs live under `backend/`. Either set **Root Directory** to `backend` (recommended), or use repo root with `RAILPACK_CONFIG_FILE=railpack.telegram-bot.json` (wrapper at monorepo root).

You can still use `pnpm start:agent` etc. locally. Copy the same env vars (especially `DATABASE_URL`) to each worker service.

### Individual services

```bash
pnpm --filter @taxee/api dev          # API on :3001
pnpm --filter @taxee/telegram-bot dev # Telegram bot
pnpm --filter @taxee/agent dev        # Heartbeat cron worker
pnpm --filter @taxee/mcp-server dev   # MCP server on :3002
```

---

## Database

```bash
# Wipe and reseed (development only)
pnpm --filter @taxee/api db:reset

# Push schema changes
pnpm --filter @taxee/api db:migrate

# Open Drizzle Studio
pnpm --filter @taxee/api db:studio
```

---

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/auth/nonce` | Get SIWE nonce |
| `POST` | `/auth/verify` | Verify SIWE signature → JWT |
| `GET` | `/agent` | List user's agents |
| `GET` | `/circle/setup/:userId` | Get fresh Circle SDK credentials (public) |
| `POST` | `/circle/wallet-ready/:userId` | Store wallet ID after PIN setup (public) |
| `POST` | `/circle/challenge/:oppId` | Create execution challenge for an opportunity |
| `GET` | `/circle/token` | Refresh Circle user token (JWT required) |

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | ≥32 chars, used to sign session tokens |
| `TELEGRAM_BOT_TOKEN` | ✅ | From @BotFather |
| `ANTHROPIC_API_KEY` | ✅ | Claude API key |
| `CIRCLE_API_KEY` | ✅ | Circle Programmable Wallets API key (testnet prefix: `TEST_API_KEY:`) |
| `CIRCLE_ENTITY_SECRET` | ✅ | Circle entity secret (hex, 64 chars) |
| `CIRCLE_ENVIRONMENT` | ✅ | `sandbox` or `production` |
| `CIRCLE_APP_ID` | ✅ | App ID from Circle Console → User Controlled → Configurator |
| `CIRCLE_WALLET_SET_ID` | ✅ | Wallet set ID for developer-controlled wallets |
| `ALCHEMY_API_KEY` | ✅ | For on-chain portfolio reads |
| `COINGECKO_API_KEY` | ✅ | For token price lookups |
| `FRONTEND_URL` | ✅ | e.g. `http://localhost:3000` |
| `API_URL` | ✅ | e.g. `http://localhost:3001` |
| `TAXEE_LOT_REGISTRY_ADDRESS` | ⚠️ | Deployed contract address (Base Sepolia) |
| `TAXEE_EXECUTOR_ADDRESS` | ⚠️ | Deployed contract address (Base Sepolia) |
| `ARC_BASE_URL` | ⚠️ | Arc compliance ledger RPC URL |

---

## User-Controlled Wallet Flow

```
1. User sends wallet address in Telegram
       ↓
2. Bot creates DB user + agent record
       ↓
3. Circle user registered (POST /v1/w3s/users)
       ↓
4. Bot sends: localhost:3000/setup-wallet?userId=<uuid>
       ↓
5. Frontend calls GET /circle/setup/:userId
   → fresh userToken + encryptionKey + challengeId
       ↓
6. Circle Web SDK opens PIN entry overlay
       ↓
7. User sets PIN → MPC wallet created on Base Sepolia
       ↓
8. Frontend calls POST /circle/wallet-ready/:userId
   → wallet ID stored on agent record in DB
       ↓
9. Agent heartbeat detects opportunity → sends Telegram notification
       ↓
10. User taps ✅ Approve
        ↓
11. Bot calls POST /circle/challenge/:oppId
    → execution challenge created
        ↓
12. User opens execute link, confirms with PIN
        ↓
13. Circle MPC nodes co-sign → transaction submitted on-chain
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node 20, TypeScript (ESM) |
| API framework | Fastify |
| Database | PostgreSQL + Drizzle ORM |
| LLM | Anthropic Claude (`claude-3-5-sonnet`) |
| Telegram | grammy |
| Wallet execution | Circle Programmable Wallets (user-controlled) |
| Chain reads | viem + Alchemy |
| Job scheduler | node-cron |
| Monorepo | Turborepo + pnpm workspaces |
