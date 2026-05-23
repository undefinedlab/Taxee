import { and, eq, isNull } from "drizzle-orm";
import { db, agents, opportunities, users } from "@taxee/db";
import { CircleClient, ArcClient, fetchPrices } from "@taxee/aggregator";
import { validateForExecution } from "@taxee/compliance";
import type { CandidateAction, UserPolicy } from "@taxee/shared";
import axios from "axios";
import { executeApprovedAction, type ExecutionStep } from "./index.js";
import { getChainConfig, getExecutionChainId } from "./chainConfig.js";

const DEFAULT_POLICY: UserPolicy = {
  primaryObjective:        "minimize_tax",
  harvestThresholdPct:     -8,
  maturationBufferDays:    30,
  rebalanceAggressiveness: "moderate",
  allowedActions:          ["HARVEST", "PARK", "REBALANCE"],
  jurisdiction:            "US",
};

export interface ExecuteOpportunityResult {
  success:      boolean;
  arcRecordId:  string | undefined;
  txHash:       string | undefined;
  parkTxHash:   string | undefined;
  bridgeTxHash: string | undefined;
  failedStep:   ExecutionStep | undefined;
  error:        string | undefined;
}

/**
 * Execute an approved opportunity end-to-end.
 *
 * Guarantees:
 *   - Idempotent on DB writes: only marks executedAt if it's still null
 *   - Persists granular state: executionStatus, executionError, failedAt, txHashes
 *   - Sends a Telegram follow-up if the agent has a chatId configured
 *   - Safe to fire-and-forget — never throws to the caller
 */
export async function executeOpportunity(opportunityId: string): Promise<ExecuteOpportunityResult> {
  // ── Idempotency: claim the opportunity by flipping executionStatus to "executing" only when still null ──
  const [claimed] = await db
    .update(opportunities)
    .set({ executionStatus: "executing" })
    .where(
      and(
        eq(opportunities.id, opportunityId),
        isNull(opportunities.executedAt),
        isNull(opportunities.failedAt),
      ),
    )
    .returning();

  if (!claimed) {
    return {
      success:      false,
      arcRecordId:  undefined,
      txHash:       undefined,
      parkTxHash:   undefined,
      bridgeTxHash: undefined,
      failedStep:   undefined,
      error:        "Already executed, failed, or claimed by another worker",
    };
  }

  const finishFailure = async (failedStep: ExecutionStep | undefined, error: string, partial: Partial<ExecuteOpportunityResult>): Promise<ExecuteOpportunityResult> => {
    await db
      .update(opportunities)
      .set({
        executionStatus: "failed",
        executionError:  error,
        failedAt:        new Date(),
        ...(partial.arcRecordId  ? { arcRecordId:  partial.arcRecordId  } : {}),
        ...(partial.txHash       ? { txHash:       partial.txHash       } : {}),
        ...(partial.parkTxHash   ? { parkTxHash:   partial.parkTxHash   } : {}),
        ...(partial.bridgeTxHash ? { bridgeTxHash: partial.bridgeTxHash } : {}),
      })
      .where(eq(opportunities.id, opportunityId));
    await sendTelegramReceipt(claimed.agentId, opportunityId, { ok: false, error, ...partial });
    console.error(`[executeOpportunity] ${opportunityId} failed at step ${failedStep ?? "?"}: ${error}`);
    return {
      success:      false,
      arcRecordId:  partial.arcRecordId,
      txHash:       partial.txHash,
      parkTxHash:   partial.parkTxHash,
      bridgeTxHash: partial.bridgeTxHash,
      failedStep,
      error,
    };
  };

  if (!claimed.candidateAction) {
    return finishFailure(undefined, "No candidateAction stored — opportunity predates this feature", {});
  }

  const [agent] = await db.select().from(agents).where(eq(agents.id, claimed.agentId));
  if (!agent) {
    return finishFailure(undefined, "Agent not found", {});
  }
  if (!agent.circleWalletId) {
    return finishFailure(undefined, "Agent has no Circle wallet — provisioning may have failed at agent setup", {});
  }

  const [owner] = await db.select().from(users).where(eq(users.id, agent.userId));
  const jurisdiction = (owner?.jurisdiction === "UK" ? "UK" : "US") as "US" | "UK";

  const candidate = claimed.candidateAction as unknown as CandidateAction;
  const policy: UserPolicy = {
    ...DEFAULT_POLICY,
    ...(agent.policy as Partial<UserPolicy>),
    jurisdiction,
  };

  const assetIds = [...new Set(candidate.lots.map((l) => l.assetId))];
  const prices   = await fetchPrices(assetIds, process.env["COINGECKO_API_KEY"]);

  let approved;
  try {
    approved = validateForExecution(candidate, policy, prices);
  } catch (err) {
    return finishFailure(undefined, `Guardrail blocked: ${err instanceof Error ? err.message : String(err)}`, {});
  }

  const circle = new CircleClient(
    process.env["CIRCLE_API_KEY"] ?? "",
    (process.env["CIRCLE_ENVIRONMENT"] ?? "sandbox") as "sandbox" | "production",
    process.env["CIRCLE_ENTITY_SECRET"],
  );

  const arc = new ArcClient(
    process.env["ARC_API_KEY"] ?? "",
    process.env["ARC_API_URL"] ?? "https://api.circle.com/arc/v1",
  );

  // The execution chain (where commitDisposal + parkInUsyc live) is fixed by env;
  // candidate.lots[0].chainId is the *source* chain of the lot being disposed.
  const sourceChainId    = candidate.lots[0]?.chainId ?? getExecutionChainId();
  const executionChain   = getChainConfig(getExecutionChainId());

  const receipt = await executeApprovedAction(approved, circle, arc, {
    walletId:           agent.circleWalletId,
    lotRegistryAddress: process.env["TAXEE_LOT_REGISTRY_ADDRESS"] ?? "",
    chainId:            sourceChainId,
    ...(process.env["TAXEE_EXECUTOR_ADDRESS"]
      ? { executorAddress: process.env["TAXEE_EXECUTOR_ADDRESS"] }
      : {}),
    ...(process.env["CIRCLE_PAYMASTER_WALLET_ID"]
      ? { paymasterWalletId: process.env["CIRCLE_PAYMASTER_WALLET_ID"] }
      : {}),
    onStep: async (step, status, info) => {
      console.log(`[executeOpportunity] ${opportunityId} step=${step} status=${status}${info?.txHash ? ` tx=${info.txHash}` : ""}${info?.error ? ` err=${info.error}` : ""}`);
    },
  });

  if (receipt.status === "failed") {
    return finishFailure(receipt.failedStep, receipt.error ?? "Unknown error", {
      arcRecordId:  receipt.arcRecordId,
      txHash:       receipt.txHash,
      parkTxHash:   receipt.parkTxHash,
      bridgeTxHash: receipt.bridgeTxHash,
    });
  }

  await db
    .update(opportunities)
    .set({
      executedAt:      new Date(),
      executionStatus: "succeeded",
      ...(receipt.arcRecordId  ? { arcRecordId:  receipt.arcRecordId  } : {}),
      ...(receipt.txHash       ? { txHash:       receipt.txHash       } : {}),
      ...(receipt.parkTxHash   ? { parkTxHash:   receipt.parkTxHash   } : {}),
      ...(receipt.bridgeTxHash ? { bridgeTxHash: receipt.bridgeTxHash } : {}),
    })
    .where(eq(opportunities.id, opportunityId));

  await sendTelegramReceipt(claimed.agentId, opportunityId, {
    ok:           true,
    txHash:       receipt.txHash,
    parkTxHash:   receipt.parkTxHash,
    bridgeTxHash: receipt.bridgeTxHash,
    arcRecordId:  receipt.arcRecordId,
    executionChainName: executionChain.name,
  });

  console.log(`[executeOpportunity] ${opportunityId} succeeded — tx ${receipt.txHash ?? "?"} park ${receipt.parkTxHash ?? "—"}`);

  return {
    success:      true,
    arcRecordId:  receipt.arcRecordId,
    txHash:       receipt.txHash,
    parkTxHash:   receipt.parkTxHash,
    bridgeTxHash: receipt.bridgeTxHash,
    failedStep:   undefined,
    error:        undefined,
  };
}

