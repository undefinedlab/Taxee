import cron from "node-cron";
import { eq } from "drizzle-orm";
import { db, agents } from "@taxee/db";
import type { UserPolicy } from "@taxee/shared";
import { runHeartbeat } from "./heartbeat.js";

console.log("[agent] taxee heartbeat worker starting");

/** Check every minute; each agent runs on its own heartbeatIntervalMinutes */
cron.schedule("* * * * *", async () => {
  try {
    const activeAgents = await db
      .select()
      .from(agents)
      .where(eq(agents.status, "active"));

    const now = Date.now();

    for (const agent of activeAgents) {
      const policy = (agent.policy ?? {}) as UserPolicy;
      const intervalMin = policy.heartbeatIntervalMinutes ?? 30;
      const lastAt = policy.lastHeartbeatAt
        ? new Date(policy.lastHeartbeatAt).getTime()
        : 0;

      if (lastAt > 0 && now - lastAt < intervalMin * 60_000) {
        continue;
      }

      try {
        const result = await runHeartbeat(agent.id);
        await db
          .update(agents)
          .set({
            policy: {
              ...policy,
              lastHeartbeatAt: new Date().toISOString(),
            },
          })
          .where(eq(agents.id, agent.id));

        console.log(
          `[agent] agent=${agent.id} interval=${intervalMin}m saved=${result.opportunitiesSaved} candidates=${result.candidatesFound} executed=${result.actionsExecuted}`,
        );
      } catch (err) {
        console.error(`[agent] Heartbeat error for agent ${agent.id}:`, err);
      }
    }
  } catch (err) {
    console.error("[agent] Failed to fetch active agents:", err);
  }
});

console.log("[agent] Cron scheduled — per-agent interval from policy.heartbeatIntervalMinutes");
