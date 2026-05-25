# taxee — Frontend

Next.js 15 (App Router) app for the taxee tax-optimization agent — landing site, onboarding, Circle Web SDK PIN setup, opportunity execution, and the live dashboard.

---

## 1. Routes

| Path                        | Purpose                                                                 |
|-----------------------------|-------------------------------------------------------------------------|
| `/`                         | Landing — light bento layout, GSAP morphing background, theme toggle    |
| `/onboarding`               | Phase 1 — wallet address, preferences (LLM goal parser), approval mode  |
| `/setup-wallet?userId=…`    | Circle Web SDK PIN overlay → MPC wallet on Arc Testnet                  |
| `/execute?challengeId=…`    | Per-opportunity execution challenge confirmation                        |
| `/watch`                    | Read-only mode for users who haven't completed wallet setup             |
| `/dashboard`                | Demo dashboard with fixture portfolio                                   |
| `/dashboard/[agentId]`      | Live dashboard for a registered agent (localStorage-pinned)             |
| `/tg`                       | Telegram Mini-App shell (uses `telegram-webapp.ts`)                     |

Approval modes (`ApprovalSettings`):

| Mode        | Behavior                                                                              |
|-------------|---------------------------------------------------------------------------------------|
| **Manual**  | Agent proposes → user taps Execute / Defer / Skip before anything runs                |
| **Delegated** | Agent acts autonomously when LLM + policy agree → receipt only; optional veto window |

---

## 2. Folder Layout

```
frontend/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                Landing
│   ├── globals.css
│   ├── icon.png                Favicon
│   ├── opengraph-image.tsx     OG dynamic image
│   ├── twitter-image.tsx       Twitter card image
│   ├── robots.ts / sitemap.ts  SEO
│   ├── onboarding/page.tsx     Wallet entry + preferences
│   ├── setup-wallet/page.tsx   Circle Web SDK PIN setup
│   ├── execute/page.tsx        Execution challenge confirm
│   ├── watch/page.tsx          Read-only mode
│   ├── dashboard/
│   │   ├── page.tsx            Demo dashboard
│   │   └── [agentId]/page.tsx  Live agent dashboard
│   └── tg/                     Telegram Mini-App entry
│
├── components/
│   ├── landing/                Hero, bento cards, marquee, theme toggle, GSAP morph bg
│   ├── onboarding/             OnboardingForm + ApprovalModePicker + topbar
│   ├── dashboard/              MetricsGrid, PositionsTable, RegimePanel, OpportunityCard, ApprovalModeToggle
│   ├── wallet/                 SimpleWalletConnect, CircleWalletSetup, AgentActivation, DepositFundsButton, providers (wagmi + RainbowKit + Web SDK)
│   ├── layout/                 Shared layout primitives
│   ├── seo/                    SEO helpers
│   └── ui/                     Button, Badge, logo
│
├── lib/
│   ├── wagmi.ts                wagmi + RainbowKit config; CONTRACTS map per chain
│   ├── primary-wallet.ts       Picks active wallet (Circle PW vs EOA)
│   ├── wallet-session.ts       Persists session in localStorage
│   ├── telegram-webapp.ts      Telegram Mini-App SDK shim
│   ├── api.ts                  Generic API client
│   ├── web-agent-api.ts        Agent-specific endpoints
│   ├── agent-store.ts          Zustand store for current agent
│   ├── calculations.ts         After-tax math used in dashboard
│   ├── animations.ts           GSAP timelines used on landing
│   ├── mock-data.ts            Demo fixture for `/dashboard`
│   ├── site.ts                 Site metadata + OG defaults
│   ├── types.ts                Mirrors backend Zod schemas
│   └── utils.ts                cn helper, classnames, formatters
│
├── public/                     Logos, favicons, OG assets
├── hooks/                      React hooks (wallet, agent, dashboard)
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## 3. Run Locally

```bash
cd frontend
cp .env.example .env.local
npm install         # or pnpm install
npm run dev         # http://localhost:3000  (Turbopack)
```

`npm run build` then `npm run start` for a production build.

---

## 4. Environment Variables

| Variable                                  | Required | Purpose |
|-------------------------------------------|---------:|---------|
| `NEXT_PUBLIC_SITE_URL`                    | optional | Defaults to `https://taxee.io` — used by SEO, OG, sitemap |
| `NEXT_PUBLIC_API_URL`                     | optional | Defaults to `https://taxee-production.up.railway.app` |
| `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID`   | ✅       | WalletConnect / RainbowKit project ID |
| `NEXT_PUBLIC_CIRCLE_APP_ID`               | ✅       | Circle App ID, mirrors `CIRCLE_APP_ID` on the backend |
| `NEXT_PUBLIC_DELEGATION_REGISTRY`         | optional | Override for Base mainnet rollout |
| `NEXT_PUBLIC_TAXEE_MANAGER`               | optional | Override for Base mainnet rollout |

