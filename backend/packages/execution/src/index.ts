import type { ApprovedAction, ArcRecord } from "@taxee/shared";
import { CircleClient, ArcClient } from "@taxee/aggregator";
import { keccak256, encodePacked, encodeAbiParameters, parseAbiParameters } from "viem";
import { bridgeUsdcViaCctp } from "./cctp.js";
import { getChainConfig, getExecutionChainId } from "./chainConfig.js";

export type { CctpBridgeParams, CctpBridgeResult } from "./cctp.js";
export { bridgeUsdcViaCctp, CCTP_DOMAIN } from "./cctp.js";
export type { ChainConfig } from "./chainConfig.js";
export { getChainConfig, isSupportedChain, getExecutionChainId } from "./chainConfig.js";

/**
 * Execute an approved action via Circle Programmable Wallets.
 *
 * Execution flow:
 *   1. Write an immutable ArcRecord (MANDATORY — fails closed if Arc write fails)
 *   2. Call TaxeeLotRegistry.commitDisposal() via Circle developer wallet
 *   3. Poll until confirmed
 *   4. If action type is HARVEST and TaxeeExecutor is configured:
 *        call TaxeeExecutor.parkInUsyc() to park proceeds in USYC yield
 *   5. Return arcRecordId + txHash + optional parkTxHash
 *
 * All on-chain calls use `createDeveloperContractExecution` which requires
 * CIRCLE_ENTITY_SECRET. Pass `paymasterWalletId` to sponsor gas in USDC.
 */
export type ExecutionStep =
  | "arc_write"
  | "cctp_bridge"
  | "commit_disposal"
  | "park_in_usyc";

export interface ExecutionReceipt {
  arcRecordId:  string | undefined;
  bridgeTxHash: string | undefined;
  txHash:       string | undefined;
  parkTxHash:   string | undefined;
  status:       "succeeded" | "failed";
  failedStep?:  ExecutionStep;
  error?:       string;
}

export interface ExecutionOpts {
  walletId:               string;          // Circle wallet on the execution chain (Base by default)
  sourceWalletId?:        string;          // Circle wallet on the source chain — defaults to walletId
  lotRegistryAddress:     string;
  chainId:                number;          // source chain of the lot
  executorAddress?:       string;          // TaxeeExecutor — required for USYC park step
  paymasterWalletId?:     string;          // Circle Paymaster wallet for USDC-denominated gas
  onStep?: (step: ExecutionStep, status: "starting" | "succeeded" | "failed", info?: { txHash?: string; error?: string }) => Promise<void> | void;
}

