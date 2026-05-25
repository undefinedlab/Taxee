import { randomUUID } from "node:crypto";
import { type FastifyPluginAsync } from "fastify";
import { db } from "../db/client.js";
import { users, agents, opportunities } from "../db/schema.js";
import { and, eq } from "drizzle-orm";
import { executeOpportunity } from "@taxee/execution";
import { CircleClient } from "@taxee/aggregator";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const auth = { preHandler: [async (req: any, reply: any) => {
  try { await req.jwtVerify(); } catch { reply.code(401).send({ error: "Unauthorized" }); }
}]};

function getCircleClient(): CircleClient {
  return new CircleClient(
    process.env["CIRCLE_API_KEY"] ?? "",
    (process.env["CIRCLE_ENVIRONMENT"] ?? "sandbox") as "sandbox" | "production",
  );
}

async function findExistingUserWallet(circle: CircleClient, userId: string) {
  const wallets = await circle.listUserWallets(userId);
  const first = wallets[0];
  if (!first?.address) return null;
  return { walletId: first.id, walletAddress: first.address };
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

async function assertOppOwnedByUser(oppId: string, userId: string) {
  if (!UUID_RE.test(userId)) return null;
  const rows = await db
    .select({ opp: opportunities, agent: agents })
    .from(opportunities)
    .innerJoin(agents, eq(opportunities.agentId, agents.id))
    .where(and(eq(opportunities.id, oppId), eq(agents.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
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

  if (!UUID_RE.test(userId)) {
    return reply.code(400).send({ error: "Invalid userId — expected UUID" });
  }

  let [user] = await db.select().from(users).where(eq(users.id, userId));
  
  if (!user) {
    if (!UUID_RE.test(userId)) {
      return reply.code(400).send({
        error: "Invalid userId — use a UUID from POST /circle/register-web-user",
      });
    }
    const [created] = await db.insert(users).values({ id: userId }).returning();
    if (!created) return reply.code(500).send({ error: "Failed to create user" });
    user = created;
  }

  const circle = getCircleClient();
  try { await circle.createCircleUser(userId); } catch (err: any) {
    if (err?.response?.data?.code !== 155101) throw err;
  }

  const existing = await findExistingUserWallet(circle, userId);
  if (existing) {
    if (existing.walletAddress) {
      await db.update(users).set({ address: existing.walletAddress.toLowerCase() }).where(eq(users.id, userId));
    }
    return reply.send({
      alreadySetup: true,
      walletAddress: existing.walletAddress,
      walletId: existing.walletId,
    });
  }

  const { userToken, encryptionKey } = await circle.getUserToken(userId);
  const blockchain = process.env["CIRCLE_ENVIRONMENT"] === "production" ? "BASE" as const : "BASE-SEPOLIA" as const;

  try {
    const { challengeId } = await circle.initializeUser({
      userToken,
      idempotencyKey: userId,
      blockchains: [blockchain],
    });
    return reply.send({ userToken, encryptionKey, challengeId });
  } catch (err: any) {
    const httpStatus = err?.response?.status;
    if (httpStatus === 409 || httpStatus === 400) {
      const recovered = await findExistingUserWallet(circle, userId);
      if (recovered) {
        return reply.send({
          alreadySetup: true,
          walletAddress: recovered.walletAddress,
          walletId: recovered.walletId,
        });
      }
    }
    throw err;
  }
  });

  /**
   * Public endpoint for web onboarding.
   * Registers a new web user before Circle wallet setup.
   */
  /**
   * After web onboarding — link wallet to a DB agent (Circle MPC or MetaMask / watch-only).
   */
  app.post<{
    Body: {
      userId: string;
      walletAddress: string;
      policy?: Record<string, unknown>;
      approvalMode?: "manual" | "delegated";
    };
  }>("/sync-web-agent", async (request, reply) => {
    const { userId, walletAddress, policy = {}, approvalMode = "manual" } = request.body;

    if (!UUID_RE.test(userId)) {
      return reply.code(400).send({ error: "Invalid userId" });
    }
    if (!walletAddress?.match(/^0x[a-fA-F0-9]{40}$/)) {
      return reply.code(400).send({ error: "Invalid walletAddress" });
    }

    const connType =
      (policy as { walletConnectionType?: string }).walletConnectionType ?? "external_eip7702";
    const linked = walletAddress.toLowerCase();

    let [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) {
      const [created] = await db.insert(users).values({ id: userId }).returning();
      user = created;
    }

    const policyPayload = {
      ...policy,
      walletConnectionType: connType,
    };

    const upsertAgent = async (fields: {
      walletAddress: string;
      circleWalletId?: string | null;
    }) => {
      const existingAgents = await db.select().from(agents).where(eq(agents.userId, userId));
      let agent = existingAgents.find(
        (a) => a.walletAddress?.toLowerCase() === fields.walletAddress.toLowerCase(),
      );

      if (!agent) {
        const [created] = await db
          .insert(agents)
          .values({
            userId,
            walletAddress: fields.walletAddress,
            circleWalletId: fields.circleWalletId ?? null,
            name: "Web Agent",
            status: "active",
            approvalMode,
            policy: policyPayload as any,
          })
          .returning();
        if (!created) return null;
        agent = created;
      } else {
        const [updated] = await db
          .update(agents)
          .set({
            walletAddress: fields.walletAddress,
            circleWalletId: fields.circleWalletId ?? agent.circleWalletId,
            approvalMode,
            policy: policyPayload as any,
            status: "active",
            updatedAt: new Date(),
          })
          .where(eq(agents.id, agent.id))
          .returning();
        agent = updated ?? agent;
      }
      return agent;
    };

    if (connType === "circle") {
      const circle = getCircleClient();
      try {
        await circle.createCircleUser(userId);
      } catch (err: any) {
        if (err?.response?.data?.code !== 155101) throw err;
      }

      const wallets = await circle.listUserWallets(userId);
      if (wallets.length === 0) {
        return reply.code(400).send({
          error: "No Circle wallet found. Complete Circle PIN setup first.",
        });
      }

      const firstWallet = wallets[0];
      if (!firstWallet?.address) {
        return reply.code(400).send({ error: "Circle wallet has no address" });
      }

      const circleAddr = firstWallet.address.toLowerCase();
      await db.update(users).set({ address: circleAddr }).where(eq(users.id, userId));

      const agent = await upsertAgent({
        walletAddress: circleAddr,
        circleWalletId: firstWallet.id,
      });
      if (!agent) return reply.code(500).send({ error: "Agent sync failed" });

      return reply.send({
        agentId: agent.id,
        circleWalletId: firstWallet.id,
        walletAddress: circleAddr,
        walletConnectionType: connType,
        userId,
      });
    }

    // MetaMask / EIP-7702 or watch-only — use the connected address directly
    try {
      await db.update(users).set({ address: linked }).where(eq(users.id, userId));
    } catch (err: unknown) {
      const pgCode = (err as { code?: string })?.code;
      if (pgCode !== "23505") throw err;
    }

    const agent = await upsertAgent({
      walletAddress: linked,
      circleWalletId: null,
    });
    if (!agent) return reply.code(500).send({ error: "Agent sync failed" });

    return reply.send({
      agentId: agent.id,
      walletAddress: linked,
      walletConnectionType: connType,
      userId,
    });
  });

  /**
   * Approve an opportunity (web dashboard). Starts server execution for Circle agents.
   */
  app.post<{
    Params: { oppId: string };
    Body: { userId: string };
  }>("/opportunities/:oppId/approve", async (request, reply) => {
    const { oppId } = request.params;
    const { userId } = request.body ?? {};
    const row = await assertOppOwnedByUser(oppId, userId);
    if (!row) return reply.code(404).send({ error: "Opportunity not found" });

    if (row.opp.executedAt) {
      return reply.send({ ok: true, alreadyExecuted: true });
    }

    await db
      .update(opportunities)
      .set({ approvedAt: new Date() })
      .where(eq(opportunities.id, oppId));

    if (row.agent.circleWalletId && row.opp.candidateAction) {
      void executeOpportunity(oppId).catch((err: unknown) =>
        request.log.error({ err, oppId }, "executeOpportunity failed"),
      );
      return reply.send({ ok: true, execution: "circle_started" });
    }

    return reply.send({
      ok: true,
      execution: "recorded",
      message:
        "Approval saved. On-chain execution uses Circle MPC or EIP-7702 delegation when configured; tx hash appears in History after execution.",
    });
  });

  /**
   * Skip / dismiss an opportunity (web dashboard).
   */
  app.post<{
    Params: { oppId: string };
    Body: { userId: string };
  }>("/opportunities/:oppId/skip", async (request, reply) => {
    const { oppId } = request.params;
    const { userId } = request.body ?? {};
    const row = await assertOppOwnedByUser(oppId, userId);
    if (!row) return reply.code(404).send({ error: "Opportunity not found" });

    await db.delete(opportunities).where(eq(opportunities.id, oppId));
    return reply.send({ ok: true });
  });

  /**
   * Run heartbeat scan for all active agents owned by this web user (creates opportunities in DB).
   */
  app.post<{ Params: { userId: string } }>("/run-scan/:userId", async (request, reply) => {
    const { userId } = request.params;
    if (!UUID_RE.test(userId)) {
      return reply.code(400).send({ error: "Invalid userId" });
    }

    const userAgents = await db.select().from(agents).where(eq(agents.userId, userId));
    if (userAgents.length === 0) {
      return reply.code(404).send({
        error:
          "No server agent for this user. Finish Circle onboarding and sync (Settings → Sync), or redeploy API with /circle/sync-web-agent.",
      });
    }

    const { runHeartbeat } = await import("@taxee/agent/heartbeat");
    const results: Array<{
      agentId: string;
      candidatesFound: number;
      opportunitiesSaved: number;
      actionsExecuted: number;
    }> = [];

    for (const agent of userAgents) {
      if (agent.status !== "active") {
        results.push({
          agentId: agent.id,
          candidatesFound: 0,
          opportunitiesSaved: 0,
          actionsExecuted: 0,
        });
        continue;
      }
      const r = await runHeartbeat(agent.id);
      results.push({
        agentId: agent.id,
        candidatesFound: r.candidatesFound,
        opportunitiesSaved: r.opportunitiesSaved,
        actionsExecuted: r.actionsExecuted,
      });
    }

    return reply.send({
      ok: true,
      scanned: results.length,
      results,
      totalSaved: results.reduce((s, x) => s + x.opportunitiesSaved, 0),
    });
  });

  /**
   * List opportunities for all agents owned by this web user (Telegram heartbeat writes here).
   */
  app.get<{ Params: { userId: string } }>("/opportunities/:userId", async (request, reply) => {
    const { userId } = request.params;
    if (!UUID_RE.test(userId)) {
      return reply.code(400).send({ error: "Invalid userId" });
    }

    const userAgents = await db.select().from(agents).where(eq(agents.userId, userId));
    if (userAgents.length === 0) return reply.send([]);

    const all: typeof opportunities.$inferSelect[] = [];
    for (const agent of userAgents) {
      const rows = await db
        .select()
        .from(opportunities)
        .where(eq(opportunities.agentId, agent.id))
        .orderBy(opportunities.createdAt);
      all.push(...rows);
    }

    return reply.send(
      all.map((row) => ({
        ...row,
        taxSavingEstimate: Number(row.taxSavingEstimate),
      })),
    );
  });

  /**
   * Session tokens for an existing Circle user (PIN prompted by SDK on execute).
   */
  app.get<{ Params: { userId: string } }>("/session/:userId", async (request, reply) => {
    const { userId } = request.params;
    if (!UUID_RE.test(userId)) {
      return reply.code(400).send({ error: "Invalid userId" });
    }

    const circle = getCircleClient();
    const existing = await findExistingUserWallet(circle, userId);
    if (!existing?.walletAddress) {
      return reply.code(404).send({ error: "No Circle wallet found. Create one first." });
    }

    const { userToken, encryptionKey } = await circle.getUserToken(userId);
    return reply.send({
      userToken,
      encryptionKey,
      walletAddress: existing.walletAddress,
      walletId: existing.walletId,
    });
  });

  /**
   * Remove web agents (keeps Circle user + wallet). Clears bad MetaMask/Circle mix-ups.
   */
  app.delete<{ Params: { userId: string } }>("/web-reset/:userId", async (request, reply) => {
    const { userId } = request.params;
    if (!UUID_RE.test(userId)) {
      return reply.code(400).send({ error: "Invalid userId" });
    }

    const userAgents = await db.select().from(agents).where(eq(agents.userId, userId));
    for (const a of userAgents) {
      await db.delete(agents).where(eq(agents.id, a.id));
    }

    // Unlink external (MetaMask) address so re-register does not hit users_address_unique
    await db.update(users).set({ address: null }).where(eq(users.id, userId));

    return reply.send({
      ok: true,
      deletedAgents: userAgents.length,
      clearedUserAddress: true,
    });
  });

  app.post<{
    Body: { userId?: string; walletAddress?: string; source?: string };
  }>("/register-web-user", async (request, reply) => {
    const { walletAddress, source = "web_onboarding" } = request.body;
    let userId = request.body.userId?.trim();

    if (!userId || !UUID_RE.test(userId)) {
      userId = randomUUID();
    }

    const [existing] = await db.select().from(users).where(eq(users.id, userId));
    if (existing) {
      return reply.send({ success: true, message: "User already exists", userId });
    }

    const normalizedAddress = walletAddress?.toLowerCase() ?? null;
    try {
      await db.insert(users).values({
        id: userId,
        address: normalizedAddress,
      });
    } catch (err: unknown) {
      const pgCode = (err as { code?: string })?.code;
      if (pgCode === "23505" && normalizedAddress) {
        // MetaMask / external address already linked to another user — Circle user id only
        await db.insert(users).values({ id: userId });
        return reply.send({
          success: true,
          message: "User registered (address not linked — already in use)",
          userId,
          source,
        });
      }
      throw err;
    }

    return reply.send({ success: true, message: "User registered", userId, source });
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
      if (!candidate) {
        return reply.code(400).send({
          error: "No execution payload for this opportunity. Wait for a new scan from the agent heartbeat.",
        });
      }

      const circle = getCircleClient();
      const { userToken, encryptionKey } = await circle.getUserToken(agent.userId);

      const lotRegistryAddress = process.env["TAXEE_LOT_REGISTRY_ADDRESS"] ?? "";
      if (!lotRegistryAddress) {
        return reply.code(503).send({
          error: "TAXEE_LOT_REGISTRY_ADDRESS not configured on API",
        });
      }

      try {
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
      } catch (err: any) {
        const msg = err?.response?.data?.message ?? err?.message ?? "Circle execution failed";
        request.log.error({ err, oppId }, "circle challenge failed");
        return reply.code(502).send({ error: msg });
      }
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
