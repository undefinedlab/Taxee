import { type FastifyPluginAsync } from "fastify";
import { db } from "../db/client.js";
import { agents } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { parseGoal } from "@taxee/llm";
import { CircleClient } from "@taxee/aggregator";

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
    Body: { name?: string; goalStatement: string; walletAddress?: string };
  }>("/", auth, async (request, reply) => {
    const userId = (request.user as any).sub as string;
    const { name, goalStatement, walletAddress } = request.body;

    const policy = await parseGoal(goalStatement);

    let circleWalletId: string | undefined;
    const apiKey      = process.env["CIRCLE_API_KEY"];
    const entitySecret = process.env["CIRCLE_ENTITY_SECRET"];
    const walletSetId  = process.env["CIRCLE_WALLET_SET_ID"];

    if (apiKey && entitySecret && walletSetId) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const circle = new (CircleClient as any)(
          apiKey,
          (process.env["CIRCLE_ENVIRONMENT"] ?? "sandbox") as "sandbox" | "production",
          entitySecret
        ) as CircleClient;

        const wallet = await (circle as any).createDeveloperWallet({
          idempotencyKey: `agent-${userId}-${Date.now()}`,
          walletSetId,
          blockchain: "BASE",
        });
        circleWalletId = wallet.id;
        console.log(`[agent] Created Circle wallet ${circleWalletId} for user ${userId}`);
      } catch (err: unknown) {
        console.error("[agent] Circle wallet creation failed (non-fatal):", err);
      }
    }

    const [agent] = await db
      .insert(agents)
      .values({
        userId,
        ...(circleWalletId !== undefined ? { circleWalletId } : {}),
        ...(walletAddress  !== undefined ? { walletAddress  } : {}),
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
