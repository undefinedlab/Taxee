# taxee

**The first DeFi portfolio agent that optimizes after-tax return — not gross performance.**

---

## Problem

DeFi portfolio agents are blind to taxes. They rebalance when drift exceeds a threshold, rotate into yield when regimes shift, and harvest gains across chains — all while silently destroying after-tax returns in the process.

- Every disposal is a **taxable event**
- Every rebalance has a **tax cost**
- Every win held one day short of long-term treatment is **money left on the table**

The difference between gross-optimized and after-tax-optimized management is compounding, permanently, in the wrong direction.

Institutional desks have solved this for decades with direct indexing and tax-managed funds. **DeFi users have nothing.**

---

## Solution

**taxee** is a cross-chain portfolio agent that treats after-tax return as the primary optimization target.

It runs continuously across your portfolio, layering tax awareness into every decision the agent already makes:

| Decision | Tax-aware behavior |
|----------|-------------------|
| Rebalance | Weigh disposal cost vs drift cost before acting |
| Rotate | Factor in regime shift benefit against realized gains |
| Hold | Protect lots approaching long-term treatment |
| Harvest | Book losses automatically when thresholds are hit |

The tax engine doesn't sit on top of portfolio management. **It's embedded inside it.**

You choose how hands-on to be: **approve each move** (manual), or **delegate approval** so the agent runs autonomously within your policy — always with notifications and a full audit trail on Arc.

---

## Features

### Regime-aware, tax-adjusted rebalancing

Detects risk-on/risk-off shifts via onchain signals. Before executing any rebalance, weighs the tax cost of disposal against the drift cost of inaction. Delays or splits rebalances when the math doesn't justify the tax hit.

### Continuous cross-chain loss harvesting

Scans all positions across chains in real time. When an asset crosses a configurable loss threshold, the agent harvests it, replaces it with a correlated asset to maintain exposure, and books the loss against realized gains — automatically, without user input.

### Holding-period maturation engine

Tracks the age of every lot. Capital approaching long-term threshold (365 days) is parked in **USYC** — earning yield while it ages — rather than disposed of prematurely at short-term rates. The agent knows the exact day each lot crosses the threshold and schedules actions accordingly.

### Tax-cost-aware execution via Circle stack

| Component | Role |
|-----------|------|
| **Specific-ID lot selection** | IRS-compliant disposal targeting to minimize realized gains |
| **CCTP / Gateway** | Cross-chain moves with consistent settlement |
| **Paymaster** | Gas fees paid in USDC |
| **Arc ledger** | Immutable transaction record — your Form 8949, pre-filled |

### After-tax alpha dashboard

Single metric front and center: **after-tax return vs benchmark** (BTC, S&P 500). Not gross performance — what you actually keep.

Also surfaces:

- Harvested losses YTD
- Tax cost avoided
- Estimated year-end liability
