import { importLotsForWallet, resolveAcquisitionPrice } from "./lotImporter.js";
import type { ImportedLot } from "./lotImporter.js";

export interface LotSyncResult {
  inserted: number;
  closed: number;
  basisRefreshed: number;
  openOnChain: number;
  openInDbBefore: number;
}

type LotRow = {
  id: string;
  txHash: string | null;
  assetId: string;
  chainId: number;
  quantity: string;
  costBasisUsd: string;
  acquiredAt: Date;
  status: string;
};

type LotSyncDb = {
  selectOpenLots: (agentId: string) => Promise<LotRow[]>;
  insertLots: (rows: Array<{
    agentId: string;
    assetId: string;
    chainId: number;
    quantity: string;
    costBasisUsd: string;
    acquiredAt: Date;
    status: "open";
    txHash: string | null;
  }>) => Promise<void>;
  closeLot: (lotId: string) => Promise<void>;
  updateLotBasis: (lotId: string, costBasisUsd: string) => Promise<void>;
};

/**
 * Align DB tax lots with on-chain inbound transfers:
 * - insert new acquisitions
 * - close open lots whose tx is no longer on-chain (sold/transferred out of tracking)
 * - refresh cost basis from acquisition-date prices
 */
export async function syncAgentLotsFromChain(
  agentId: string,
  walletAddress: string,
  alchemyKey: string,
  geckoKey: string | undefined,
  db: LotSyncDb,
): Promise<LotSyncResult> {
  const openBefore = (await db.selectOpenLots(agentId)).filter(
    (l) => l.status === "open" || l.status === "partial",
  );
  const existingHashes = new Set(
    openBefore.map((l) => l.txHash).filter(Boolean) as string[],
  );

  const onChain = await importLotsForWallet(
    walletAddress,
    alchemyKey,
    geckoKey,
    new Set(),
  );
  const onChainByHash = new Map<string, ImportedLot>();
  for (const lot of onChain) {
    if (lot.txHash) onChainByHash.set(lot.txHash, lot);
  }

  let closed = 0;
  for (const row of openBefore) {
    if (row.txHash && !onChainByHash.has(row.txHash)) {
      await db.closeLot(row.id);
      closed++;
    }
  }

  const toInsert = await importLotsForWallet(
    walletAddress,
    alchemyKey,
    geckoKey,
    existingHashes,
  );
  if (toInsert.length > 0) {
    await db.insertLots(
      toInsert.map((l) => ({
        agentId,
        assetId: l.assetId,
        chainId: l.chainId,
        quantity: l.quantity,
        costBasisUsd: l.costBasisUsd,
        acquiredAt: l.acquiredAt,
        status: "open" as const,
        txHash: l.txHash ?? null,
      })),
    );
  }

  let basisRefreshed = 0;
  const stillOpen = await db.selectOpenLots(agentId);
  for (const row of stillOpen) {
    const chainLot = row.txHash ? onChainByHash.get(row.txHash) : undefined;
    const acquiredAt = chainLot?.acquiredAt ?? row.acquiredAt;
    const { price } = await resolveAcquisitionPrice(row.assetId, acquiredAt, geckoKey);
    if (price <= 0) continue;
    const refreshed = (parseFloat(row.quantity) * price).toFixed(4);
    const prev = parseFloat(row.costBasisUsd);
    if (Math.abs(prev - parseFloat(refreshed)) > 0.01) {
      await db.updateLotBasis(row.id, refreshed);
      basisRefreshed++;
    }
  }

  return {
    inserted: toInsert.length,
    closed,
    basisRefreshed,
    openOnChain: onChain.length,
    openInDbBefore: openBefore.length,
  };
}
