/** Landing copy aligned with doc.md product vision */

export const hero = {
  eyebrow: "DeFi portfolio agent",
  title: "Optimize after-tax return — not gross performance",
  subtitle:
    "taxee is a cross-chain agent that embeds tax awareness into every rebalance, rotation, hold, and harvest — so compounding works in your favor, not against it.",
  ctaPrimary: "Register your agent",
  ctaSecondary: "Open demo dashboard",
} as const;

export const heroStats = [
  { value: "+2.8%", label: "After-tax alpha vs gross-only" },
  { value: "3", label: "Chains — Ethereum, Base, Arbitrum" },
  { value: "$12.4k", label: "Tax cost avoided (demo YTD)" },
] as const;

export const problem = {
  label: "The problem",
  title: "DeFi agents are blind to taxes",
  lead: "They rebalance on drift, rotate on regime, and harvest gains across chains — while silently destroying after-tax returns.",
  bullets: [
    {
      title: "Every disposal",
      body: "is a taxable event. Gross-optimized sells don't account for what you owe.",
    },
    {
      title: "Every rebalance",
      body: "has a tax cost. Drift correction can cost more than the drift itself.",
    },
    {
      title: "Every mistimed hold",
      body: "leaves long-term treatment on the table — one day short of 365 costs real money.",
    },
  ],
  closing:
    "Institutional desks solved this decades ago with tax-managed funds. DeFi users have had nothing — until now.",
} as const;

export const solution = {
  label: "The solution",
  title: "Tax engine inside every portfolio decision",
  lead: "After-tax return is the primary optimization target. The tax layer doesn't sit on top of management — it's embedded inside it.",
  decisions: [
    {
      decision: "Rebalance",
      behavior: "Weigh disposal cost vs drift cost before acting",
    },
    {
      decision: "Rotate",
      behavior: "Factor regime benefit against realized gains",
    },
    {
      decision: "Hold",
      behavior: "Protect lots approaching long-term treatment",
    },
    {
      decision: "Harvest",
      behavior: "Book losses automatically when thresholds are hit",
    },
  ],
  control:
    "Approve each move manually, or delegate within policy — always with notifications and a full audit trail on Arc.",
} as const;

export const howItWorks = {
  label: "How it works",
  title: "Set up once. Run continuously.",
  phases: [
    {
      tag: "Phase 1 — Once",
      title: "Onboarding",
      description:
        "Connect wallet, import onchain history, set jurisdiction and harvest threshold. Two minutes — never again.",
      href: "/onboarding" as const,
    },
    {
      tag: "Phase 2 — Always on",
      title: "Heartbeat",
      description:
        "Hourly scan of prices, lots, and regime. The agent reasons; you only hear when there's an opportunity.",
      metric: "60m",
      metricLabel: "scan interval",
    },
    {
      tag: "Phase 3 — Your call",
      title: "Action loop",
      description:
        "Execute, Defer, or Skip — or delegate so harvest, park, and rebalance run within guardrails. Receipt every time.",
      href: "/dashboard/demo" as const,
    },
  ],
} as const;

export const features = {
  label: "Features",
  title: "What taxee does for your portfolio",
  items: [
    {
      tag: "Rebalance",
      title: "Regime-aware, tax-adjusted",
      description:
        "Detects risk-on/risk-off via onchain signals. Weighs tax cost of disposal against drift of inaction — delays or splits when the math doesn't justify the hit.",
      metric: "−8%",
      metricLabel: "typical tax drag avoided",
      accent: "green" as const,
    },
    {
      tag: "Harvest",
      title: "Cross-chain loss harvesting",
      description:
        "Scans all positions in real time. When loss crosses your threshold, harvests, replaces with a correlated asset for exposure, and books the loss — automatically.",
      accent: "blue" as const,
    },
    {
      tag: "Maturation",
      title: "Holding-period engine",
      description:
        "Tracks every lot. Capital near 365 days parks in USYC for yield while aging — not sold early at short-term rates. Actions scheduled for threshold day.",
      metric: "365d",
      metricLabel: "long-term threshold",
      accent: "both" as const,
    },
    {
      tag: "Dashboard",
      title: "After-tax alpha",
      description:
        "After-tax return vs benchmark front and center — not gross. Plus harvested losses YTD, tax cost avoided, and estimated year-end liability.",
      metric: "+2.8%",
      metricLabel: "vs gross-only",
      accent: "green" as const,
      href: "/dashboard/demo" as const,
    },
  ],
} as const;

export const execution = {
  label: "Execution",
  title: "Tax-cost-aware execution via Circle",
  items: [
    {
      title: "Specific-ID lots",
      description:
        "IRS-compliant disposal targeting on every trade. Arc logs each event — Form 8949, pre-filled.",
      accent: "green" as const,
    },
    {
      title: "CCTP & Gateway",
      description:
        "Cross-chain moves with consistent settlement across Ethereum, Base, and Arbitrum.",
      accent: "blue" as const,
    },
    {
      title: "Paymaster gas",
      description: "Gas paid in USDC. No ETH required in wallet for agent execution.",
      accent: "both" as const,
    },
  ],
} as const;

export const approvalModes = [
  {
    tag: "Manual approval",
    title: "You approve every move",
    description:
      "Execute, Defer, or Skip from Telegram or the dashboard. Nothing runs until you confirm — full control, full reasoning chain visible.",
    variant: "neutral" as const,
  },
  {
    tag: "Delegated",
    title: "Agent runs within policy",
    description:
      "Delegate approval inside guardrails. Harvest, park, and rebalance fire automatically — you always get a receipt and Arc audit entry.",
    variant: "highlight" as const,
  },
] as const;

export const channels = [
  {
    title: "Web dashboard",
    desc: "Register, monitor positions, approve or review actions.",
  },
  {
    title: "Telegram bot",
    desc: "Onboard, get notified, inline Execute / Defer / Skip.",
  },
  {
    title: "MCP / OpenClaw",
    desc: "Bring your own agent — taxee_scan & approve tools.",
  },
] as const;

export const cta = {
  title: "Start optimizing what you keep",
  subtitle:
    "Register in two minutes. Open alpha — watch tier uses address only, no seed phrase.",
  primary: "Register your agent",
  secondary: "View demo dashboard",
} as const;
