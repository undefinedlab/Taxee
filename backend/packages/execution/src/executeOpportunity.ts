import { eq } from "drizzle-orm";
import { db, agents, lots, opportunities } from "@taxee/db";
import { CircleClient, ArcClient, fetchPrices } from "@taxee/aggregator";
import { validateForExecution } from "@taxee/compliance";
import type { CandidateAction, UserPolicy } from "@taxee/shared";
import { executeApprovedAction } from "./index.js";

const DEFAULT_POLICY: UserPolicy = {
  primaryObjective:        "minimize_tax",
  harvestThresholdPct:     -8,
  maturationBufferDays:    30,
  rebalanceAggressiveness: "moderate",
  allowedActions:          ["HARVEST", "PARK", "REBALANCE"],
  jurisdiction:            "US",
};

/**
 * Execute a previously approved opportunity end-to-end.
 *
 * Called after the user approves an opportunity via Telegram or web UI.
 * Reads candidateAction from the opportunity row (stored at heartbeat time),
 * fetches current prices, validates, and calls executeApprovedAction.
 *
 * Safe to call fire-and-forget — updates DB on completion.
 */
export async function executeOpportunity(opportunityId: string): Promise<{
  success:      boolean;
  arcRecordId:  string | undefined;
  txHash:       string | undefined;
  parkTxHash:   string | undefined;
  error:        string | undefined;
}> {
  const [opp] = await db
    .select()
    .from(opportunities)
    .where(eq(opportunities.id, opportunityId));

  if (!opp) {
    return { success: false, arcRecordId: undefined, txHash: undefined, parkTxHash: undefined, error: "Opportunity not found" };
  }

  if (!opp.candidateAction) {
    return { success: false, arcRecordId: undefined, txHash: undefined, parkTxHash: undefined, error: "No candidateAction stored — heartbeat predates this feature" };
  }

  if (opp.executedAt) {
    return { success: false, arcRecordId: undefined, txHash: undefined, parkTxHash: undefined, error: "Already executed" };
  }

  const [agent] = await db
    .select()
    .from(agents)
    .where(eq(agents.id, opp.agentId));

  if (!agent) {
    return { success: false, arcRecordId: undefined, txHash: undefined, parkTxHash: undefined, error: "Agent not found" };
  }

  if (!agent.circleWalletId) {
    return { success: false, arcRecordId: undefined, txHash: undefined, parkTxHash: undefined, error: "Agent has no Circle wallet — execution unavailable" };
  }

  const candidate = opp.candidateAction as unknown as CandidateAction;
  const policy: UserPolicy = { ...DEFAULT_POLICY, ...(agent.policy as Partial<UserPolicy>) };

  const assetIds = [...new Set(candidate.lots.map((l) => l.assetId))];
  const prices   = await fetchPrices(assetIds, process.env["COINGECKO_API_KEY"]);

  let approved;
  try {
    approved = validateForExecution(candidate, policy, prices);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[executeOpportunity] Guardrail blocked ${opportunityId}: ${msg}`);
    return { success: false, arcRecordId: undefined, txHash: undefined, parkTxHash: undefined, error: `Guardrail: ${msg}` };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const circle = new (CircleClient as any)(
    process.env["CIRCLE_API_KEY"] ?? "",
    (process.env["CIRCLE_ENVIRONMENT"] ?? "sandbox") as "sandbox" | "production",
    process.env["CIRCLE_ENTITY_SECRET"]
  ) as CircleClient;

  const arc = new ArcClient(
    process.env["ARC_API_KEY"] ?? "",
    process.env["ARC_API_URL"] ?? "https://api.circle.com/arc/v1"
  );

  const receipt = await executeApprovedAction(approved, circle, arc, {
    walletId:           agent.circleWalletId,
    lotRegistryAddress: process.env["TAXEE_LOT_REGISTRY_ADDRESS"] ?? "",
    chainId:            candidate.lots[0]?.chainId ?? 8453,
    ...(process.env["TAXEE_EXECUTOR_ADDRESS"]
      ? { executorAddress: process.env["TAXEE_EXECUTOR_ADDRESS"] }
      : {}),
    ...(process.env["USDC_ADDRESS"]
      ? { usdcAddress: process.env["USDC_ADDRESS"] }
      : {}),
    ...(process.env["CIRCLE_PAYMASTER_WALLET_ID"]
      ? { paymasterWalletId: process.env["CIRCLE_PAYMASTER_WALLET_ID"] }
      : {}),
  });

  await db
    .update(opportunities)
    .set({
      executedAt:  new Date(),
      arcRecordId: receipt.arcRecordId,
      ...(receipt.txHash    !== undefined ? { txHash:     receipt.txHash    } : {}),
    })
    .where(eq(opportunities.id, opportunityId));

  console.log(`[executeOpportunity] Executed ${opportunityId}: arc=${receipt.arcRecordId} tx=${receipt.txHash}`);

  return {
    success:      true,
    arcRecordId:  receipt.arcRecordId,
    txHash:       receipt.txHash,
    parkTxHash:   receipt.parkTxHash,
    error:        undefined,
  };
}
