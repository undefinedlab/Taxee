import { type FastifyPluginAsync } from "fastify";
import { db } from "../db/client.js";
import { agents } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { parseGoal } from "@taxee/llm";

export const agentRoutes: FastifyPluginAsync = async (app) => {
  const auth = { preHandler: [(app as any).authenticate] };

  app.get("/", auth, async (request) => {
    const userId = (request.user as any).sub as string;
    return db.select().from(agents).where(eq(agents.userId, userId));
  });

  app.get<{ Params: { id: string } }>("/:id", auth, async (request, reply) => {
    const userId  = (request.user as any).sub as string;
    const [agent] = await db
      .select()
      .from(agents)
      .where(and(eq(agents.id, request.params.id), eq(agents.userId, userId)));

    if (!agent) return reply.code(404).send({ error: "Agent not found" });
    return agent;
  });

  app.post<{
    Body: { circleWalletId: string; name?: string; goalStatement: string };
  }>("/", auth, async (request, reply) => {
    const userId = (request.user as any).sub as string;
    const { circleWalletId, name, goalStatement } = request.body;

    const policy = await parseGoal(goalStatement);

    const [agent] = await db
      .insert(agents)
      .values({
        userId,
        circleWalletId,
        name:   name ?? "My taxee Agent",
        policy: policy as any,
        status: "active",
      })
      .returning();

    return reply.code(201).send(agent);
  });

  app.patch<{
    Params: { id: string };
    Body: { status?: "active" | "paused"; approvalMode?: "manual" | "delegated"; name?: string };
  }>("/:id", auth, async (request, reply) => {
    const userId = (request.user as any).sub as string;
    const { id }  = request.params;
    const updates = request.body;

    const [existing] = await db
      .select()
      .from(agents)
      .where(and(eq(agents.id, id), eq(agents.userId, userId)));

    if (!existing) return reply.code(404).send({ error: "Agent not found" });

    const [updated] = await db
      .update(agents)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(agents.id, id))
      .returning();

    return updated;
  });

  app.delete<{ Params: { id: string } }>("/:id", auth, async (request, reply) => {
    const userId = (request.user as any).sub as string;
    const [existing] = await db
      .select()
      .from(agents)
      .where(and(eq(agents.id, request.params.id), eq(agents.userId, userId)));

    if (!existing) return reply.code(404).send({ error: "Agent not found" });

    await db.delete(agents).where(eq(agents.id, request.params.id));
    return { ok: true };
  });
};
