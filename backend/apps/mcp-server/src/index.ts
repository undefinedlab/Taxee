import Fastify from "fastify";
import cors from "@fastify/cors";
import { eq } from "drizzle-orm";
import { db, agents, lots, opportunities } from "@taxee/db";
import { scanForHarvestOpportunities } from "@taxee/tax-engine";
import { fetchPrices } from "@taxee/aggregator";
import type { UserPolicy } from "@taxee/shared";

/**
 * MCP (Model Context Protocol) server.
 *
 * Exposes taxee's core tax intelligence as a set of tools that can be
 * called by an external LLM orchestrator (Claude, GPT-4, etc.) to:
 *   - query portfolio positions
 *   - run the tax engine on current lots
 *   - fetch current prices
 *   - read pending opportunities
 *
 * Authentication: Bearer token matching API_SECRET env variable.
 * This server is NOT user-facing — it is called by the orchestrating LLM.
 */
const app = Fastify({ logger: false });

await app.register(cors, { origin: "*" });

const secret = process.env["MCP_SECRET"] ?? "dev-mcp-secret";

app.addHook("onRequest", async (request, reply) => {
  const auth = request.headers["authorization"];
  if (!auth || auth !== `Bearer ${secret}`) {
    reply.code(401).send({ error: "Unauthorized" });
  }
});

app.get("/tools", async () => ({
  tools: [
    {
      name:        "get_portfolio",
      description: "Returns current open lot positions and unrealised P&L for an agent",
      parameters:  { agentId: "string" },
    },
    {
      name:        "run_harvest_scan",
      description: "Runs the tax-loss harvest scanner and returns a list of ranked opportunities",
      parameters:  { agentId: "string" },
    },
    {
      name:        "get_pending_opportunities",
      description: "Returns opportunities that are awaiting user approval",
      parameters:  { agentId: "string" },
    },
    {
      name:        "get_prices",
      description: "Returns current USD prices for a list of asset IDs",
      parameters:  { assetIds: "string[]" },
    },
  ],
}));

app.post<{ Body: { tool: string; input: Record<string, unknown> } }>(
  "/call",
  async (request, reply) => {
    const { tool, input } = request.body;

    switch (tool) {
      case "get_portfolio": {
        const agentId = input["agentId"] as string;
        const openLots = await db
          .select()
          .from(lots)
          .where(eq(lots.agentId, agentId));

        const assetIds = [...new Set(openLots.map((l) => l.assetId))];
        const prices   = await fetchPrices(assetIds);

        return {
          positions: openLots.map((l) => ({
            ...l,
            currentPrice:       prices[l.assetId] ?? 0,
            unrealizedGainLoss: parseFloat(l.quantity) * (prices[l.assetId] ?? 0) -
                                parseFloat(l.costBasisUsd),
          })),
        };
      }

      case "run_harvest_scan": {
        const agentId = input["agentId"] as string;
        const [agent] = await db
          .select()
          .from(agents)
          .where(eq(agents.id, agentId));

        if (!agent) return reply.code(404).send({ error: "Agent not found" });

        const openLots = await db
          .select()
          .from(lots)
          .where(eq(lots.agentId, agentId));

        const assetIds = [...new Set(openLots.map((l) => l.assetId))];
        const prices   = await fetchPrices(assetIds);

        const now = Date.now();
        const policy = agent.policy as unknown as UserPolicy;

        const typedLots = openLots.map((l) => ({
          id:               l.id,
          agentId:          l.agentId,
          assetId:          l.assetId,
          chainId:          l.chainId,
          acquiredAt:       l.acquiredAt,
          costBasisUsd:     l.costBasisUsd,
          quantity:         l.quantity,
          sourceTx:         l.txHash ?? "",
          status:           l.status as "open" | "partial" | "closed",
          holdingPeriodDays: Math.floor((now - l.acquiredAt.getTime()) / 86_400_000),
          provisional:      false,
          createdAt:        l.createdAt,
        }));

        const positionMap = new Map<string, typeof typedLots>();
        for (const lot of typedLots) {
          const key = `${lot.assetId}:${lot.chainId}`;
          if (!positionMap.has(key)) positionMap.set(key, []);
          positionMap.get(key)!.push(lot);
        }

        const positions = [...positionMap.entries()].map(([, g]) => {
          const first     = g[0]!;
          const totalQty  = g.reduce((s, l) => s + parseFloat(l.quantity), 0);
          const totalCost = g.reduce((s, l) => s + parseFloat(l.costBasisUsd), 0);
          const price     = prices[first.assetId] ?? 0;
          const curVal    = totalQty * price;
          return {
            assetId:              first.assetId,
            chainId:              first.chainId,
            quantity:             String(totalQty),
            currentValueUsd:      String(curVal),
            unrealizedGainLossUsd: String(curVal - totalCost),
            lots:                 g,
          };
        });

        const snapshot = {
          agentId,
          positions,
          prices,
          capturedAt:    new Date(),
          realizedYtd:   { shortTerm: 0, longTerm: 0, lossesHarvested: 0 },
          regimeSignals: {
            btcFundingRatePct:          0,
            stablecoinSupplyDelta7dPct: 0,
            realizedVol30d:             0,
            fearAndGreedIndex:          50,
            ethBtcRatioTrend:           "flat" as const,
            capturedAt:                 new Date(),
          },
          userPolicy: policy,
        };
        const candidates = scanForHarvestOpportunities(snapshot, policy);
        return { candidates };
      }

      case "get_pending_opportunities": {
        const agentId = input["agentId"] as string;
        const pending = await db
          .select()
          .from(opportunities)
          .where(eq(opportunities.agentId, agentId));

        return {
          opportunities: pending.filter(
            (o) => !o.approvedAt && !o.executedAt && !o.deferredUntil
          ),
        };
      }

      case "get_prices": {
        const assetIds = input["assetIds"] as string[];
        const prices   = await fetchPrices(assetIds);
        return { prices };
      }

      default:
        return reply.code(400).send({ error: `Unknown tool: ${tool}` });
    }
  }
);

const port = parseInt(process.env["MCP_PORT"] ?? "3002", 10);
await app.listen({ port, host: "0.0.0.0" });
console.log(`[mcp-server] Running on port ${port}`);
