import { and, eq, isNull } from "drizzle-orm";
import { db, agents, lots, opportunities, users } from "@taxee/db";
import {
  CircleClient,
  ArcClient,
  fetchPrices,
  collectRegimeSignals,
  importLotsForWallet,
  resolveAcquisitionPrice,
} from "@taxee/aggregator";
import {
  scanForHarvestOpportunities,
  trackMaturationOpportunities,
  computeRebalanceCandidates,
} from "@taxee/tax-engine";
import {
  classifyRegime,
  reasonAboutAction,
  generateExplanation,
} from "@taxee/llm";
import { validateForExecution, isWashSaleSafe } from "@taxee/compliance";
import { executeApprovedAction } from "@taxee/execution";
import { sendOpportunityNotification, sendActionReceipt } from "@taxee/notifications";
import type {
  UserPolicy,
  CandidateAction,
  PortfolioSnapshot,
  RealizedYtd,
  NotificationChannel,
} from "@taxee/shared";
import { buildAgentPolicy, normalizeJurisdiction } from "@taxee/shared";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const circle = new (CircleClient as any)(
  process.env["CIRCLE_API_KEY"] ?? "",
  (process.env["CIRCLE_ENVIRONMENT"] ?? "sandbox") as "sandbox" | "production",
  process.env["CIRCLE_ENTITY_SECRET"]
) as CircleClient;

const arc = new ArcClient(
  process.env["ARC_API_KEY"] ?? "",
  process.env["ARC_BASE_URL"] ?? "https://api.circle.com/arc/v1"
);

/**
 * Agent heartbeat — runs every 15 minutes via cron.
 *
 * Pipeline (per active agent):
 *   1. Load portfolio snapshot (lots + live prices)
 *   2. Collect onchain signals
 *   3. LLM: classify market regime
 *   4. tax-engine: scan for harvest / maturation / rebalance candidates
 *   5. LLM: reason about each candidate → EXECUTE / DEFER / SKIP
 *   6. Guardrails: validate approved actions
 *   7. Execute (if delegated) OR notify for manual approval
 *   8. LLM: generate explanation → send notification
 */
