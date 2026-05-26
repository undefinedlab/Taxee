# Taxee

> **The first DeFi portfolio agent that optimizes after-tax return, not gross performance.**
> Built for Agora Agents Hackathon 2026 · Primary execution chain: **Arc (5042002)**

taxee watches your wallets, finds harvest / rebalance / park opportunities across chains, and lets a Claude powered agent reason about whether to act now, defer, or skip always in light of your tax position. Execution rides the full Circle stack: Programmable Wallets for MPC signing, CCTP for cross-chain USDC, Paymaster for gasless UX, USYC for yield while you wait for long-term treatment, and Arc as the immutable compliance ledger.

---

## Table of Contents

1. [What Is taxee](#1-what-is-taxee)
2. [Repository Layout](#2-repository-layout)
3. [System Architecture](#3-system-architecture)
4. [How Each Piece of the Circle Stack Is Built](#4-how-each-piece-of-the-circle-stack-is-built)
   - [4.1 Circle Programmable Wallets (user-controlled MPC)](#41-circle-programmable-wallets-user-controlled-mpc)
   - [4.2 Arc — execution + compliance ledger](#42-arc--execution--compliance-ledger)
   - [4.3 CCTP — cross-chain USDC](#43-cctp--cross-chain-usdc)
   - [4.4 Circle Paymaster — gasless UX](#44-circle-paymaster--gasless-ux)
   - [4.5 USYC — yield while parked](#45-usyc--yield-while-parked)
   - [4.6 EIP-7702 — self-custody delegation](#46-eip-7702--self-custody-delegation)
5. [Deployed Contracts (all networks)](#5-deployed-contracts-all-networks)
6. [Quick Start](#6-quick-start)
7. [Per-folder READMEs](#7-per-folder-readmes)
8. [Environment Variables](#8-environment-variables)
9. [Design Rules](#9-design-rules)

---

## 1. What Is taxee

DeFi portfolio agents today are tax-blind they rebalance on drift, rotate on regime, and harvest gains across chains, silently destroying after-tax returns. Every disposal is a taxable event. Every rebalance has a tax cost. Every win held one day short of long-term treatment is money left on the table.

taxee embeds tax awareness as a first-class input into every agent decision:

| Decision  | Without taxee              | With taxee                                        |
|-----------|----------------------------|---------------------------------------------------|
| Rebalance | Execute on drift threshold | Weigh disposal tax cost vs drift cost first       |
| Rotate    | Follow regime signal       | Factor realized gains before switching            |
| Hold      | No opinion on lot age      | Park near-LT lots in USYC to mature               |
| Harvest   | Manual or never            | Auto-scan all chains, book losses, replace exposure |

Two operating modes:

- **Manual** — agent proposes, user taps Execute / Defer / Skip in Telegram (or web).
- **Delegated** — agent acts autonomously inside your policy, always notifies, can be vetoed.

---

## 2. Repository Layout

```
taxee/
├── backend/        # Turborepo + pnpm — API, heartbeat agent, Telegram bot, MCP server
│   ├── apps/
│   │   ├── api/             Fastify REST API (auth, agents, lots, Circle wallet routes)
│   │   ├── agent/           Heartbeat worker (node-cron, scans every 15 min)
│   │   ├── telegram-bot/    grammy bot — onboarding, notifications, inline approvals
│   │   └── mcp-server/      MCP tools for Claude Desktop / OpenClaw
│   └── packages/
│       ├── db/              Drizzle ORM schema + Postgres client
│       ├── shared/          Zod schemas + cross-package types
│       ├── aggregator/      Circle / Arc / Alchemy / CoinGecko adapters
│       ├── tax-engine/      HIFO selector, harvest scanner, rebalance optimizer (pure TS)
│       ├── llm/             Claude clients — goal parser, regime, action reasoner
│       ├── execution/       executeOpportunity, CCTP, EIP-7702 executor, chain config
│       ├── compliance/      Arc ledger writer + Form 8949 projection
│       └── notifications/   Telegram notification adapter
│
├── contracts/      # Foundry — TaxeeLotRegistry, TaxeeExecutor, DelegationRegistry, TaxeeManager
│   ├── src/
│   ├── script/Deploy.s.sol  # DeployArc + DeployEthSepolia + Base targets
│   ├── deployments/         # JSON files committed per chain after deploy
│   └── eip7702/             # Hardhat sub-project for EIP-7702 self-custody flow
│
├── frontend/       # Next.js 15 (App Router) — landing, onboarding, dashboard
│   ├── app/
│   │   ├── onboarding/      Wallet entry, preferences, approval mode
│   │   ├── setup-wallet/    Circle Web SDK PIN setup overlay
│   │   ├── execute/         Per-opportunity execution challenge confirmation
│   │   ├── dashboard/       Live agent dashboard + opportunity cards
│   │   └── watch/           Read-only mode
│   ├── components/          Landing, dashboard, onboarding, wallet, UI primitives
│   └── lib/                 wagmi, web SDK helpers, API client, types
│
└── docs/           # Architecture refs — Circle MPC, EIP-7702, wallet options, tx architecture
```

---

## 3. System Architecture

```
       Telegram                 Web (Next.js)             MCP (Claude Desktop)
            \                         |                          /
             \________________________|_________________________/
                                      |
                                      ▼
                          Fastify API  (backend/apps/api)
                           ├─ /auth   SIWE → JWT
                           ├─ /agent  create / list
                           ├─ /circle setup / wallet-ready / challenge / token
                           └─ /portfolio, /lot, /action
                                      |
                                      ▼
            ┌─────────────────────────┴───────────────────────────┐
            │           Heartbeat  (backend/apps/agent)           │
            │           runs every 15 min per active agent        │
            └─────────────────────────┬───────────────────────────┘
                                      ▼
                          aggregator → tax-engine → llm
                                      │
                          CandidateAction[] (HARVEST | REBALANCE | PARK)
                                      ▼
            ┌─────────────────────────┴────────────────────────────────┐
            │  approval.mode = manual    │   approval.mode = delegated │
            │  Telegram card w/ buttons  │   guardrails → auto-execute │
            └─────────────────────────┬────────────────────────────────┘
                                      ▼
                          execution package → Circle / EIP-7702
                                      │
                                      ▼
                  Arc ledger write  +  TaxeeLotRegistry.commitDisposal
                                      │
                                      ▼
                          Form 8949 projection (compliance)
```

**Who does what:**

| Task                                         | Owner             |
|----------------------------------------------|-------------------|
| Parse goals from natural language            | Claude (LLM)      |
| Regime classification from onchain signals   | Claude (LLM)      |
| "Execute now / defer / skip" judgment        | Claude (LLM)      |
| Plain-English explanation                    | Claude (LLM)      |
| HIFO lot selection                           | tax-engine (TS)   |
| Harvest threshold / wash-sale checks         | tax-engine (TS)   |
| Policy guardrail enforcement                 | execution (TS)    |
| Transaction signing & broadcast              | Circle PW (MPC)   |
| Cross-chain USDC bridging                    | CCTP              |
| Immutable disposal record                    | Arc + LotRegistry |

---

## 4. How Each Piece of the Circle Stack Is Built

This is the section judges and contributors should read first — how taxee actually uses each Circle product.

### 4.1 Circle Programmable Wallets (user-controlled MPC)

**Goal:** Let a Telegram only user create a self custodial wallet without a seed phrase, then have taxee execute transactions on their behalf but only after the user confirms each one with a PIN.

**Build:**

- **Backend** ([backend/packages/aggregator/circleClient.ts](backend/packages/aggregator/circleClient.ts), [backend/apps/api/src/routes/circle.ts](backend/apps/api/src/routes/circle.ts)) wraps the Circle W3S API. The entity secret is RSA-OAEP-SHA256 encrypted per request and never leaves the backend.
- **Onboarding** — when a Telegram user sends their wallet address, the API calls `POST /v1/w3s/users` to register a Circle user keyed by the agent UUID, then issues a one-shot `userToken + encryptionKey + challengeId` for PIN setup.
- **Frontend** ([frontend/app/setup-wallet/page.tsx](frontend/app/setup-wallet/page.tsx), [frontend/components/wallet/circle-wallet-setup.tsx](frontend/components/wallet/circle-wallet-setup.tsx)) loads `@circle-fin/w3s-pw-web-sdk`, opens the PIN overlay, and creates the MPC wallet on Arc Testnet (`ARC-TESTNET` blockchain ID).
- **Execution** — when the agent decides to act, the backend creates an execution challenge ([POST /circle/challenge/:oppId](backend/apps/api/src/routes/circle.ts)), the user opens the `/execute` page, taps Confirm, and the Circle MPC nodes co-sign and broadcast.

**Key design:** taxee never holds the user's key. Every disposal requires a fresh challenge → PIN → MPC signature; there is no long-lived authority on the Circle side.

### 4.2 Arc — execution + compliance ledger

**Goal:** Use Arc as both an EVM execution chain (cheap, fast, USDC-native gas) and an append-only audit trail that backs every Form 8949 line item.

**Build:**

- **Execution chain.** All taxee custom contracts (LotRegistry, Executor, DelegationRegistry, TaxeeManager) are deployed to **Arc Testnet chain 5042002**. USDC is the native gas token on Arc, so Circle Programmable Wallets sign transactions paid in USDC directly — no ETH gas wallet to top up.
- **Compliance ledger.** Every executed disposal writes a structured `ArcRecord { lotId, dateAcquired, dateSold, proceeds, costBasis, gainLoss, term, txHash, rationale }` to Arc via [backend/packages/aggregator/arcClient.ts](backend/packages/aggregator/arcClient.ts), then anchors a `keccak256(ArcRecord)` hash on-chain via [`TaxeeLotRegistry.commitDisposal`](contracts/src/TaxeeLotRegistry.sol).
- **Form 8949 export.** [backend/packages/compliance](backend/packages/compliance/src/index.ts) aggregates Arc records per agent / tax year, splits ST vs LT, and exports CSV.

Why both off-chain + on-chain? Arc is the system of record (rich, queryable); the lot hash on-chain makes the record non-repudiable (you can prove the disposal record existed at the timestamp it was written).

### 4.3 CCTP — cross-chain USDC

**Goal:** When taxee harvests on Base and decides to park the proceeds in USYC (on a different chain) or rebalance to Arc, USDC moves natively — no wrapped tokens, no bridges that can be drained.

**Build:**

- [backend/packages/execution/cctp.ts](backend/packages/execution/src/cctp.ts) wraps the standard CCTP flow: `depositForBurn` on the source `TokenMessenger`, poll the Circle Iris attestation API, then `receiveMessage` on the destination `MessageTransmitter`.
- Per-chain contract addresses + CCTP domain numbers are centralised in [backend/packages/execution/chainConfig.ts](backend/packages/execution/src/chainConfig.ts):

  | Chain            | chainId   | CCTP Domain | TokenMessenger                                 |
  |------------------|-----------|-------------|------------------------------------------------|
  | Ethereum         | 1         | 0           | `0xbd3fa81b58ba92a82136038b25adec7066af3155` |
  | Ethereum Sepolia | 11155111  | 0           | `0x9f3b8679c73c2fef8b59b4f3444d4e156fb70aa5` |
  | Base             | 8453      | 6           | `0x1682ae6375c4e4a97e4b583bc394c861a46d8962` |
  | Base Sepolia     | 84532     | 6           | `0x9f3b8679c73c2fef8b59b4f3444d4e156fb70aa5` |
  | Arbitrum         | 42161     | 3           | (see chainConfig.ts)                           |
  | Arc Testnet      | 5042002   | 7           | (Circle Iris)                                  |

- Circle Programmable Wallets handle the `depositForBurn` call directly — no separate relayer needed.

### 4.4 Circle Paymaster — gasless UX

**Goal:** New Telegram users should never see "you need ETH for gas" — the first thing they do shouldn't be funding a gas wallet.

**Build:**

- On Arc, USDC is native gas, so Paymaster isn't required there — that's the primary execution chain.
- On Base / Base Sepolia, the execution package uses the ERC-4337 entrypoint with Circle's Paymaster so the user can pay gas in USDC out of the same balance taxee is rebalancing. Wallet env: `CIRCLE_PAYMASTER_WALLET_ID` in [backend/.env](backend/.env).
- The Paymaster path is invoked from [backend/packages/execution/executeOpportunity.ts](backend/packages/execution/src/executeOpportunity.ts) when the target chain is Base.

### 4.5 USYC — yield while parked

**Goal:** When the agent identifies a lot that's about to cross the 365-day long-term threshold (or a wash-sale window that needs to close), taxee parks the capital in USYC (Hashnote/BlackRock USD Institutional Digital Liquidity) so it earns yield instead of sitting idle.

**Build:**

- [`TaxeeExecutor.parkInUsyc(usdcAmount, lotId, agent)`](contracts/src/TaxeeExecutor.sol) atomically transfers USDC in, approves USYC, deposits, and emits `ParkedInUsyc(agent, lotId, usdcAmount, shares)`. Atomic = both succeed or both revert.
- `redeemFromUsyc(shares)` is the reverse path when the lot matures or the wash window clears.
- On testnet, the contract is wired to USDC as USYC (`USYC_ADDRESS == USDC_ADDRESS`) — a pass-through so the full flow works without a real yield token. Mainnet deploy swaps in Hashnote USYC on Base.

### 4.6 EIP-7702 — self-custody delegation

**Goal:** Power users who already hold a MetaMask / Rainbow wallet shouldn't have to move funds into a Circle MPC wallet. EIP-7702 lets them delegate execution authority to `TaxeeManager` via signature.

**Build:**

- [`DelegationRegistry`](contracts/src/DelegationRegistry.sol) — stores the user's delegation (delegate address, policy hash, expiration, per-tx & monthly limits), validates signatures, tracks monthly usage with a 30-day rolling reset, supports revocation.
- [`TaxeeManager`](contracts/src/TaxeeManager.sol) — the contract users delegate to. Executes harvest / rebuy / yield-move, enforces 1% slippage, 5-minute rebuy cooldown, asset whitelist.
- [backend/packages/execution/eip7702Executor.ts](backend/packages/execution/src/eip7702Executor.ts) — server-side path the heartbeat takes when an agent is configured for delegated EIP-7702 (instead of Circle MPC).
- Frontend signing flow lives in [frontend/components/wallet/use-taxee-contracts.ts](frontend/components/wallet/use-taxee-contracts.ts).

---

## 5. Deployed Contracts (all networks)

> Authoritative source: [contracts/deployments/](contracts/deployments/) (one JSON per chain, written by `forge script`).

### Arc Testnet — chainId `5042002` (primary execution chain)

| Contract             | Address                                      |
|----------------------|----------------------------------------------|
| `TaxeeLotRegistry`   | `0x0a4aa21D151635e16DD659ad607Eb6cFD11E27A1` |
| `DelegationRegistry` | `0xbC8E45D8314EA7b46CaE4de0856d28262b3b244d` |
| `TaxeeManager`       | `0xd335C4B56Ac9664413120f21c10b9F7aaC651AE0` |
| `TaxeeExecutor`      | `0x7fD85458A0958C5EB52234f3FF4f0C6bf7cC999c` |
| USDC (native gas)    | `0x0000000000000000000000000000000000000000` |

RPC: `https://rpc.testnet.arc-node.thecanteenapp.com/v1/...`

### Ethereum Sepolia — chainId `11155111`

| Contract             | Address                                      |
|----------------------|----------------------------------------------|
| `DelegationRegistry` | `0x786D17590AF61F06d6BBc2B77621a72a25F4A527` |
| `TaxeeManager`       | `0x919B8F07Ec889922AE08BA8CC64C43aaA9a34A37` |
| USDC                 | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` |
| WETH                 | `0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14` |

### Base Sepolia — chainId `84532`

| Contract             | Address                                      |
|----------------------|----------------------------------------------|
| `DelegationRegistry` (EIP-7702) | `0x403Fe0408976b518b2952BdF590135Ec6ba12ebc` |
| `TaxeeManager` (EIP-7702)       | `0xEE8DAE2D3f142052bDb704Ba0D94e04eC1680193` |
| USDC                 | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| WETH                 | `0x4200000000000000000000000000000000000006` |

Full per-chain config (CCTP domains, RPC env vars, explorer URLs) lives in [backend/packages/execution/chainConfig.ts](backend/packages/execution/src/chainConfig.ts).

---

## 6. Quick Start

### Prerequisites
- Node 22+, pnpm 9+
- PostgreSQL 15+ (or `docker compose up -d` from `backend/`)
- Foundry (`curl -L https://foundry.paradigm.xyz | bash`)
- Anthropic, Circle, Alchemy, CoinGecko, Telegram bot tokens

### Run the full stack locally

```bash
# 1. Backend (api + agent + telegram-bot + mcp-server in parallel)
cd backend
cp .env.example .env   # fill in keys
pnpm install
docker compose up -d   # Postgres
pnpm db:migrate
pnpm dev

# 2. Frontend
cd ../frontend
cp .env.example .env.local
npm install
npm run dev            # http://localhost:3000

# 3. (Optional) Redeploy contracts to Arc Testnet
cd ../contracts
forge build
forge script script/Deploy.s.sol:DeployArc \
  --rpc-url arc_testnet --broadcast --private-key $DEPLOYER_PRIVATE_KEY
```

### Trigger one heartbeat manually

```bash
cd backend
export $(grep -v '^#' .env | xargs) && pnpm --filter @taxee/agent dev:trigger
```

---

## 7. Per-folder READMEs

Each subdirectory has its own deep-dive README:

- **[backend/README.md](backend/README.md)** — monorepo layout, apps, packages, API routes, deployment (Railway)
- **[contracts/README.md](contracts/README.md)** — every contract, every address, every deploy command
- **[frontend/README.md](frontend/README.md)** — routes, components, Circle Web SDK + wagmi wiring
- **[contracts/eip7702/README.md](contracts/eip7702/README.md)** — EIP-7702 self-custody flow

---

## 8. Environment Variables

The canonical examples live in `backend/.env.example` and `frontend/.env.example`. The most important ones:

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/taxee

# LLM
ANTHROPIC_API_KEY=sk-ant-...

# Circle Programmable Wallets
CIRCLE_API_KEY=TEST_API_KEY:...
CIRCLE_ENTITY_SECRET=...               # server-side only
CIRCLE_ENVIRONMENT=sandbox
CIRCLE_APP_ID=...
CIRCLE_WALLET_SET_ID=...
CIRCLE_WALLET_BLOCKCHAIN=ARC-TESTNET

# Arc
ARC_RPC_URL=https://rpc.testnet.arc-node.thecanteenapp.com/v1/...
EXECUTION_CHAIN_ID=5042002

# Taxee contracts (Arc Testnet)
TAXEE_LOT_REGISTRY_ADDRESS=0x0a4aa21D151635e16DD659ad607Eb6cFD11E27A1
DELEGATION_REGISTRY_ADDRESS=0xbC8E45D8314EA7b46CaE4de0856d28262b3b244d
TAXEE_MANAGER_ADDRESS=0xd335C4B56Ac9664413120f21c10b9F7aaC651AE0
TAXEE_EXECUTOR_ADDRESS=0x7fD85458A0958C5EB52234f3FF4f0C6bf7cC999c

# Chain RPCs
ETH_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/...
ETH_SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/...
BASE_RPC_URL=https://mainnet.base.org
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org

# Data / prices / messaging
ALCHEMY_API_KEY=...
COINGECKO_API_KEY=...
TELEGRAM_BOT_TOKEN=...

# Auth
JWT_SECRET=...                         # ≥32 chars
APP_URL=http://localhost:3000
```

---

## 9. Design Rules

1. **LLM in, LLM out — both structured.** Every Claude call returns JSON validated against a Zod schema. Never parse free-form text for a decision.
2. **tax-engine is pure TypeScript.** No API calls, no side effects, all unit-testable.
3. **Code enforces guardrails; LLM cannot bypass policy.** `validateApprovedAction` runs in code before any broadcast.
4. **Lots are the unit of truth.** Every disposal pins the exact lot — acquisition date, cost basis, quantity, chain.
5. **Fail closed on tax ambiguity.** Unknown lot identity or holding period → defer, not execute.
6. **taxee never stores private keys.** Watch tier = address only. Execute tier = Circle Programmable Wallet (MPC) or EIP-7702 delegation.
7. **Every LLM call is logged.** `promptVersion + input + output` in `llm_logs` — essential for debugging and compliance.
8. **Arc write is non-negotiable.** Every executed disposal writes to Arc and commits a hash to `TaxeeLotRegistry` before the agent considers the action complete.

---

<p align="center">
  Built with love for Agora Agents Hackathon 2026 🤍 Built for the DeFi user who's tired of paying tax on every rebalance: no spreadsheets, no CPA, no April surprise. Just an agent that thinks in after tax dollars.
</p>