interface ReceiptPayload {
  ok:                  boolean;
  error?:              string | undefined;
  txHash?:             string | undefined;
  parkTxHash?:         string | undefined;
  bridgeTxHash?:       string | undefined;
  arcRecordId?:        string | undefined;
  executionChainName?: string | undefined;
  success?:            boolean;
  failedStep?:         ExecutionStep | undefined;
}

async function sendTelegramReceipt(
  agentId:       string,
  opportunityId: string,
  payload:       ReceiptPayload,
): Promise<void> {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) return;

  const [agent] = await db.select().from(agents).where(eq(agents.id, agentId));
  const chatId  = (agent?.policy as { telegramChatId?: string } | null)?.telegramChatId;
  if (!chatId) return;

  const explorerBase = payload.executionChainName?.toLowerCase().includes("base")
    ? "https://basescan.org/tx/"
    : "https://etherscan.io/tx/";

  const lines: string[] = [];
  if (payload.ok) {
    lines.push(`🟢 *Executed* — opportunity \`${opportunityId.slice(0, 8)}\``);
    if (payload.arcRecordId)  lines.push(`📝 Arc record: \`${payload.arcRecordId}\``);
    if (payload.bridgeTxHash) lines.push(`🌉 Bridge: [${payload.bridgeTxHash.slice(0, 10)}…](${explorerBase}${payload.bridgeTxHash})`);
    if (payload.txHash)       lines.push(`✍️ Commit: [${payload.txHash.slice(0, 10)}…](${explorerBase}${payload.txHash})`);
    if (payload.parkTxHash)   lines.push(`🏦 Park:   [${payload.parkTxHash.slice(0, 10)}…](${explorerBase}${payload.parkTxHash})`);
  } else {
    lines.push(`❌ *Execution failed* — opportunity \`${opportunityId.slice(0, 8)}\``);
    lines.push(`Reason: ${payload.error}`);
    if (payload.arcRecordId)  lines.push(`_(Arc record \`${payload.arcRecordId}\` was created before the failure.)_`);
    if (payload.txHash)       lines.push(`_(On-chain commitDisposal tx: [${payload.txHash.slice(0, 10)}…](${explorerBase}${payload.txHash}).)_`);
  }

  try {
    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id:    chatId,
      text:       lines.join("\n"),
      parse_mode: "Markdown",
      disable_web_page_preview: true,
    });
  } catch (err) {
    console.error(`[executeOpportunity] Failed to send Telegram receipt:`, err);
  }
}
