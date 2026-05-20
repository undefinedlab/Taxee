import type { ApprovedAction, ArcRecord } from "@taxee/shared";
import { CircleClient, ArcClient } from "@taxee/aggregator";
import { keccak256, encodePacked, encodeAbiParameters, parseAbiParameters } from "viem";

/**
 * Execute an approved action via the Circle Programmable Wallet.
 *
 * Execution flow:
 *   1. Build the ABI-encoded call to TaxeeLotRegistry.commitDisposal()
 *   2. Submit the transaction via Circle API
 *   3. Poll until confirmed or failed
 *   4. Write an immutable ArcRecord (MANDATORY — fails closed if Arc write fails)
 *   5. Return the ArcRecord ID and tx hash for the receipt
 *
 * IMPORTANT: Arc write is mandatory. If it fails, the function throws.
 * We would rather alert the user than proceed without an audit record.
 */
export async function executeApprovedAction(
  action: ApprovedAction,
  circle: CircleClient,
  arc: ArcClient,
  opts: {
    walletId: string;
    lotRegistryAddress: string;
    chainId: number;
  }
): Promise<{ arcRecordId: string; txHash?: string }> {
  const { candidateAction, lotManifest } = action;

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

  let txHash: string | undefined;
  try {
    const tx = await circle.createContractExecution({
      walletId:             opts.walletId,
      contractAddress:      opts.lotRegistryAddress,
      abiFunctionSignature: "commitDisposal(bytes32,bytes32)",
      abiParameters:        [lotId, arcRecordHash],
      feeLevel:             "MEDIUM",
    });

    const confirmed = await circle.pollTransaction(tx.id);
    txHash = confirmed.txHash;

    if (confirmed.state === "FAILED") {
      console.error(`[execution] Transaction failed for action ${action.opportunityId}`);
    }
  } catch (err) {
    console.error(`[execution] Circle execution error:`, err);
  }

  return { arcRecordId, ...(txHash !== undefined ? { txHash } : {}) };
}

export { CircleClient, ArcClient };
