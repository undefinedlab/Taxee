import { and, eq, isNull } from "drizzle-orm";
import { db, agents, opportunities, users } from "@taxee/db";
import { CircleClient, ArcClient, fetchPrices } from "@taxee/aggregator";
import { validateForExecution } from "@taxee/compliance";
import type { CandidateAction, UserPolicy, WalletConnectionType } from "@taxee/shared";
import axios from "axios";
import { executeApprovedAction, type ExecutionStep } from "./index.js";
import { getChainConfig, resolveExecutionChainId } from "./chainConfig.js";
import { executeApprovedActionEip7702 } from "./eip7702Executor.js";

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

  const [owner] = await db.select().from(users).where(eq(users.id, agent.userId));
  const jurisdiction = (owner?.jurisdiction === "UK" ? "UK" : "US") as "US" | "UK";

  const candidate = claimed.candidateAction as unknown as CandidateAction;
  const policy: UserPolicy = {
    ...DEFAULT_POLICY,
    ...(agent.policy as Partial<UserPolicy>),
    jurisdiction,
  };

  const connType: WalletConnectionType =
    policy.walletConnectionType ??
    (agent.circleWalletId ? "circle" : "external_eip7702");

  // Per-agent execution chain override (Base Sepolia or Sepolia). Falls back
  // to env default if not set or unsupported.
  const agentPolicyChainId = (agent.policy as { executionChainId?: number } | null)?.executionChainId;
  const execChainId        = resolveExecutionChainId(agentPolicyChainId);
  const execChainCfg       = getChainConfig(execChainId);

  const assetIds = [...new Set(candidate.lots.map((l) => l.assetId))];
  const prices   = await fetchPrices(assetIds, process.env["COINGECKO_API_KEY"]);

  let approved;
  try {
    approved = validateForExecution(candidate, policy, prices);
  } catch (err) {
    return finishFailure(undefined, `Guardrail blocked: ${err instanceof Error ? err.message : String(err)}`, {});
  }

  // ── MetaMask / EIP-7702: TaxeeManager execution (no Circle MPC) ─────────────
  if (connType === "external_eip7702") {
    let wallet = agent.walletAddress;
    if (agent.circleWalletId) {
      const siblings = await db
        .select()
        .from(agents)
        .where(eq(agents.userId, agent.userId));
      const metaMaskAgent = siblings.find((a) => {
        const p = a.policy as { walletConnectionType?: string } | null;
        return p?.walletConnectionType === "external_eip7702" && !a.circleWalletId && a.walletAddress;
      });
      if (metaMaskAgent?.walletAddress) {
        wallet = metaMaskAgent.walletAddress;
      }
    }
    if (!wallet) {
      return finishFailure(undefined, "Agent has no wallet address", {});
    }

    try {
      const eipReceipt = await executeApprovedActionEip7702(approved, wallet, execChainId);
      await db
        .update(opportunities)
        .set({
          executedAt:      new Date(),
          executionStatus: "succeeded",
          txHash:          eipReceipt.txHash,
        })
        .where(eq(opportunities.id, opportunityId));

      await sendTelegramReceipt(claimed.agentId, opportunityId, {
        ok:     true,
        txHash: eipReceipt.txHash,
        executionChainName: execChainCfg.name,
        explorerTxUrl:      execChainCfg.explorerTxUrl,
      });

      console.log(
        `[executeOpportunity] ${opportunityId} EIP-7702 succeeded — tx ${eipReceipt.txHash}`,
      );

      return {
        success:      true,
        arcRecordId:  undefined,
        txHash:       eipReceipt.txHash,
        parkTxHash:   undefined,
        bridgeTxHash: undefined,
        failedStep:   undefined,
        error:        undefined,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return finishFailure(undefined, msg, {});
    }
  }

  if (!agent.circleWalletId) {
    return finishFailure(
      undefined,
      connType === "watch"
        ? "Watch-only wallet — approve records intent only; sign swaps in your wallet"
        : "Agent has no Circle wallet and is not configured for EIP-7702 execution",
      {},
    );
  }

  const circle = new CircleClient(
    process.env["CIRCLE_API_KEY"] ?? "",
    (process.env["CIRCLE_ENVIRONMENT"] ?? "sandbox") as "sandbox" | "production",
    process.env["CIRCLE_ENTITY_SECRET"],
  );

  const arc = new ArcClient(
    process.env["ARC_API_KEY"] ?? "",
    process.env["ARC_API_URL"] ??
      process.env["ARC_BASE_URL"] ??
      "https://api.circle.com/arc/v1",
  );

  // candidate.lots[0].chainId is the *source* chain of the lot being disposed.
  // Execution chain uses the per-agent override (execChainId / execChainCfg
  // already resolved above) so the user can pick which testnet to commit on.
  const sourceChainId  = candidate.lots[0]?.chainId ?? execChainId;
  const executionChain = execChainCfg;

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
    explorerTxUrl:      executionChain.explorerTxUrl,
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
  explorerTxUrl?:      string | undefined;
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

  // Use the per-chain explorer URL from chainConfig so testnet txs land on the
  // correct explorer (sepolia.basescan.org, sepolia.etherscan.io, Arc explorer,
  // etc.) instead of always pointing at mainnet which would show "tx not found".
  const explorerBase = payload.explorerTxUrl ?? "https://basescan.org/tx/";

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