Testnet contract addresses are hard-coded in [lib/wagmi.ts](lib/wagmi.ts):

```ts
ethSepolia : { delegationRegistry: 0x786D…A527, taxeeManager: 0x919B…4A37 }
baseSepolia: { delegationRegistry: 0x403F…2ebc, taxeeManager: 0xEE8D…0193 }
```

---

## 5. Wallet Stack

The frontend supports two wallet paths the backend can target:

**Circle Programmable Wallets (default, custodial-feel + self-custodial-control)**
- Bootstrapped on `/setup-wallet` using `@circle-fin/w3s-pw-web-sdk` and a one-shot session pulled from `GET /circle/setup/:userId`.
- After PIN setup the wallet ID is posted back to the API via `POST /circle/wallet-ready/:userId`.
- Execution is per-action: each opportunity creates a new challenge that the user confirms on `/execute`.

**EIP-7702 (self-custody MetaMask / Rainbow)**
- `wagmi` + `@rainbow-me/rainbowkit` connect EOAs across Ethereum Sepolia, Base Sepolia, Base mainnet.
- [`use-taxee-contracts.ts`](components/wallet/use-taxee-contracts.ts) signs EIP-712 delegations to `TaxeeManager` and reads `DelegationRegistry` state.
- Delegations are stored on-chain with per-tx + per-month limits and a 90-day default expiry; revocable any time.

Both paths converge on the same `TaxeeLotRegistry.commitDisposal` write for auditable disposals.

---

## 6. Tech Stack

| Layer            | Technology                                          |
|------------------|-----------------------------------------------------|
| Framework        | Next.js 15 (App Router, Turbopack dev server)       |
| UI / styling     | Tailwind CSS 3 + custom landing components          |
| Animation        | GSAP + `@gsap/react` morphing background            |
| State            | Zustand (`lib/agent-store.ts`) + React Query        |
| Wallets          | wagmi 2 + RainbowKit + Circle W3S Web SDK           |
| Onchain reads    | viem 2                                              |
| Telegram WebApp  | Custom shim in `lib/telegram-webapp.ts`             |

---

## 7. Integration Points with Backend

| Frontend                         | Backend endpoint                            |
|----------------------------------|---------------------------------------------|
| `/onboarding` submit             | `POST /agent` (creates agent + Circle user) |
| `/setup-wallet` mount            | `GET /circle/setup/:userId`                  |
| `/setup-wallet` PIN complete     | `POST /circle/wallet-ready/:userId`          |
| Dashboard refresh                | `GET /portfolio/:agentId`, `GET /lot/:agentId` |
| Opportunity Approve              | `POST /circle/challenge/:oppId`              |
| `/execute` confirm               | Circle Web SDK → MPC co-sign → broadcast     |
| Dashboard token refresh          | `GET /circle/token` (JWT)                    |

---

## 8. Notes for Contributors

- **Mock data still ships.** `/dashboard` (no agentId) renders the deterministic fixture from `lib/mock-data.ts`. Live data only appears under `/dashboard/[agentId]`.
- **Types mirror the backend.** When you change a Zod schema in `backend/packages/shared`, mirror the TS type in `frontend/lib/types.ts`.
- **OG images.** `opengraph-image.tsx` + `twitter-image.tsx` are dynamic — edit those, not the static PNGs.
- **Mini-app shell.** `/tg` is the Telegram WebApp entry; it shares all dashboard components but uses `telegram-webapp.ts` for navigation + auth.
