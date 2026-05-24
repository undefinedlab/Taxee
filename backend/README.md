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
| Node | 20+ |
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
