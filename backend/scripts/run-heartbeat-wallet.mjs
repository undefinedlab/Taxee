#!/usr/bin/env node
/**
 * Run heartbeat for wallet(s) and print candidate/opportunity counts.
 * Loads backend/.env.local for keys.
 *
 * Usage: node --env-file=.env.local scripts/run-heartbeat-wallet.mjs 0x...
 */
import { config } from "node:process";

const wallet = (process.argv[2] ?? "").toLowerCase();
if (!/^0x[a-f0-9]{40}$/.test(wallet)) {
  console.error("Usage: node --env-file=.env.local scripts/run-heartbeat-wallet.mjs 0x...");
  process.exit(1);
}

const { db, agents } = await import("@taxee/db");
const { eq } = await import("drizzle-orm");
const { runHeartbeat } = await import("@taxee/agent/heartbeat");

const rows = await db
  .select({ id: agents.id, policy: agents.policy, status: agents.status })
  .from(agents)
  .where(eq(agents.walletAddress, wallet));

if (rows.length === 0) {
  console.log("No agent in DB for", wallet);
  process.exit(0);
}

for (const row of rows) {
  console.log("\nRunning heartbeat for agent", row.id, "status=", row.status);
  console.log("policy:", JSON.stringify(row.policy, null, 2));
  try {
    const result = await runHeartbeat(row.id);
    console.log("Result:", result);
  } catch (err) {
    console.error("Heartbeat failed:", err);
  }
}

process.exit(0);
