#!/usr/bin/env node
/**
 * Diagnose opportunities for a wallet on production DB.
 * Usage: DATABASE_URL=... node scripts/diagnose-agent.mjs 0x...
 */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const require = createRequire(join(dirname(fileURLToPath(import.meta.url)), "..", "packages", "db", "package.json"));
const wallet = (process.argv[2] ?? "").toLowerCase();

if (!/^0x[a-f0-9]{40}$/.test(wallet)) {
  console.error("Usage: DATABASE_URL=... node scripts/diagnose-agent.mjs 0x...");
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Set DATABASE_URL");
  process.exit(1);
}

const postgres = require("postgres");
const sql = postgres(url, { max: 1 });

const agents = await sql`
  SELECT a.id, a.name, a.status, a.policy, a.wallet_address, u.jurisdiction, u.telegram_id
  FROM agents a
  JOIN users u ON u.id = a.user_id
  WHERE lower(a.wallet_address) = ${wallet}
`;

if (agents.length === 0) {
  console.log("No agent for wallet", wallet);
  await sql.end();
  process.exit(0);
}

for (const agent of agents) {
  console.log("\n=== Agent", agent.id, "===");
  console.log("name:", agent.name, "status:", agent.status);
  console.log("user jurisdiction:", agent.jurisdiction);
  console.log("policy:", JSON.stringify(agent.policy, null, 2));

  const lots = await sql`
    SELECT asset_id, chain_id, quantity, cost_basis_usd, acquired_at, status
    FROM lots WHERE agent_id = ${agent.id} AND status = 'open'
  `;
  console.log("\nOpen lots:", lots.length);
  for (const l of lots) {
    console.log(
      `  ${l.asset_id} chain=${l.chain_id} qty=${l.quantity} basis=$${l.cost_basis_usd} acquired=${l.acquired_at?.toISOString?.()?.slice(0, 10)}`,
    );
  }

  const opps = await sql`
    SELECT id, type, headline, llm_decision, approved_at, executed_at, deferred_until, created_at
    FROM opportunities WHERE agent_id = ${agent.id}
    ORDER BY created_at DESC LIMIT 10
  `;
  console.log("\nOpportunities (latest 10):", opps.length);
  for (const o of opps) {
    const pending = !o.approved_at && !o.executed_at && !o.deferred_until;
    console.log(
      `  [${pending ? "PENDING" : "done"}] ${o.type} ${o.llm_decision} — ${o.headline?.slice(0, 60)}`,
    );
  }
}

await sql.end();
