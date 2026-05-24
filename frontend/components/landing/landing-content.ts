/** Landing copy — sourced from doc.md product spec */

export const hero = {
  eyebrow: "DeFi Portfolio Agent",
  title: "Maximise your after tax alpha.",
  subtitle:
    "AI portfolio agent that optimizes after-tax return — not just the gross performance. Tax-loss harvesting, lot optimization, and long-term holding embedded into every rebalance.",
  ctaPrimary: "Register your agent",
  ctaSecondary: "See demo dashboard",
} as const;

export const heroStats = [
  { value: "+3%", label: "After-tax alpha vs gross-only" },
  { value: "+8%", label: "Saved in tax drag" },
  { value: "F8949", label: "Auto-generated, audit-ready" },
] as const;

export const problem = {
  label: "Problem",
  title: "Today's agents are blind to taxes",
  lead: "DeFi portfolio agents rebalance when drift exceeds a threshold, rotate into yield when regimes shift, and harvest gains across chains — all while silently destroying after-tax returns in the process.",
  bullets: [
    {
      icon: "chart-down" as const,
      title: "Every disposal is a taxable event",
      body: "Rotations and exits trigger gains without lot-level awareness. Each sale compounds at your highest marginal rate.",
    },
    {
      icon: "layers" as const,
      title: "Every rebalance has a tax cost",
      body: "Fixing portfolio drift can cost more in taxes than the drift itself. Gross-only agents never run that math.",
    },
    {
      icon: "clock" as const,
      title: "Money left on the table",
      body: "Every win held one day short of long-term treatment forfeits the lower rate. Precision lot tracking is required.",
    },
  ],
} as const;

export const solution = {
  label: "Solution",
  title: "What taxee does for your portfolio",
  lead: "taxee is a cross-chain portfolio agent that treats after-tax return as the primary optimization target — not gross performance, what you actually keep. It runs continuously across your portfolio, layering tax awareness into every rebalance, harvest, and hold.",
  items: [
    {
      icon: "trend-up" as const,
      title: "Regime-aware, tax-adjusted rebalancing",
      description:
        "Detects risk-on/risk-off shifts via onchain signals. Before executing any rebalance, weighs the tax cost of disposal against the drift cost of inaction. Delays or splits rebalances when the math doesn't justify the tax hit.",
    },
    {
      icon: "harvest" as const,
      title: "Continuous cross-chain loss harvesting",
      description:
        "Scans all positions across chains in real time. When an asset crosses a configurable loss threshold, the agent harvests it, replaces it with a correlated asset to maintain exposure, and books the loss against realized gains — automatically.",
    },
    {
      icon: "calendar" as const,
      title: "Holding-period maturation engine",
      description:
        "Tracks the age of every lot. Capital approaching long-term threshold (365 days) is parked in USYC — earning yield while it ages — rather than disposed of prematurely at short-term rates.",
    },
  ],
  control: "",
  configurator: {
    title: "Policy Configurator",
    subtitle: "Adjust settings to see projected impact",
    defaults: {
      harvestThreshold: 500,
      aggressiveness: "conservative",
      priority: "standard",
    },
    projections: {
      annualSavings: 2840,
      harvestsPerYear: 12,
      avgHoldTime: 180,
      longTermCapture: 94,
    },
  },
} as const;

export const howItWorks = {
  label: "How it works",
  title: "Set up once. Run continuously.",
  phases: [
    {
      phase: 1,
      icon: "wallet" as const,
      title: "Onboarding",
      description:
        "Connect wallet, import history, set jurisdiction. Your lot ledger — every cost basis and holding period — is built once.",
    },
    {
      phase: 2,
      icon: "pulse" as const,
      title: "Heartbeat",
      description:
        "Hourly scans of prices, lots, and regimes. The agent surfaces harvest, rebalance, and park opportunities — you hear about it only when it matters.",
    },
    {
      phase: 3,
      icon: "loop" as const,
      title: "Action loop",
      description:
        "Approve each move, or delegate inside policy. Every disposal is logged on Arc with lot ID, basis, and rationale.",
    },
  ],
} as const;

