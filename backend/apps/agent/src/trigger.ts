/**
 * One-shot heartbeat trigger — runs the full pipeline immediately for all active agents.
 * Use this for testing / demo without waiting for the 15-min cron.
 *
 * Run:  pnpm --filter @taxee/agent dev:trigger
 */
import { eq } from "drizzle-orm";
import { db, agents } from "@taxee/db";
import { runHeartbeat } from "./heartbeat.js";

async function main() {
  const activeAgents = await db
    .select({ id: agents.id })
    .from(agents)
    .where(eq(agents.status, "active"));

  if (activeAgents.length === 0) {
    console.log("No active agents found. Register via Telegram first.");
    process.exit(0);
  }

  console.log(`Triggering heartbeat for ${activeAgents.length} agent(s)...`);

  for (const { id } of activeAgents) {
    console.log(`\n── Agent ${id} ─────────────────────────`);
    try {
      const result = await runHeartbeat(id);
      console.log(`✅ Done: ${result.candidatesFound} candidates, ${result.opportunitiesSaved} saved, ${result.actionsExecuted} executed`);
    } catch (err) {
      console.error(`❌ Error:`, err);
    }
  }

  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
