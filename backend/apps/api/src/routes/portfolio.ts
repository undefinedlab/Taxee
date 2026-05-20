import { type FastifyPluginAsync } from "fastify";
import { db } from "../db/client.js";
import { lots, agents, opportunities } from "../db/schema.js";
import { eq, and, sum, count } from "drizzle-orm";
import { fetchPrices } from "@taxee/aggregator";
import { estimateYearEndLiability } from "@taxee/compliance";

/**
 * /portfolio routes — portfolio summary and tax analytics.
 *
 * GET /portfolio/:agentId        — full portfolio snapshot with current prices
 * GET /portfolio/:agentId/ytd    — year-to-date realized gains/losses
 * GET /portfolio/:agentId/liability — estimated year-end tax liability
 */
export const portfolioRoutes: FastifyPluginAsync = async (app) => {
  const auth = { preHandler: [(app as any).authenticate] };

  app.get<{ Params: { agentId: string } }>("/:agentId", auth, async (request, reply) => {
    const userId = (request.user as any).sub as string;
    const [agent] = await db
      .select()
      .from(agents)
      .where(and(eq(agents.id, request.params.agentId), eq(agents.userId, userId)));

    if (!agent) return reply.code(403).send({ error: "Agent not found or unauthorized" });

    const openLots = await db
      .select()
      .from(lots)
      .where(and(eq(lots.agentId, agent.id), eq(lots.status, "open")));

    const assetIds = [...new Set(openLots.map((l) => l.assetId))];
    const prices   = assetIds.length > 0 ? await fetchPrices(assetIds) : {};

    const positions = assetIds.map((assetId) => {
      const assetLots  = openLots.filter((l) => l.assetId === assetId);
      const totalQty   = assetLots.reduce((s, l) => s + parseFloat(l.quantity), 0);
      const totalBasis = assetLots.reduce((s, l) => s + parseFloat(l.costBasisUsd), 0);
      const price      = prices[assetId] ?? 0;
      const marketValue = totalQty * price;

      return {
        assetId,
        quantity:      totalQty,
        costBasisUsd:  totalBasis,
        marketValueUsd: marketValue,
        unrealizedGainLoss: marketValue - totalBasis,
        lotCount: assetLots.length,
      };
    });

    const totalMarketValue = positions.reduce((s, p) => s + p.marketValueUsd, 0);
    const totalCostBasis   = positions.reduce((s, p) => s + p.costBasisUsd, 0);

    return {
      agentId:           agent.id,
      positions,
      totalMarketValueUsd:  totalMarketValue,
      totalCostBasisUsd:    totalCostBasis,
      totalUnrealizedGainLoss: totalMarketValue - totalCostBasis,
      snapshotAt: new Date(),
    };
  });

  app.get<{ Params: { agentId: string } }>("/:agentId/ytd", auth, async (request, reply) => {
    const userId = (request.user as any).sub as string;
    const [agent] = await db
      .select()
      .from(agents)
      .where(and(eq(agents.id, request.params.agentId), eq(agents.userId, userId)));

    if (!agent) return reply.code(403).send({ error: "Agent not found or unauthorized" });

    const ytdOpps = await db
      .select()
      .from(opportunities)
      .where(and(eq(opportunities.agentId, agent.id)));

    const executed = ytdOpps.filter((o) => o.executedAt !== null);
    const totalHarvested = executed.reduce(
      (s, o) => s + parseFloat(o.taxSavingEstimate ?? "0"),
      0
    );
    const totalGainLoss = executed.reduce(
      (s, o) => s + parseFloat(o.estimatedTaxImpact ?? "0"),
      0
    );

    return {
      agentId:          agent.id,
      actionsExecuted:  executed.length,
      totalHarvestedLoss: totalHarvested,
      estimatedGainLoss:  totalGainLoss,
      year: new Date().getFullYear(),
    };
  });

  app.get<{ Params: { agentId: string } }>("/:agentId/liability", auth, async (request, reply) => {
    const userId = (request.user as any).sub as string;
    const [agent] = await db
      .select()
      .from(agents)
      .where(and(eq(agents.id, request.params.agentId), eq(agents.userId, userId)));

    if (!agent) return reply.code(403).send({ error: "Agent not found or unauthorized" });

    const openLots = await db
      .select()
      .from(lots)
      .where(and(eq(lots.agentId, agent.id), eq(lots.status, "open")));

    const assetIds = [...new Set(openLots.map((l) => l.assetId))];
    const prices   = assetIds.length > 0 ? await fetchPrices(assetIds) : {};

    let openGains  = 0;
    let openLosses = 0;

    for (const lot of openLots) {
      const price = prices[lot.assetId] ?? 0;
      const value = parseFloat(lot.quantity) * price;
      const basis = parseFloat(lot.costBasisUsd);
      const gl    = value - basis;
      if (gl > 0) openGains  += gl;
      else         openLosses += Math.abs(gl);
    }

    const executed = await db
      .select()
      .from(opportunities)
      .where(and(eq(opportunities.agentId, agent.id)));

    const harvestedLossesYtd = executed
      .filter((o) => o.executedAt !== null)
      .reduce((s, o) => s + parseFloat(o.taxSavingEstimate ?? "0"), 0);

    const { estimatedTax, netGains } = estimateYearEndLiability(
      openGains,
      openLosses,
      harvestedLossesYtd
    );

    return {
      agentId:            agent.id,
      openGains,
      openLosses,
      harvestedLossesYtd,
      netGains,
      estimatedTaxLiability: estimatedTax,
      snapshotAt: new Date(),
    };
  });
};
