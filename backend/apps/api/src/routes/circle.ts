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
function uuidToBytes32(uuid: string): string {
  return "0x" + uuid.replace(/-/g, "").padEnd(64, "0");
}

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

    const { challengeId } = await circle.initializeUser({
      userToken,
      idempotencyKey: userId,
      blockchains: [blockchain],
    });

    return reply.send({ userToken, encryptionKey, challengeId });
  });

/**
 * Public endpoint — no JWT required.
 * Called by the /setup-wallet frontend page on load to get fresh credentials.
 * The userId from our DB is effectively a bearer token (unguessable UUID).
 */
app.get<{ Params: { userId: string } }>("/setup/:userId", async (request, reply) => {
  const { userId } = request.params;
  
  // Check if user exists, if not create them (for web onboarding)
  let [user] = await db.select().from(users).where(eq(users.id, userId));
  
  if (!user) {
    // Create user on-the-fly for web onboarding (userId is client-generated UUID)
    const [created] = await db.insert(users).values({ id: userId }).returning();
    if (!created) return reply.code(500).send({ error: "Failed to create user" });
    user = created;
  }

  const circle = getCircleClient();
  try { await circle.createCircleUser(userId); } catch (err: any) {
    if (err?.response?.data?.code !== 155101) throw err;
  }

  const { userToken, encryptionKey } = await circle.getUserToken(userId);
  const blockchain = process.env["CIRCLE_ENVIRONMENT"] === "production" ? "BASE" as const : "BASE-SEPOLIA" as const;
  const { challengeId } = await circle.initializeUser({
    userToken,
    idempotencyKey: userId,
    blockchains: [blockchain],
  });

  return reply.send({ userToken, encryptionKey, challengeId });
  });

  /**
   * Public endpoint for web onboarding.
   * Registers a new web user before Circle wallet setup.
   */
  app.post<{
    Body: { userId: string; walletAddress?: string; source?: string };
  }>("/register-web-user", async (request, reply) => {
    const { userId, walletAddress, source = 'web_onboarding' } = request.body;

    if (!userId || !userId.startsWith('web_')) {
      return reply.code(400).send({ error: "Invalid userId. Must start with 'web_'" });
    }

    // Check if user already exists
    const [existing] = await db.select().from(users).where(eq(users.id, userId));
    if (existing) {
      return reply.send({ success: true, message: "User already exists", userId });
    }

    // Create new user (wallet stored on users.address; agents hold per-wallet addresses)
    await db.insert(users).values({
      id: userId,
      address: walletAddress?.toLowerCase() ?? null,
    });

    return reply.send({ success: true, message: "User registered", userId });
  });

  /**
   * Called by the /setup-wallet page after the user successfully sets up their PIN.
   * Fetches their Circle wallet(s) and stores the wallet info.
   * Also updates user's wallet address if provided.
   */
  app.post<{ Params: { userId: string }; Body: { walletAddress?: string } }>("/wallet-ready/:userId", async (request, reply) => {
    const { userId } = request.params;
    const { walletAddress } = request.body ?? {};
    
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) return reply.code(404).send({ error: "User not found" });

    const circle = getCircleClient();
    const { userToken } = await circle.getUserToken(userId);

    const walletsRes = await (circle as any).client.get("/wallets", {
      params: { userId },
    });
    const walletList: any[] = walletsRes.data?.data?.wallets ?? [];
    if (walletList.length === 0) return reply.code(404).send({ error: "No wallets found for user" });

    const walletId = walletList[0].id;
    const circleWalletAddress = walletList[0].address;

    const linkedAddress = (walletAddress ?? circleWalletAddress ?? user.address)?.toLowerCase();
    if (linkedAddress) {
      await db.update(users).set({ address: linkedAddress }).where(eq(users.id, userId));
    }

    // Update any existing agents with this Circle wallet
    const userAgents = await db.select().from(agents).where(eq(agents.userId, userId));
    if (userAgents.length > 0) {
      await Promise.all(
        userAgents.map((a) => db.update(agents).set({ circleWalletId: walletId }).where(eq(agents.id, a.id)))
      );
    }

    return reply.send({ 
      ok: true, 
      walletId, 
      walletAddress: circleWalletAddress,
      agentsUpdated: userAgents.length 
    });
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
    async (request, reply) => {
      const { oppId } = request.params;

      const [opp] = await db.select().from(opportunities).where(eq(opportunities.id, oppId));
      if (!opp) return reply.code(404).send({ error: "Opportunity not found" });

      const [agent] = await db.select().from(agents).where(eq(agents.id, opp.agentId));
      if (!agent) return reply.code(404).send({ error: "Agent not found" });
      if (!agent.circleWalletId) return reply.code(400).send({ error: "No Circle wallet on agent" });

      const candidate = (opp as any).candidateAction;
      if (!candidate) return reply.code(400).send({ error: "No candidate action stored" });

      const circle = getCircleClient();
      const { userToken, encryptionKey } = await circle.getUserToken(agent.userId);

      const lotRegistryAddress = process.env["TAXEE_LOT_REGISTRY_ADDRESS"] ?? "";
      const { challengeId } = await circle.createUserContractExecution({
        userToken,
        idempotencyKey:       crypto.randomUUID(),
        walletId:             agent.circleWalletId,
        contractAddress:      lotRegistryAddress,
        abiFunctionSignature: "commitDisposal(bytes32,uint256,bytes32)",
        abiParameters:        [
          uuidToBytes32(candidate.lots?.[0]?.id ?? "00000000-0000-0000-0000-000000000000"),
          String(candidate.proceedsUsdc ?? 0),
          uuidToBytes32(agent.id),
        ],
      });

      const frontendUrl = `${process.env["FRONTEND_URL"] ?? "http://localhost:3000"}/execute?oppId=${oppId}`;

      return reply.send({ userToken, encryptionKey, challengeId, frontendUrl });
    }
  );

  /**
   * Called by the /execute frontend page after the Circle SDK confirms execution.
   * Marks the opportunity as executed and sends a Telegram receipt.
   */
  app.post<{ Params: { oppId: string }; Body: { txHash?: string } }>(
    "/executed/:oppId",
    async (request, reply) => {
      const { oppId } = request.params;
      const { txHash } = (request.body as any) ?? {};

      const [opp] = await db.select().from(opportunities).where(eq(opportunities.id, oppId));
      if (!opp) return reply.code(404).send({ error: "Opportunity not found" });

      await db.update(opportunities)
        .set({ executedAt: new Date(), ...(txHash ? { txHash } : {}) })
        .where(eq(opportunities.id, oppId));

      const [agent] = await db.select().from(agents).where(eq(agents.id, opp.agentId));
      if (agent) {
        const [user]  = await db.select().from(users).where(eq(users.id, agent.userId));
        const token   = process.env["TELEGRAM_BOT_TOKEN"];
        const chatId  = user?.telegramId ?? null;
        if (token && chatId) {
          const explorerUrl = txHash ? `https://sepolia.basescan.org/tx/${txHash}` : null;
          const msg =
            `✅ *Tax action executed*\n\n` +
            `Wallet: \`${agent.walletAddress?.slice(0, 10)}...\`\n` +
            (txHash ? `Tx: [view on BaseScan](${explorerUrl})\n` : "") +
            `\nThe lot disposal has been recorded on-chain.`;
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ chat_id: chatId, text: msg, parse_mode: "Markdown", disable_web_page_preview: true }),
          });
        }
      }

      return reply.send({ ok: true });
    }
  );
};

export default circleRoutes;
