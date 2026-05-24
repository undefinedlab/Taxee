#!/usr/bin/env node
/** Tax-engine candidates only (no LLM) for a wallet. */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const require = createRequire(join(dirname(fileURLToPath(import.meta.url)), "..", "packages", "db", "package.json"));
const wallet = process.argv[2]?.toLowerCase();
const url = process.env.DATABASE_URL;
if (!url || !wallet) {
  console.error("DATABASE_URL=... node scripts/scan-candidates.mjs 0x...");
  process.exit(1);
}

const postgres = require("postgres");
const sql = postgres(url, { max: 1 });

const { fetchPrices } = await import("../packages/aggregator/dist/priceAggregator.js");
const { scanForHarvestOpportunities, trackMaturationOpportunities, computeRebalanceCandidates } =
  await import("../packages/tax-engine/dist/index.js");
const { buildAgentPolicy, normalizeJurisdiction } = await import("../packages/shared/dist/jurisdictions.js");

const [agent] = await sql`
  SELECT a.id, a.policy, u.jurisdiction FROM agents a
  JOIN users u ON u.id = a.user_id
  WHERE lower(a.wallet_address) = ${wallet} LIMIT 1
`;
if (!agent) {
  console.log("No agent");
  process.exit(0);
}

const policy = buildAgentPolicy(agent.jurisdiction, agent.policy);
const lotRows = await sql`SELECT * FROM lots WHERE agent_id = ${agent.id} AND status = 'open'`;
const assetIds = [...new Set(lotRows.map((l) => l.asset_id))];
const prices = await fetchPrices(assetIds, process.env.COINGECKO_API_KEY);
console.log("Policy:", policy);
console.log("Prices:", prices);

const now = Date.now();
const typedLots = lotRows.map((l) => ({
  id: l.id,
  agentId: l.agent_id,
  assetId: l.asset_id,
  chainId: l.chain_id,
  acquiredAt: l.acquired_at,
  costBasisUsd: l.cost_basis_usd,
  quantity: l.quantity,
  sourceTx: l.tx_hash ?? "",
  status: l.status,
  holdingPeriodDays: Math.floor((now - new Date(l.acquired_at).getTime()) / 86400000),
  provisional: false,
  createdAt: l.created_at,
}));

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

for (const p of positions) {
  const basis = p.lots.reduce((s, l) => s + parseFloat(l.costBasisUsd), 0);
  const pct = basis > 0 ? ((parseFloat(p.unrealizedGainLossUsd) / basis) * 100).toFixed(2) : "n/a";
  console.log(`Position ${p.assetId} chain=${p.chainId} basis=$${basis.toFixed(2)} value=$${p.currentValueUsd} uPnL=${p.unrealizedGainLossUsd} (${pct}%)`);
}

const snapshot = {
  agentId: agent.id,
  positions,
  prices,
  capturedAt: new Date(),
  realizedYtd: { shortTerm: 0, longTerm: 0, lossesHarvested: 0 },
  regimeSignals: {},
  userPolicy: policy,
};

const harvest = scanForHarvestOpportunities(snapshot, policy);
const park = trackMaturationOpportunities(snapshot, policy);
const rebalance = computeRebalanceCandidates(snapshot, { label: "neutral", confidence: 0.5, reasoning: "scan", targetAllocationDelta: {} }, policy);

console.log("\nCandidates:");
console.log("  HARVEST:", harvest.length, harvest.map((c) => `${c.lots[0]?.assetId} save~$${c.estimatedTaxImpact?.toFixed?.(0) ?? c.estimatedTaxImpact}`));
console.log("  PARK:", park.length);
console.log("  REBALANCE:", rebalance.length);

await sql.end();
