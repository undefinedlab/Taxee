# taxee frontend

Next.js 15 app for the taxee DeFi tax-optimization agent — onboarding, after-tax dashboard, and the Execute / Defer / Skip action loop.

## Routes

| Path | Description |
|------|-------------|
| `/` | Landing — product pitch and three-phase lifecycle |
| `/onboarding` | Phase 1 — wallet (watch tier), import stub, preferences, activate agent |
| `/dashboard/demo` | Demo dashboard with fixture portfolio |
| `/dashboard/[agentId]` | Dashboard for a registered agent (localStorage) |

## Run locally

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Architecture alignment

- **Phase 1 (Once):** `OnboardingForm` — address-only registration, onchain import stub, policy prefs, spawns agent in `localStorage`
- **Phase 2 (Always on):** Dashboard shows heartbeat status; mock regime + pending opportunities
- **Phase 3 (Action loop):** `OpportunityCard` — Execute / Defer / Skip with LLM reasoning display

Data is mock/fixture (`lib/mock-data.ts`) until the backend API exists. Types in `lib/types.ts` mirror `architecture.md` entities (`Agent`, `Opportunity`, `UserPolicy`, etc.).

## Next integration points

- `POST /api/agents` — replace `registerAgent` in `lib/agent-store.ts`
- `GET /api/agents/:id/opportunities` — poll pending actions
- `POST /api/actions/:id/execute|defer|skip` — wire opportunity buttons
- SIWE / WalletConnect for wallet connect (beyond paste-address watch tier)
