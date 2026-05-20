import cron from "node-cron";
import { eq } from "drizzle-orm";
import { db, agents } from "@taxee/db";
import { runHeartbeat } from "./heartbeat.js";

console.log("[agent] taxee heartbeat worker starting");

cron.schedule("*/15 * * * *", async () => {
  console.log(`[agent] Heartbeat tick at ${new Date().toISOString()}`);

  try {
    const activeAgents = await db
      .select({ id: agents.id })
      .from(agents)
      .where(eq(agents.status, "active"));

    console.log(`[agent] Running heartbeat for ${activeAgents.length} active agents`);

    await Promise.allSettled(
      activeAgents.map(async ({ id }) => {
        try {
          const result = await runHeartbeat(id);
          console.log(
            `[agent] agent=${id} found=${result.opportunitiesFound} executed=${result.actionsExecuted}`
          );
        } catch (err) {
          console.error(`[agent] Heartbeat error for agent ${id}:`, err);
        }
      })
    );
  } catch (err) {
    console.error("[agent] Failed to fetch active agents:", err);
  }
});

console.log("[agent] Cron scheduled — running every 15 minutes");