export const execution = {
  label: "Execution",
  title: "Tax-cost-aware execution via Circle stack",
  items: [
    {
      icon: "fingerprint" as const,
      title: "Specific-ID lot selection",
      description:
        "IRS-compliant disposal targeting on every trade. Sell highest-cost-basis lots first to minimize realized gains.",
      accent: "green" as const,
    },
    {
      icon: "bridge" as const,
      title: "CCTP & Gateway",
      description:
        "Cross-chain moves with consistent settlement across Ethereum, Base, and Arbitrum. No fragmented liquidity.",
      accent: "blue" as const,
    },
    {
      icon: "zap" as const,
      title: "Paymaster",
      description: "Gas fees paid in USDC. No ETH required in wallet for agent execution.",
      accent: "both" as const,
    },
    {
      icon: "layers" as const,
      title: "Arc ledger",
      description:
        "Immutable transaction record for every disposal — your Form 8949, pre-filled and audit-ready.",
      accent: "green" as const,
    },
  ],
  modes: {
    label: "Control",
    title: "Manual approval or delegated execution",
    manual: {
      tag: "Manual",
      title: "You approve every move",
      description: "Execute, Defer, or Skip from Telegram or dashboard. Nothing runs until you confirm. Full reasoning chain visible.",
      flow: ["Detect", "Notify", "Decide"],
      timeline: [
        { time: "Hour 0", action: "Detect", icon: "pulse" },
        { time: "Hour 0", action: "You decide", icon: "user" },
        { time: "Hour 0", action: "Confirm", icon: "check" },
      ],
      bestFor: ["Learning", "Large trades", "New users"],
    },
    delegated: {
      tag: "Delegated",
      title: "Agent runs within policy",
      description: "Delegate approval inside guardrails. Harvest, park, and rebalance fire automatically when decision engine and LLM agree. You always get a receipt and Arc audit entry.",
      flow: ["Detect", "Validate", "Execute"],
      timeline: [
        { time: "Hour 0", action: "Detect", icon: "pulse" },
        { time: "Hour 0", action: "Executed", icon: "zap" },
        { time: "Hour 0", action: "Receipt", icon: "receipt" },
      ],
      bestFor: ["Set-and-forget", "Active portfolios", "Tax-aware users"],
      recommended: true,
    },
  },
} as const;

export const approvalModes = [
  {
    icon: "hand" as const,
    tag: "Manual approval",
    title: "Approve each move",
    description:
      "The agent proposes — you Execute, Defer, or Skip before any transaction. Best for first-time users, large tax impact, or learning how the agent reasons.",
    variant: "neutral" as const,
  },
  {
    icon: "bolt" as const,
    tag: "Delegated",
    title: "Agent runs within policy",
    description:
      "Delegate approval inside guardrails. Harvest, park, and rebalance fire automatically when the decision engine and LLM agree — always with notifications and a full audit trail on Arc.",
    variant: "highlight" as const,
  },
] as const;

export const channels = [
  {
    icon: "monitor" as const,
    title: "Web dashboard",
    desc: "Register, monitor positions, approve or review actions, toggle manual or delegated mode.",
  },
  {
    icon: "message" as const,
    title: "Telegram bot",
    desc: "Onboard via /start, get notified, inline Execute / Defer / Skip, post-action receipts.",
  },
  {
    icon: "plug" as const,
    title: "MCP / OpenClaw",
    desc: "Bring your own agent — taxee_scan runs the pipeline, taxee_approve_action for manual flows.",
  },
] as const;

export const cta = {
  eyebrow: "Ready when you are",
  title: "Start maximising your after-tax alpha now.",
  subtitle:
    "",
  primary: "Register your agent",
  primaryHint: "~2 min setup",
  secondary: "View demo dashboard",
  ticker: [
    { value: "2,847", label: "agents registered" },
    { value: "$4.2M", label: "tax saved" },
    { value: "12,493", label: "harvests executed" },
    { value: "94%", label: "long-term rate capture" },
  ],
} as const;
