import { type FastifyPluginAsync } from "fastify";
import { db } from "../db/client.js";
import { users, agents, opportunities } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { CircleClient } from "@taxee/aggregator";

const auth = { preHandler: [async (req: any, reply: any) => {
  try { await req.jwtVerify(); } catch { reply.code(401).send({ error: "Unauthorized" }); }
}]};

function getCircleClient(): CircleClient {
  return new CircleClient(
    process.env["CIRCLE_API_KEY"] ?? "",
    (process.env["CIRCLE_ENVIRONMENT"] ?? "sandbox") as "sandbox" | "production",
  );
}

/**
 * Circle User-Controlled Wallet routes.
 *
 * Flow:
 *   1. POST /circle/init         — register Circle user + create wallet challenge
 *   2. Frontend completes SDK    — user sets PIN, wallet created
 *   3. POST /circle/challenge/:oppId — create execution challenge
 *   4. Frontend completes SDK    — user confirms with PIN, tx submitted by Circle MPC
 */
const circleRoutes: FastifyPluginAsync = async (app) => {
  /**
   * Register the current user with Circle and kick off wallet initialisation.
   * Returns { userToken, encryptionKey, challengeId } for the Circle web SDK.
   * The frontend loads the SDK and calls sdk.execute(challengeId) to let the
   * user set their PIN and complete wallet creation.
   */
  app.post("/init", { ...auth }, async (request, reply) => {
    const userId = (request.user as any).sub as string;
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) return reply.code(404).send({ error: "User not found" });

    const circle = getCircleClient();

    try {
      await circle.createCircleUser(userId);
    } catch (err: any) {
      const code = err?.response?.data?.code;
      if (code !== 155101) throw err;
    }

    const { userToken, encryptionKey } = await circle.getUserToken(userId);

    const blockchain = process.env["CIRCLE_ENVIRONMENT"] === "production"
      ? "BASE" as const
      : "BASE-SEPOLIA" as const;

    const { challengeId } = await circle.createUserWallet({
      userToken,
      idempotencyKey: `wallet-init-${userId}`,
      blockchains: [blockchain],
    });

    return reply.send({ userToken, encryptionKey, challengeId });
  });

  /**
   * Get a fresh session token for the current user.
   * Used when the frontend needs to re-authenticate with Circle SDK.
   */
  app.get("/token", { ...auth }, async (request, reply) => {
    const userId = (request.user as any).sub as string;
    const circle = getCircleClient();
    const { userToken, encryptionKey } = await circle.getUserToken(userId);
    return reply.send({ userToken, encryptionKey });
  });

  /**
   * Create an execution challenge for an approved opportunity.
   * The Telegram bot calls this after the user taps Approve, then sends the
   * returned link to the frontend where the user confirms with their PIN.
   *
   * Returns { userToken, encryptionKey, challengeId, frontendUrl }.
   */
  app.post<{ Params: { oppId: string } }>(
    "/challenge/:oppId",
    { ...auth },
    async (request, reply) => {
      const userId = (request.user as any).sub as string;
      const { oppId } = request.params;

      const [opp] = await db.select().from(opportunities).where(eq(opportunities.id, oppId));
      if (!opp) return reply.code(404).send({ error: "Opportunity not found" });

      const [agent] = await db.select().from(agents).where(eq(agents.id, opp.agentId));
      if (!agent) return reply.code(404).send({ error: "Agent not found" });
      if (!agent.circleWalletId) return reply.code(400).send({ error: "No Circle wallet on agent" });

      const candidate = (opp as any).candidateAction;
      if (!candidate) return reply.code(400).send({ error: "No candidate action stored" });

      const circle = getCircleClient();
      const { userToken, encryptionKey } = await circle.getUserToken(userId);

      const lotRegistryAddress = process.env["TAXEE_LOT_REGISTRY_ADDRESS"] ?? "";
      const { challengeId } = await circle.createUserContractExecution({
        userToken,
        idempotencyKey:       `exec-${oppId}`,
        walletId:             agent.circleWalletId,
        contractAddress:      lotRegistryAddress,
        abiFunctionSignature: "commitDisposal(bytes32,uint256,bytes32)",
        abiParameters:        [
          candidate.lots?.[0]?.id ?? "",
          candidate.proceedsUsdc ?? "0",
          agent.id,
        ],
      });

      const frontendUrl = `${process.env["FRONTEND_URL"] ?? "http://localhost:3000"}/execute?challengeId=${challengeId}&oppId=${oppId}`;

      return reply.send({ userToken, encryptionKey, challengeId, frontendUrl });
    }
  );
};

export default circleRoutes;
