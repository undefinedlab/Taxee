import { type FastifyPluginAsync } from "fastify";
import { db } from "../db/client.js";
import { opportunities, agents } from "../db/schema.js";
import { eq, and, desc } from "drizzle-orm";
import { executeOpportunity } from "@taxee/execution";

/**
 * /actions routes — manage tax opportunity decisions.
 *
 * GET  /actions?agentId=   — list opportunities for an agent
 * POST /actions/:id/approve — user approves execution (manual mode)
 * POST /actions/:id/defer   — user defers execution
 * POST /actions/:id/skip    — user skips opportunity
 */
export const actionRoutes: FastifyPluginAsync = async (app) => {
  const auth = { preHandler: [(app as any).authenticate] };

  app.get<{ Querystring: { agentId: string; limit?: string } }>("/", auth, async (request, reply) => {
    const userId  = (request.user as any).sub as string;
    const { agentId, limit } = request.query;

    const [agent] = await db
      .select()
      .from(agents)
      .where(and(eq(agents.id, agentId), eq(agents.userId, userId)));

    if (!agent) return reply.code(403).send({ error: "Agent not found or unauthorized" });

    const rows = await db
      .select()
      .from(opportunities)
      .where(eq(opportunities.agentId, agentId))
      .orderBy(desc(opportunities.createdAt))
      .limit(parseInt(limit ?? "50", 10));

    return rows;
  });

  app.post<{ Params: { id: string } }>("/:id/approve", auth, async (request, reply) => {
    const userId = (request.user as any).sub as string;
    const [opp]  = await db.select().from(opportunities).where(eq(opportunities.id, request.params.id));
    if (!opp) return reply.code(404).send({ error: "Opportunity not found" });

    const [agent] = await db
      .select()
      .from(agents)
      .where(and(eq(agents.id, opp.agentId), eq(agents.userId, userId)));

    if (!agent) return reply.code(403).send({ error: "Unauthorized" });

    const [updated] = await db
      .update(opportunities)
      .set({ approvedAt: new Date() })
      .where(eq(opportunities.id, request.params.id))
      .returning();

    const connType =
      (agent.policy as { walletConnectionType?: string } | null)?.walletConnectionType ??
      (agent.circleWalletId ? "circle" : "external_eip7702");

    if ((opp as { candidateAction?: unknown }).candidateAction) {
      if (agent.circleWalletId || connType === "external_eip7702") {
        executeOpportunity(opp.id).catch((err: unknown) =>
          console.error(`[action] Execution failed for opportunity ${opp.id}:`, err),
        );
      }
    }

    return updated;
  });

  app.post<{ Params: { id: string }; Body: { deferDays?: number } }>(
    "/:id/defer",
    auth,
    async (request, reply) => {
      const userId = (request.user as any).sub as string;
      const [opp]  = await db.select().from(opportunities).where(eq(opportunities.id, request.params.id));
      if (!opp) return reply.code(404).send({ error: "Opportunity not found" });

      const [agent] = await db
        .select()
        .from(agents)
        .where(and(eq(agents.id, opp.agentId), eq(agents.userId, userId)));

      if (!agent) return reply.code(403).send({ error: "Unauthorized" });

      const deferDays    = request.body.deferDays ?? 30;
      const deferredUntil = new Date(Date.now() + deferDays * 24 * 60 * 60 * 1000);

      const [updated] = await db
        .update(opportunities)
        .set({ deferDays, deferredUntil })
        .where(eq(opportunities.id, request.params.id))
        .returning();

      return updated;
    }
  );

  app.post<{ Params: { id: string } }>("/:id/skip", auth, async (request, reply) => {
    const userId = (request.user as any).sub as string;
    const [opp]  = await db.select().from(opportunities).where(eq(opportunities.id, request.params.id));
    if (!opp) return reply.code(404).send({ error: "Opportunity not found" });

    const [agent] = await db
      .select()
      .from(agents)
      .where(and(eq(agents.id, opp.agentId), eq(agents.userId, userId)));

    if (!agent) return reply.code(403).send({ error: "Unauthorized" });

    await db.delete(opportunities).where(eq(opportunities.id, request.params.id));
    return { ok: true };
  });
};
