/**
 * Trigger a heartbeat for a single agent with optional lot-sync skip.
 *
 * Run:  node --env-file=../../.env --import tsx src/triggerOne.ts <agentId> [skipSync]
 */
import { runHeartbeat } from "./heartbeat.js";

async function main() {
  const agentId = process.argv[2];
  const skip    = process.argv[3] === "skipSync";

  if (!agentId) {
    console.error("Usage: triggerOne.ts <agentId> [skipSync]");
    process.exit(1);
  }

  console.log(`Triggering ${agentId} (skipLotSync=${skip})...`);
  const result = await runHeartbeat(agentId, { skipLotSync: skip });
  console.log(
    `✅ Done: ${result.candidatesFound} candidates, ${result.opportunitiesSaved} saved, ${result.actionsExecuted} executed`,
  );
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
