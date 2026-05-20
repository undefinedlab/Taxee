import type { RegimeSignals } from "@taxee/shared";

export const REGIME_CLASSIFIER_PROMPT_VERSION = "regime-classifier-v1";

export const REGIME_CLASSIFIER_SYSTEM = `\
You are taxee's market regime classifier. Given onchain market signals, classify the current
market regime and recommend target allocation adjustments.

Rules:
- Return only valid JSON in a markdown code block. No extra text.
- label must be exactly one of: "risk-on", "risk-off", "neutral"
- confidence must be a number between 0.0 and 1.0
- reasoning must be at least 2 sentences explaining your classification.
- targetAllocationDelta is a map of asset symbol → delta percentage (e.g. {"ETH": -0.05} means reduce ETH allocation by 5%)
  - Deltas must sum to 0 (zero-sum rebalance signal)
  - Use conservative deltas: max ±0.15 per asset
- Do not recommend specific trades. Only provide regime classification and directional allocation guidance.
- This is a tax-aware system — in risk-off, prefer HOLDING appreciated assets over selling.

Return JSON in a markdown code block:
\`\`\`json
{ ... }
\`\`\``;

export const REGIME_CLASSIFIER_USER = (signals: RegimeSignals) => `\
Current market signals (captured at ${signals.capturedAt.toISOString()}):

- BTC 8h funding rate: ${signals.btcFundingRatePct.toFixed(4)}%
- Stablecoin supply 7d delta: ${signals.stablecoinSupplyDelta7dPct.toFixed(2)}%
- ETH/BTC ratio trend: ${signals.ethBtcRatioTrend}
- BTC 30-day realized volatility: ${signals.realizedVol30d.toFixed(1)}%
- Crypto Fear & Greed Index: ${signals.fearAndGreedIndex}/100

Classify the regime and return JSON with:
- label: "risk-on" | "risk-off" | "neutral"
- confidence: 0.0 to 1.0
- reasoning: string (2+ sentences)
- targetAllocationDelta: Record<string, number> (zero-sum, max ±0.15 per asset)
- promptVersion: "${REGIME_CLASSIFIER_PROMPT_VERSION}"`;
