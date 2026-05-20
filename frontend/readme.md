# taxee frontend

Next.js 15 app for the taxee DeFi tax-optimization agent — onboarding, after-tax dashboard, and the action loop (manual or delegated).

## Routes

| Path | Description |
|------|-------------|
| `/` | Landing — product pitch and three-phase lifecycle |
| `/onboarding` | Phase 1 — wallet, import, preferences, **approval mode**, activate agent |
| `/dashboard/demo` | Demo dashboard with fixture portfolio |
| `/dashboard/[agentId]` | Dashboard for a registered agent (localStorage) |

## Approval modes

| Mode | Behavior |
|------|----------|
| **Manual** | Agent proposes → you Execute / Defer / Skip before anything runs |
| **Delegated** | Agent acts autonomously when LLM + policy agree → you get a receipt; optional veto (Skip) |

Switch modes anytime on the dashboard. Matches `ApprovalSettings` in `architecture.md`.

## Run locally

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Architecture alignment

- **Phase 1 (Once):** `OnboardingForm` + `ApprovalModePicker`
- **Phase 2 (Always on):** Heartbeat status badge; mock regime + opportunities
- **Phase 3 (Action loop):** `OpportunityCard` — manual buttons or delegated simulate/veto

Data is mock/fixture until the backend API exists. Types in `lib/types.ts` mirror architecture entities.

## Next integration points

- `POST /api/agents` — include `approval` in payload
- Heartbeat worker branches on `agent.approval.mode`
- Delegated path: auto-execute + `notifyOnExecute` webhook/TG receipt
- `PATCH /api/agents/:id/approval` — dashboard mode toggle
