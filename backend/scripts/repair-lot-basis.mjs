#!/usr/bin/env node
/** Fix $0 cost_basis lots using current CoinGecko prices. */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const require = createRequire(join(dirname(fileURLToPath(import.meta.url)), "..", "packages", "db", "package.json"));
const wallet = process.argv[2]?.toLowerCase();

const url = process.env.DATABASE_URL;
const geckoKey = process.env.COINGECKO_API_KEY;
if (!url) {
  console.error("Set DATABASE_URL and COINGECKO_API_KEY");
  process.exit(1);
}

const { fetchPrices } = await import("@taxee/aggregator");
const postgres = require("postgres");
const sql = postgres(url, { max: 1 });

const agentFilter = wallet
  ? sql`AND lower(a.wallet_address) = ${wallet}`
  : sql``;

const zeroLots = await sql`
  SELECT l.id, l.asset_id, l.quantity, l.cost_basis_usd, a.wallet_address
  FROM lots l
  JOIN agents a ON a.id = l.agent_id
  WHERE l.status = 'open' AND (l.cost_basis_usd::float <= 0)
  ${agentFilter}
`;

if (zeroLots.length === 0) {
  console.log("No zero-basis lots to repair.");
  await sql.end();
  process.exit(0);
}

const assets = [...new Set(zeroLots.map((l) => l.asset_id))];
const prices = await fetchPrices(assets, geckoKey);
console.log("Prices:", prices);

for (const lot of zeroLots) {
  const px = prices[lot.asset_id] ?? 0;
  if (px <= 0) {
    console.log("Skip", lot.id, lot.asset_id, "— no price");
    continue;
  }
  const basis = (parseFloat(lot.quantity) * px).toFixed(4);
  await sql`UPDATE lots SET cost_basis_usd = ${basis} WHERE id = ${lot.id}`;
  console.log(`Repaired ${lot.asset_id} ${lot.wallet_address?.slice(0, 10)}… → $${basis}`);
}

await sql.end();