export async function runHeartbeat(agentId: string): Promise<{
  /** Raw tax-engine matches before LLM */
  candidatesFound: number;
  /** Rows inserted into opportunities (pending notify) */
  opportunitiesSaved: number;
  actionsExecuted: number;
}> {
  console.log(`[heartbeat] Starting for agent ${agentId}`);

  const [agent] = await db
    .select()
    .from(agents)
    .where(eq(agents.id, agentId));

  if (!agent || agent.status !== "active") {
    console.log(`[heartbeat] Agent ${agentId} is not active, skipping`);
    return { candidatesFound: 0, opportunitiesSaved: 0, actionsExecuted: 0 };
  }

  const walletAddress = agent.walletAddress;

  if (walletAddress && process.env["ALCHEMY_API_KEY"]) {
    const existing = await db
      .select({ txHash: lots.txHash })
      .from(lots)
      .where(eq(lots.agentId, agentId));
    const existingHashes = new Set(
      existing.map((l) => l.txHash).filter(Boolean) as string[]
    );
    const imported = await importLotsForWallet(
      walletAddress,
      process.env["ALCHEMY_API_KEY"],
      process.env["COINGECKO_API_KEY"],
      existingHashes,
    );
    if (imported.length > 0) {
      await db.insert(lots).values(
        imported.map((l) => ({
          agentId,
          assetId:      l.assetId,
          chainId:      l.chainId,
          quantity:     l.quantity,
          costBasisUsd: l.costBasisUsd,
          acquiredAt:   l.acquiredAt,
          status:       "open" as const,
          txHash:       l.txHash,
        }))
      );
      console.log(`[heartbeat] Synced ${imported.length} new lots for agent ${agentId}`);
    }
  } else if (!process.env["ALCHEMY_API_KEY"]) {
    console.log(`[heartbeat] ALCHEMY_API_KEY not set — using existing lots from DB`);
  }

  const [agentOwner] = await db.select().from(users).where(eq(users.id, agent.userId));
  const userJurisdiction = normalizeJurisdiction(agentOwner?.jurisdiction);
  const stored = (agent.policy ?? {}) as Partial<UserPolicy>;
  const policy: UserPolicy = buildAgentPolicy(userJurisdiction, stored);

  const openLots = await db
    .select()
    .from(lots)
    .where(eq(lots.agentId, agentId));

  const assetIds = [...new Set(openLots.map((l) => l.assetId))];
  const prices   = await fetchPrices(assetIds, process.env["COINGECKO_API_KEY"]);

  // Repair lots with missing cost basis using acquisition-date price (not spot)
  const geckoKey = process.env["COINGECKO_API_KEY"];
  for (const lot of openLots) {
    const basis = parseFloat(lot.costBasisUsd);
    if (basis > 0) continue;
    const { price, source } = await resolveAcquisitionPrice(
      lot.assetId,
      lot.acquiredAt,
      geckoKey,
    );
    if (price <= 0) continue;
    const repaired = (parseFloat(lot.quantity) * price).toFixed(4);
    await db.update(lots).set({ costBasisUsd: repaired }).where(eq(lots.id, lot.id));
    lot.costBasisUsd = repaired;
    console.log(
      `[heartbeat] Repaired lot ${lot.id} using ${source} (${lot.acquiredAt.toISOString().slice(0, 10)} @ $${price}) → $${repaired}`,
    );
  }

  const now = Date.now();

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

  const positions = [...positionMap.entries()].map(([, lotGroup]) => {
    const first       = lotGroup[0]!;
    const totalQty    = lotGroup.reduce((s, l) => s + parseFloat(l.quantity), 0);
    const totalCost   = lotGroup.reduce((s, l) => s + parseFloat(l.costBasisUsd), 0);
    const price       = prices[first.assetId] ?? 0;
    const currentVal  = totalQty * price;
    return {
      assetId:              first.assetId,
      chainId:              first.chainId,
      quantity:             String(totalQty),
      currentValueUsd:      String(currentVal),
      unrealizedGainLossUsd: String(currentVal - totalCost),
      lots:                 lotGroup,
    };
  });

  const ytdData = await db
    .select()
    .from(opportunities)
    .where(eq(opportunities.agentId, agentId));

  const realizedYtd: RealizedYtd = {
    shortTerm:       0,
    longTerm:        0,
    lossesHarvested: ytdData
      .filter((o) => o.executedAt !== null)
      .reduce((s, o) => s + parseFloat(o.taxSavingEstimate ?? "0"), 0),
  };

  const signals = await collectRegimeSignals();
  const regime  = await classifyRegime(signals);

  const snapshot: PortfolioSnapshot = {
    agentId,
    positions,
    prices,
    capturedAt:    new Date(),
    realizedYtd,
    regimeSignals: signals,
    userPolicy:    policy,
  };

  const harvestCandidates  = scanForHarvestOpportunities(snapshot, policy);
  const maturationCandidates = trackMaturationOpportunities(snapshot, policy);
  const rebalanceCandidates  = computeRebalanceCandidates(snapshot, regime.regime, policy);

  const allCandidates: CandidateAction[] = [
    ...harvestCandidates,
    ...maturationCandidates,
    ...rebalanceCandidates,
  ].filter((c) => isWashSaleSafe(c));

  console.log(
    `[heartbeat] ${allCandidates.length} candidates (harvest threshold ${policy.harvestThresholdPct}%, min loss $${policy.minHarvestLossUsd ?? 0}, every ${policy.heartbeatIntervalMinutes ?? 30}m)`,
  );

  let actionsExecuted = 0;
  let opportunitiesSaved = 0;

  const channels: NotificationChannel[] = [];
  if (agent.policy && (agent.policy as any).telegramChatId) {
    channels.push({ type: "telegram", chatId: (agent.policy as any).telegramChatId });
  }

  // ── Dedup setup: collect signatures of pending (un-actioned, not in defer cooldown)
  // opportunities so we don't spam the same lots on every heartbeat tick.
  const pendingOpps = await db
    .select()
    .from(opportunities)
    .where(
      and(
        eq(opportunities.agentId, agentId),
        isNull(opportunities.approvedAt),
        isNull(opportunities.executedAt),
      ),
    );

  const NOW_MS = Date.now();
  const activeSigs = new Set<string>();
  for (const o of pendingOpps) {
    if (o.deferredUntil && o.deferredUntil.getTime() < NOW_MS) continue;
    const ca = o.candidateAction as { lots?: Array<{ id?: string }> } | null;
    const lotIds = (ca?.lots ?? []).map((l) => l.id).filter(Boolean) as string[];
    if (lotIds.length === 0) continue;
    activeSigs.add(`${o.type}:${lotIds.slice().sort().join(",")}`);
  }

  const candidateSig = (c: CandidateAction): string | null => {
    const ids = c.lots.map((l) => l.id).filter(Boolean) as string[];
    if (ids.length === 0) return null;
    return `${c.type}:${ids.slice().sort().join(",")}`;
  };

  for (const candidate of allCandidates) {
    try {
      const sig = candidateSig(candidate);
      if (sig && activeSigs.has(sig)) {
        console.log(
          `[heartbeat] Skip duplicate ${candidate.type} for ${candidate.lots.length} lot(s) — already pending`,
        );
        continue;
      }

      const decision = await reasonAboutAction(candidate, policy, realizedYtd);

      if (decision.decision === "SKIP") {
        console.log(`[heartbeat] LLM SKIP ${candidate.type}: ${decision.reasoning.slice(0, 120)}`);
        continue;
      }

      const explanation = await generateExplanation({
        actionType:         candidate.type,
        decision:           decision.decision,
        reasoning:          decision.reasoning,
        estimatedTaxImpact: decision.estimatedTaxImpact ?? 0,
        ...(candidate.lots[0]?.assetId !== undefined ? { assetSymbol: candidate.lots[0].assetId } : {}),
        ...(candidate.replacementAsset !== undefined ? { replacementAsset: candidate.replacementAsset } : {}),
        ...(decision.deferDays !== undefined        ? { deferDays: decision.deferDays }               : {}),
        ...(decision.interimAction !== undefined    ? { interimAction: decision.interimAction }        : {}),
      });

      if (agent.approvalMode === "delegated" && decision.decision === "EXECUTE") {
        const approved = validateForExecution(candidate, policy, prices);
        const receipt  = await executeApprovedAction(approved, circle, arc, {
          walletId:           agent.circleWalletId ?? "",
          lotRegistryAddress: process.env["TAXEE_LOT_REGISTRY_ADDRESS"] ?? "",
          chainId:            candidate.lots[0]?.chainId ?? 8453,
          ...(process.env["TAXEE_EXECUTOR_ADDRESS"] ? { executorAddress: process.env["TAXEE_EXECUTOR_ADDRESS"] } : {}),
          ...(process.env["USDC_ADDRESS"]           ? { usdcAddress: process.env["USDC_ADDRESS"] }             : {}),
          ...(process.env["CIRCLE_PAYMASTER_WALLET_ID"] ? { paymasterWalletId: process.env["CIRCLE_PAYMASTER_WALLET_ID"] } : {}),
        });

        await db.insert(opportunities).values({
          agentId,
          type:               candidate.type as any,
          llmDecision:        "EXECUTE" as any,
          llmReasoning:       decision.reasoning,
          estimatedTaxImpact: String(decision.estimatedTaxImpact),
          headline:           explanation.headline,
          body:               explanation.body,
          taxSavingEstimate:  String(explanation.taxSavingEstimate),
          candidateAction:    candidate as any,
          arcRecordId:        receipt.arcRecordId,
          ...(receipt.txHash !== undefined ? { txHash: receipt.txHash } : {}),
          promptVersion:      decision.promptVersion,
          executedAt:         new Date(),
        } as any);

        await sendActionReceipt(
          {
            agentId,
            actionId:        candidate.id,
            type:            candidate.type,
            headline:        explanation.headline,
            taxSavingActual: explanation.taxSavingEstimate,
            arcRecordId:     receipt.arcRecordId ?? "n/a",
            executedAt:      new Date(),
            llmReasoning:    decision.reasoning,
            dashboardUrl:    "",
            ...(receipt.txHash !== undefined ? { txHash: receipt.txHash } : {}),
          },
          channels
        );

        actionsExecuted++;
        opportunitiesSaved++;
      } else {
        const [opp] = await db.insert(opportunities).values({
          agentId,
          type:               candidate.type as any,
          llmDecision:        decision.decision as any,
          llmReasoning:       decision.reasoning,
          estimatedTaxImpact: String(decision.estimatedTaxImpact),
          headline:           explanation.headline,
          body:               explanation.body,
          taxSavingEstimate:  String(explanation.taxSavingEstimate),
          candidateAction:    candidate as any,
          ...(decision.deferDays !== undefined ? { deferDays: decision.deferDays } : {}),
          promptVersion:      decision.promptVersion,
          ...(decision.deferDays
            ? { deferredUntil: new Date(Date.now() + decision.deferDays * 86400000) }
            : {}),
        } as any).returning();

        if (opp && agent.approvalMode === "manual") {
          const lot0       = candidate.lots[0];
          const assetId    = lot0?.assetId ?? candidate.type;
          const price      = prices[assetId] ?? 0;
          const totalQty   = candidate.lots.reduce((s, l) => s + parseFloat(l.quantity), 0);
          const totalCost  = candidate.lots.reduce((s, l) => s + parseFloat(l.costBasisUsd), 0);
          const currentVal = totalQty * price;
          const unrealizedPct = totalCost > 0
            ? ((currentVal - totalCost) / totalCost) * 100
            : 0;
          const avgDaysHeld = candidate.lots.length > 0
            ? Math.round(candidate.lots.reduce((s, l) => s + (l.holdingPeriodDays ?? 0), 0) / candidate.lots.length)
            : 0;

          await sendOpportunityNotification(
            {
              actionId:             opp.id,
              agentId,
              jurisdiction:         userJurisdiction,
              ...(agent.name           ? { walletLabel:   agent.name           } : {}),
              ...(agent.walletAddress  ? { walletAddress: agent.walletAddress  } : {}),
              type:                 candidate.type,
              headline:             explanation.headline,
              explanationBody:      explanation.body,
              taxSavingEstimate:    explanation.taxSavingEstimate,
              llmReasoning:         decision.reasoning,
              approvalMode:         "manual",
              buttons:              ["approve", "defer", "skip"],
              assetSymbol:          assetId,
              quantity:             totalQty,
              costBasisUsd:         totalCost,
              currentValueUsd:      currentVal,
              unrealizedPct,
              daysHeld:             avgDaysHeld,
              ...(candidate.replacementAsset ? { replacementAsset: candidate.replacementAsset } : {}),
              ...(candidate.washSaleDaysRemaining !== undefined ? { washSaleDaysRemaining: candidate.washSaleDaysRemaining } : {}),
              regime:               regime.regime.label,
            },
            channels
          );
        }
        if (opp) opportunitiesSaved++;
      }

      if (sig) activeSigs.add(sig);
    } catch (err) {
      console.error(`[heartbeat] Error processing candidate ${candidate.id}:`, err);
    }
  }

  console.log(
    `[heartbeat] Done for agent ${agentId}: ${allCandidates.length} candidates, ${opportunitiesSaved} saved, ${actionsExecuted} executed`,
  );

  return {
    candidatesFound: allCandidates.length,
    opportunitiesSaved,
    actionsExecuted,
  };
}
