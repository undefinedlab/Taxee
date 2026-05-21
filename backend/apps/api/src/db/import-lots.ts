/**
 * Real on-chain lot importer.
 *
 * Scans the wallet linked to each active agent across Ethereum mainnet,
 * Base mainnet, and Base Sepolia using Alchemy, then writes new lots to DB.
 *
 * Run:  pnpm --filter @taxee/api db:import-lots
 * Or with a specific address:
 *       WALLET=0x... pnpm --filter @taxee/api db:import-lots
 */
import { db, agents, users, lots } from "@taxee/db";
import { eq, inArray } from "drizzle-orm";
import { importLotsForWallet } from "@taxee/aggregator";

const ALCHEMY_KEY   = process.env["ALCHEMY_API_KEY"] ?? "";
const COINGECKO_KEY = process.env["COINGECKO_API_KEY"];
const TARGET_WALLET = process.env["WALLET"];

async function main() {
  if (!ALCHEMY_KEY) {
    console.error("ALCHEMY_API_KEY is required. Add it to backend/.env");
    process.exit(1);
  }

  const activeAgents = await db
    .select({ id: agents.id, userId: agents.userId })
    .from(agents)
    .where(eq(agents.status, "active"));

  if (activeAgents.length === 0) {
    console.log("No active agents found.");
    process.exit(0);
  }

  for (const agent of activeAgents) {
    const [user] = await db.select().from(users).where(eq(users.id, agent.userId));
    if (!user) continue;

    const walletAddress = TARGET_WALLET ?? user.address;
    console.log(`\n── Agent ${agent.id} · wallet ${walletAddress} ────────────────`);

    const existingLots = await db
      .select({ txHash: lots.txHash })
      .from(lots)
      .where(eq(lots.agentId, agent.id));

    const existingHashes = new Set(
      existingLots.map((l) => l.txHash).filter(Boolean) as string[]
    );

    console.log(`  Existing lots in DB: ${existingHashes.size}`);

    const imported = await importLotsForWallet(
      walletAddress,
      ALCHEMY_KEY,
      COINGECKO_KEY,
      existingHashes,
    );

    if (imported.length === 0) {
      console.log("  No new lots found.");
      continue;
    }

    const rows = imported.map((lot) => ({
      agentId:      agent.id,
      assetId:      lot.assetId,
      chainId:      lot.chainId,
      quantity:     lot.quantity,
      costBasisUsd: lot.costBasisUsd,
      acquiredAt:   lot.acquiredAt,
      status:       "open" as const,
      txHash:       lot.txHash,
    }));

    await db.insert(lots).values(rows);
    console.log(`  ✅ Inserted ${rows.length} new lots.`);

    const summary: Record<string, number> = {};
    for (const r of rows) {
      summary[r.assetId] = (summary[r.assetId] ?? 0) + 1;
    }
    for (const [asset, count] of Object.entries(summary)) {
      console.log(`     ${asset}: ${count} lot(s)`);
    }
  }

  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
