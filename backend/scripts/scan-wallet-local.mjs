#!/usr/bin/env node
/**
 * On-chain tax-engine scan (no DB). Uses Alchemy + CoinGecko from .env.local.
 *
 * Usage: node --env-file=.env.local scripts/scan-wallet-local.mjs 0x... [jurisdiction]
 */
const wallet = process.argv[2]?.toLowerCase();
const jurisdiction = (process.argv[3] ?? "UK").toUpperCase();

if (!/^0x[a-f0-9]{40}$/.test(wallet ?? "")) {
  console.error("Usage: node --env-file=.env.local scripts/scan-wallet-local.mjs 0x... [US|UK|...]");
  process.exit(1);
}

const alchemyKey = process.env.ALCHEMY_API_KEY;
if (!alchemyKey) {
  console.error("ALCHEMY_API_KEY required in .env.local");
  process.exit(1);
}

const { importLotsForWallet } = await import("../packages/aggregator/dist/lotImporter.js");
const { fetchPrices } = await import("../packages/aggregator/dist/priceAggregator.js");
const { scanForHarvestOpportunities, trackMaturationOpportunities, computeRebalanceCandidates } =
  await import("../packages/tax-engine/dist/index.js");
const { buildAgentPolicy } = await import("../packages/shared/dist/jurisdictions.js");

console.log("Wallet:", wallet);
console.log("Jurisdiction:", jurisdiction);

const imported = await importLotsForWallet(
  wallet,
  alchemyKey,
  process.env.COINGECKO_API_KEY,
  new Set(),
);
console.log("\nImported lots from chain:", imported.length);

const policy = buildAgentPolicy(jurisdiction, {
  harvestThresholdPct: -5,
  minHarvestLossUsd: 0,
  maturationBufferDays: 30,
});
console.log("Policy:", JSON.stringify(policy, null, 2));

const now = Date.now();
const typedLots = imported.map((l, i) => ({
  id: `local-${i}`,
  agentId: "local-scan",
  assetId: l.assetId,
  chainId: l.chainId,
  acquiredAt: l.acquiredAt,
  costBasisUsd: l.costBasisUsd,
  quantity: l.quantity,
  sourceTx: l.txHash ?? "",
  status: "open",
  holdingPeriodDays: Math.floor((now - new Date(l.acquiredAt).getTime()) / 86400000),
  provisional: false,
  createdAt: new Date(l.acquiredAt),
}));

const assetIds = [...new Set(typedLots.map((l) => l.assetId))];
const prices = await fetchPrices(assetIds, process.env.COINGECKO_API_KEY);
console.log("\nSpot prices:", prices);

const positionMap = new Map();
for (const lot of typedLots) {
  const key = `${lot.assetId}:${lot.chainId}`;
  if (!positionMap.has(key)) positionMap.set(key, []);
  positionMap.get(key).push(lot);
}

const positions = [...positionMap.entries()].map(([, lotGroup]) => {
  const first = lotGroup[0];
  const totalQty = lotGroup.reduce((s, l) => s + parseFloat(l.quantity), 0);
  const totalBasis = lotGroup.reduce((s, l) => s + parseFloat(l.costBasisUsd), 0);
  const price = prices[first.assetId] ?? 0;
  const currentVal = totalQty * price;
  return {
    assetId: first.assetId,
    chainId: first.chainId,
    quantity: String(totalQty),
    currentValueUsd: String(currentVal),
    unrealizedGainLossUsd: String(currentVal - totalBasis),
    lots: lotGroup,
  };
});

console.log("\nPositions:");
for (const p of positions) {
  const basis = p.lots.reduce((s, l) => s + parseFloat(l.costBasisUsd), 0);
  const pct = basis > 0 ? ((parseFloat(p.unrealizedGainLossUsd) / basis) * 100).toFixed(2) : "n/a";
  const days = p.lots.map((l) => l.holdingPeriodDays).join(",");
  console.log(
    `  ${p.assetId} chain=${p.chainId} lots=${p.lots.length} basis=$${basis.toFixed(2)} value=$${parseFloat(p.currentValueUsd).toFixed(2)} uPnL=$${parseFloat(p.unrealizedGainLossUsd).toFixed(2)} (${pct}%) held=${days}d`,
  );
}

const snapshot = {
  agentId: "local-scan",
  positions,
  prices,
  capturedAt: new Date(),
  realizedYtd: { shortTerm: 0, longTerm: 0, lossesHarvested: 0 },
  regimeSignals: {},
  userPolicy: policy,
};

const harvest = scanForHarvestOpportunities(snapshot, policy);
const park = trackMaturationOpportunities(snapshot, policy);
const rebalance = computeRebalanceCandidates(
  snapshot,
  { label: "neutral", confidence: 0.5, reasoning: "local scan", targetAllocationDelta: {} },
  policy,
);

console.log("\n=== Tax-engine candidates (no LLM) ===");
console.log("HARVEST:", harvest.length);
for (const c of harvest) {
  const asset = c.lots[0]?.assetId;
  const rec = c.deterministicRecommendation;
  const save = Math.abs(c.estimatedTaxImpact ?? 0);
  console.log(`  • ${asset} — est. tax save ~$${save.toFixed(2)} — ${rec}`);
}

console.log("PARK:", park.length);
for (const c of park) {
  const lot = c.lots[0];
  const days = lot?.holdingPeriodDays ?? "?";
  console.log(`  • ${lot?.assetId} — ${days}d held — est. save ~$${Math.abs(c.estimatedTaxImpact ?? 0).toFixed(2)}`);
}

console.log("REBALANCE:", rebalance.length);
for (const c of rebalance) {
  console.log(`  • ${c.lots[0]?.assetId} — priority ${c.priority?.toFixed(2)}`);
}

if (harvest.length + park.length + rebalance.length === 0) {
  console.log("\nNo candidates: positions are likely flat vs cost basis, in gain (no harvest), or not near LT threshold (PARK).");
}
