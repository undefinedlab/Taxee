import { type FastifyPluginAsync } from "fastify";
import { SiweMessage } from "siwe";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";

/**
 * SIWE (Sign-In With Ethereum) authentication routes.
 *
 * Flow:
 *   1. GET  /auth/nonce          — returns a fresh nonce for the wallet to sign
 *   2. POST /auth/verify         — verifies the SIWE signature, returns JWT
 *   3. POST /auth/telegram/link  — links a verified Telegram chat_id to the user
 */
export const authRoutes: FastifyPluginAsync = async (app) => {
  const nonces = new Map<string, { nonce: string; expiresAt: number }>();

  app.get("/nonce", async (request, reply) => {
    const nonce = Math.random().toString(36).slice(2, 12);
    const address = (request.query as Record<string, string>)["address"];
    if (!address) return reply.code(400).send({ error: "address required" });

    nonces.set(address.toLowerCase(), {
      nonce,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    return { nonce };
  });

  app.post<{ Body: { message: string; signature: string } }>(
    "/verify",
    async (request, reply) => {
      const { message, signature } = request.body;

      let siwe: SiweMessage;
      try {
        siwe = new SiweMessage(message);
        const result = await siwe.verify({ signature });
        if (!result.success) return reply.code(401).send({ error: "Invalid signature" });
      } catch {
        return reply.code(401).send({ error: "Signature verification failed" });
      }

      const address  = siwe.address.toLowerCase();
      const stored   = nonces.get(address);
      if (!stored || stored.nonce !== siwe.nonce || stored.expiresAt < Date.now()) {
        return reply.code(401).send({ error: "Invalid or expired nonce" });
      }
      nonces.delete(address);

      const [existing] = await db.select().from(users).where(eq(users.address, address));

      let userId: string;
      if (existing) {
        userId = existing.id;
      } else {
        const [created] = await db.insert(users).values({ address }).returning({ id: users.id });
        if (!created) return reply.code(500).send({ error: "Failed to create user" });
        userId = created.id;
      }

      const token = await reply.jwtSign({ sub: userId, address }, { expiresIn: "7d" });
      return { token, userId };
    }
  );

  app.post<{ Body: { telegramChatId: string; telegramUserId: string } }>(
    "/telegram/link",
    { preHandler: [(app as any).authenticate] },
    async (request, reply) => {
      const { telegramChatId } = request.body;
      const userId = (request.user as any).sub as string;

      await db
        .update(users)
        .set({ telegramId: telegramChatId })
        .where(eq(users.id, userId));

      return { ok: true };
    }
  );
};
