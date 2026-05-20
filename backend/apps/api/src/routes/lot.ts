import { type FastifyPluginAsync } from "fastify";
import { db } from "../db/client.js";
import { lots, agents } from "../db/schema.js";
import { eq, and } from "drizzle-orm";

/**
 * /lots routes — manage tax lots for an agent.
 *
 * GET  /lots?agentId=       — list all lots for an agent
 * POST /lots                — create lots in bulk (after wallet import)
 * PATCH /lots/:id           — update lot status (e.g. mark as closed after execution)
 */
export const lotRoutes: FastifyPluginAsync = async (app) => {
  const auth = { preHandler: [(app as any).authenticate] };

  app.get<{ Querystring: { agentId: string; status?: string } }>("/", auth, async (request, reply) => {
    const userId  = (request.user as any).sub as string;
    const { agentId, status } = request.query;

    const [agent] = await db
      .select()
      .from(agents)
      .where(and(eq(agents.id, agentId), eq(agents.userId, userId)));

    if (!agent) return reply.code(403).send({ error: "Agent not found or unauthorized" });

    let query = db.select().from(lots).where(eq(lots.agentId, agentId));

    if (status) {
      query = db
        .select()
        .from(lots)
        .where(and(eq(lots.agentId, agentId), eq(lots.status, status as any)));
    }

    return query;
  });

  app.post<{
    Body: {
      agentId: string;
      lots: Array<{
        assetId: string;
        chainId: number;
        quantity: string;
        costBasisUsd: string;
        acquiredAt: string;
        txHash?: string;
      }>;
    };
  }>("/", auth, async (request, reply) => {
    const userId  = (request.user as any).sub as string;
    const { agentId, lots: lotInputs } = request.body;

    const [agent] = await db
      .select()
      .from(agents)
      .where(and(eq(agents.id, agentId), eq(agents.userId, userId)));

    if (!agent) return reply.code(403).send({ error: "Agent not found or unauthorized" });

    const inserted = await db
      .insert(lots)
      .values(
        lotInputs.map((l) => ({
          agentId,
          assetId:      l.assetId,
          chainId:      l.chainId,
          quantity:     l.quantity,
          costBasisUsd: l.costBasisUsd,
          acquiredAt:   new Date(l.acquiredAt),
          ...(l.txHash !== undefined ? { txHash: l.txHash } : {}),
        }))
      )
      .returning();

    return reply.code(201).send(inserted);
  });

  app.patch<{
    Params: { id: string };
    Body: { status: "open" | "partial" | "closed" };
  }>("/:id", auth, async (request, reply) => {
    const userId = (request.user as any).sub as string;
    const [lot]  = await db.select().from(lots).where(eq(lots.id, request.params.id));

    if (!lot) return reply.code(404).send({ error: "Lot not found" });

    const [agent] = await db
      .select()
      .from(agents)
      .where(and(eq(agents.id, lot.agentId), eq(agents.userId, userId)));

    if (!agent) return reply.code(403).send({ error: "Unauthorized" });

    const [updated] = await db
      .update(lots)
      .set({ status: request.body.status })
      .where(eq(lots.id, request.params.id))
      .returning();

    return updated;
  });
};
