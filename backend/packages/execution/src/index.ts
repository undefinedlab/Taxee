import type { ApprovedAction, ArcRecord } from "@taxee/shared";
import { CircleClient, ArcClient } from "@taxee/aggregator";
import { keccak256, encodePacked, encodeAbiParameters, parseAbiParameters } from "viem";

export type { CctpBridgeParams, CctpBridgeResult } from "./cctp.js";
export { bridgeUsdcViaCctp, CCTP_DOMAIN } from "./cctp.js";

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
export async function executeApprovedAction(
  action: ApprovedAction,
  circle: CircleClient,
  arc: ArcClient,
  opts: {
    walletId: string;
    lotRegistryAddress: string;
    chainId: number;
    executorAddress?: string;    // TaxeeExecutor — required for USYC park step
    usdcAddress?: string;        // USDC token address on the execution chain
    paymasterWalletId?: string;  // Circle Paymaster wallet for USDC gas abstraction
  }
): Promise<{ arcRecordId: string; txHash: string | undefined; parkTxHash: string | undefined }> {
  const { candidateAction, lotManifest } = action;

  // ── Step 1: Arc write (mandatory — throws if it fails) ─────────────────────
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

  const arcRecordId = await arc.writeDisposalRecord(arcRecordInput);

  // ── Step 2: Build lot commitment hashes ───────────────────────────────────
  const lotId = keccak256(
    encodePacked(["string", "string"], [action.agentId, lotManifest.lots[0]?.id ?? ""])
  );

  const arcRecordHash = keccak256(
    encodeAbiParameters(
      parseAbiParameters("string, string, uint256, uint256, int256"),
      [
        arcRecordId,
        arcRecordInput.dateSold,
        BigInt(Math.round(arcRecordInput.proceeds * 1e6)),
        BigInt(Math.round(arcRecordInput.costBasis * 1e6)),
        BigInt(Math.round(arcRecordInput.gainLoss * 1e6)),
      ]
    )
  );

  // ── Step 3: TaxeeLotRegistry.commitDisposal() ─────────────────────────────
  let txHash: string | undefined;
  try {
    const tx = await (circle as any).createDeveloperContractExecution({
      idempotencyKey:       `commit-${action.opportunityId}`,
      walletId:             opts.walletId,
      contractAddress:      opts.lotRegistryAddress,
      abiFunctionSignature: "commitDisposal(bytes32,bytes32)",
      abiParameters:        [lotId, arcRecordHash],
      ...(opts.paymasterWalletId !== undefined
        ? { paymasterWalletId: opts.paymasterWalletId }
        : { feeLevel: "MEDIUM" as const }),
    });

    const confirmed = await circle.pollTransaction(tx.id);
    txHash = confirmed.txHash;

    if (confirmed.state === "FAILED") {
      console.error(`[execution] commitDisposal failed for action ${action.opportunityId}`);
    }
  } catch (err) {
    console.error("[execution] Circle commitDisposal error:", err);
  }

  // ── Step 4: TaxeeExecutor.parkInUsyc() for HARVEST actions ────────────────
  let parkTxHash: string | undefined;
  if (
    candidateAction.type === "HARVEST" &&
    opts.executorAddress &&
    opts.usdcAddress &&
    txHash
  ) {
    try {
      const usdcAtomicAmount = String(Math.round(lotManifest.estimatedProceedsUsd * 1e6));
      const parkTx = await (circle as any).createDeveloperContractExecution({
        idempotencyKey:       `park-${action.opportunityId}`,
        walletId:             opts.walletId,
        contractAddress:      opts.executorAddress,
        abiFunctionSignature: "parkInUsyc(uint256,bytes32,address)",
        abiParameters:        [usdcAtomicAmount, lotId, action.agentId],
        ...(opts.paymasterWalletId !== undefined
          ? { paymasterWalletId: opts.paymasterWalletId }
          : { feeLevel: "MEDIUM" as const }),
      });

      const parkConfirmed = await circle.pollTransaction(parkTx.id);
      parkTxHash = parkConfirmed.txHash;

      if (parkConfirmed.state === "FAILED") {
        console.error(`[execution] parkInUsyc failed for action ${action.opportunityId}`);
      } else {
        console.log(`[execution] USYC park confirmed: ${parkTxHash}`);
      }
    } catch (err) {
      console.error("[execution] USYC park error (non-fatal, disposal already committed):", err);
    }
  }

  return { arcRecordId, txHash, parkTxHash };
}

export { CircleClient, ArcClient };
export { executeOpportunity } from "./executeOpportunity.js";