export async function executeApprovedAction(
  action: ApprovedAction,
  circle: CircleClient,
  arc: ArcClient,
  opts: ExecutionOpts,
): Promise<ExecutionReceipt> {
  const { candidateAction, lotManifest } = action;
  const sourceChain      = getChainConfig(opts.chainId);
  const executionChainId = getExecutionChainId();
  const execChain        = getChainConfig(executionChainId);
  const needsBridge      = sourceChain.chainId !== execChain.chainId;
  const sourceWalletId   = opts.sourceWalletId ?? opts.walletId;

  const feeOption = opts.paymasterWalletId !== undefined
    ? { paymasterWalletId: opts.paymasterWalletId }
    : { feeLevel: "MEDIUM" as const };

  const reportStep = async (
    step: ExecutionStep,
    status: "starting" | "succeeded" | "failed",
    info?: { txHash?: string; error?: string },
  ) => {
    if (opts.onStep) await opts.onStep(step, status, info);
  };

  const fail = async (step: ExecutionStep, error: string, partial: Partial<ExecutionReceipt>): Promise<ExecutionReceipt> => {
    await reportStep(step, "failed", { error });
    return {
      arcRecordId:  partial.arcRecordId,
      bridgeTxHash: partial.bridgeTxHash,
      txHash:       partial.txHash,
      parkTxHash:   undefined,
      status:       "failed",
      failedStep:   step,
      error,
    };
  };

  // ── Step 1: Arc disposal record (mandatory) ───────────────────────────────
  await reportStep("arc_write", "starting");
  let arcRecordId: string;
  try {
    const arcRecordInput: Omit<ArcRecord, "id" | "createdAt"> = {
      agentId:     action.agentId,
      lotId:       lotManifest.lots[0]?.id ?? "unknown",
      description: `${candidateAction.type} via taxee agent`,
      dateAcquired: lotManifest.lots[0]?.acquiredAt
        ? new Date(lotManifest.lots[0].acquiredAt).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10),
      dateSold:    new Date().toISOString().slice(0, 10),
      proceeds:    lotManifest.estimatedProceedsUsd,
      costBasis:   lotManifest.totalCostBasisUsd,
      gainLoss:    lotManifest.estimatedGainLossUsd,
      term:        (lotManifest.lots[0]?.holdingPeriodDays ?? 0) >= 365 ? "long" : "short",
      txHash:      "pending",
      chainId:     opts.chainId,
    };
    arcRecordId = await arc.writeDisposalRecord(arcRecordInput);
    await reportStep("arc_write", "succeeded");
  } catch (err) {
    return fail("arc_write", err instanceof Error ? err.message : String(err), {});
  }

  // ── Step 2 (HARVEST only): CCTP bridge if source chain ≠ execution chain ──
  let bridgeTxHash: string | undefined;
  if (candidateAction.type === "HARVEST" && needsBridge) {
    if (!sourceChain.cctpTokenMessenger || !execChain.cctpMessageTransmitter) {
      return fail(
        "cctp_bridge",
        `CCTP not configured for ${sourceChain.name} → ${execChain.name}`,
        { arcRecordId },
      );
    }
    const sourceRpcUrl = process.env[sourceChain.rpcEnvVar];
    if (!sourceRpcUrl) {
      return fail(
        "cctp_bridge",
        `${sourceChain.rpcEnvVar} not set — required to read CCTP MessageSent event`,
        { arcRecordId },
      );
    }
    await reportStep("cctp_bridge", "starting");
    try {
      const usdcAtomicAmount = String(Math.round(lotManifest.estimatedProceedsUsd * 1e6));
      const destinationWallet = await circle.getWallet(opts.walletId);
      const bridgeResult = await bridgeUsdcViaCctp({
        circle,
        sourceWalletId,
        destinationWalletId:        opts.walletId,
        tokenMessengerAddress:      sourceChain.cctpTokenMessenger,
        messageTransmitterAddress:  execChain.cctpMessageTransmitter,
        usdcSourceAddress:          sourceChain.usdcAddress,
        amountUsdc:                 usdcAtomicAmount,
        sourceChainId:              sourceChain.chainId,
        destinationChainId:         execChain.chainId,
        destinationRecipient:       destinationWallet.address,
        sourceRpcUrl,
        ...(opts.paymasterWalletId ? { paymasterWalletId: opts.paymasterWalletId } : {}),
      });
      bridgeTxHash = bridgeResult.receiveTxHash ?? bridgeResult.burnTxHash;
      await reportStep("cctp_bridge", "succeeded", { ...(bridgeTxHash ? { txHash: bridgeTxHash } : {}) });
    } catch (err) {
      return fail(
        "cctp_bridge",
        err instanceof Error ? err.message : String(err),
        { arcRecordId },
      );
    }
  }

  // ── Step 3: TaxeeLotRegistry.commitDisposal() ─────────────────────────────
  const lotId = keccak256(
    encodePacked(["string", "string"], [action.agentId, lotManifest.lots[0]?.id ?? ""]),
  );
  const dateSold = new Date().toISOString().slice(0, 10);
  const arcRecordHash = keccak256(
    encodeAbiParameters(
      parseAbiParameters("string, string, uint256, uint256, int256"),
      [
        arcRecordId,
        dateSold,
        BigInt(Math.round(lotManifest.estimatedProceedsUsd * 1e6)),
        BigInt(Math.round(lotManifest.totalCostBasisUsd * 1e6)),
        BigInt(Math.round(lotManifest.estimatedGainLossUsd * 1e6)),
      ],
    ),
  );

  await reportStep("commit_disposal", "starting");
  let txHash: string | undefined;
  try {
    const tx = await (circle as any).createDeveloperContractExecution({
      idempotencyKey:       `commit-${action.opportunityId}`,
      walletId:             opts.walletId,
      contractAddress:      opts.lotRegistryAddress,
      abiFunctionSignature: "commitDisposal(bytes32,bytes32)",
      abiParameters:        [lotId, arcRecordHash],
      ...feeOption,
    });
    const confirmed = await circle.pollTransaction(tx.id);
    txHash = confirmed.txHash;
    if (confirmed.state === "FAILED") {
      return fail(
        "commit_disposal",
        `commitDisposal on-chain status FAILED (tx ${txHash ?? "unknown"})`,
        { arcRecordId, bridgeTxHash, txHash },
      );
    }
    await reportStep("commit_disposal", "succeeded", { ...(txHash ? { txHash } : {}) });
  } catch (err) {
    return fail(
      "commit_disposal",
      err instanceof Error ? err.message : String(err),
      { arcRecordId, bridgeTxHash },
    );
  }

  // ── Step 4: TaxeeExecutor.parkInUsyc() for HARVEST ────────────────────────
  let parkTxHash: string | undefined;
  if (candidateAction.type === "HARVEST" && opts.executorAddress) {
    await reportStep("park_in_usyc", "starting");
    try {
      const usdcAtomicAmount = String(Math.round(lotManifest.estimatedProceedsUsd * 1e6));

      // Pre-check: parkInUsyc moves USDC from the Circle wallet into USYC. If the
      // wallet has no USDC (e.g. swap step hasn't run, or bridge in flight), the
      // contract call will revert. Surface this as a clear error rather than an
      // opaque on-chain failure.
      const balances = await circle.getBalances(opts.walletId);
      const usdcBal  = balances.find((b) => b.token.symbol === "USDC");
      const hasUsdc  = usdcBal && BigInt(usdcBal.amount.replace(".", "").padEnd(7, "0")) > 0n;
      if (!hasUsdc) {
        return fail(
          "park_in_usyc",
          `Circle wallet ${opts.walletId} has no USDC on ${execChain.name}. Asset→USDC swap step not yet integrated — disposal committed (tx ${txHash ?? "?"}) but proceeds not parked.`,
          { arcRecordId, bridgeTxHash, txHash },
        );
      }

      const parkTx = await (circle as any).createDeveloperContractExecution({
        idempotencyKey:       `park-${action.opportunityId}`,
        walletId:             opts.walletId,
        contractAddress:      opts.executorAddress,
        abiFunctionSignature: "parkInUsyc(uint256,bytes32,address)",
        abiParameters:        [usdcAtomicAmount, lotId, action.agentId],
        ...feeOption,
      });
      const parkConfirmed = await circle.pollTransaction(parkTx.id);
      parkTxHash = parkConfirmed.txHash;
      if (parkConfirmed.state === "FAILED") {
        return fail(
          "park_in_usyc",
          `parkInUsyc on-chain status FAILED (tx ${parkTxHash ?? "unknown"})`,
          { arcRecordId, bridgeTxHash, txHash, parkTxHash },
        );
      }
      await reportStep("park_in_usyc", "succeeded", { ...(parkTxHash ? { txHash: parkTxHash } : {}) });
    } catch (err) {
      return fail(
        "park_in_usyc",
        err instanceof Error ? err.message : String(err),
        { arcRecordId, bridgeTxHash, txHash },
      );
    }
  }

  return {
    arcRecordId,
    bridgeTxHash,
    txHash,
    parkTxHash,
    status: "succeeded",
  };
}

export { CircleClient, ArcClient };
export { executeOpportunity } from "./executeOpportunity.js";
export { executeApprovedActionEip7702, checkActiveDelegation } from "./eip7702Executor.js";
export { buildWatchTxPlan, formatWatchTxPlanTelegram } from "./watchTxPlan.js";
