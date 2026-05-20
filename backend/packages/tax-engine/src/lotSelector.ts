import type { Lot, LotManifest } from "@taxee/shared";

export type LotSelectionMethod = "HIFO" | "FIFO" | "SPECIFIC_ID";

/**
 * Select lots to dispose of using HIFO (Highest-In, First-Out) by default.
 *
 * HIFO selects lots with the highest cost basis first, minimizing realized gains
 * (or maximizing realized losses) on disposal. IRS-compliant when combined with
 * specific identification at execution.
 *
 * @param lots              Open lots for a given asset (status = "open" | "partial")
 * @param quantityToDispose Target quantity to dispose (as a float for simplicity in MVP)
 * @param method            Lot selection method
 * @param currentPriceUsd   Current USD price per unit (for proceeds estimation)
 */
export function selectLots(
  lots: Lot[],
  quantityToDispose: number,
  currentPriceUsd: number,
  method: LotSelectionMethod = "HIFO"
): LotManifest {
  const availableLots = lots.filter((l) => l.status === "open" || l.status === "partial");

  if (availableLots.length === 0) {
    throw new Error("No available lots to dispose");
  }

  const sorted = sortLots(availableLots, method);

  const selectedLots: Lot[] = [];
  let remainingQty = quantityToDispose;
  let totalCostBasis = 0;

  for (const lot of sorted) {
    if (remainingQty <= 0) break;

    const lotQty = parseFloat(lot.quantity);
    const lotCostBasis = parseFloat(lot.costBasisUsd);
    const lotCostPerUnit = lotCostBasis / lotQty;

    if (lotQty <= remainingQty) {
      selectedLots.push(lot);
      totalCostBasis += lotCostBasis;
      remainingQty   -= lotQty;
    } else {
      const partialLot: Lot = {
        ...lot,
        quantity: remainingQty.toString(),
        costBasisUsd: (lotCostPerUnit * remainingQty).toFixed(8),
        status: "partial",
      };
      selectedLots.push(partialLot);
      totalCostBasis += lotCostPerUnit * remainingQty;
      remainingQty    = 0;
    }
  }

  if (remainingQty > 1e-8) {
    throw new Error(
      `Insufficient lot quantity. Requested ${quantityToDispose}, available ${
        quantityToDispose - remainingQty
      }`
    );
  }

  const actualQty         = quantityToDispose - remainingQty;
  const estimatedProceeds = actualQty * currentPriceUsd;
  const estimatedGainLoss = estimatedProceeds - totalCostBasis;

  return {
    lots: selectedLots,
    totalQuantity: actualQty.toString(),
    totalCostBasisUsd: totalCostBasis,
    estimatedProceedsUsd: estimatedProceeds,
    estimatedGainLossUsd: estimatedGainLoss,
    selectionMethod: method,
  };
}

function sortLots(lots: Lot[], method: LotSelectionMethod): Lot[] {
  switch (method) {
    case "HIFO":
      return [...lots].sort((a, b) => {
        const costPerUnitA = parseFloat(a.costBasisUsd) / parseFloat(a.quantity);
        const costPerUnitB = parseFloat(b.costBasisUsd) / parseFloat(b.quantity);
        return costPerUnitB - costPerUnitA;
      });

    case "FIFO":
      return [...lots].sort(
        (a, b) => new Date(a.acquiredAt).getTime() - new Date(b.acquiredAt).getTime()
      );

    case "SPECIFIC_ID":
      return lots;

    default:
      return lots;
  }
}

/**
 * Compute the estimated capital gains tax for a lot manifest.
 * Uses simplified US federal brackets (short: 37%, long: 20%) for estimation.
 * NOT to be used as actual tax advice.
 */
export function estimateTaxCost(manifest: LotManifest, lots: Lot[]): number {
  if (manifest.estimatedGainLossUsd <= 0) return 0;

  const now = new Date();
  let shortTermGain = 0;
  let longTermGain  = 0;

  for (const selectedLot of manifest.lots) {
    const originalLot = lots.find((l) => l.id === selectedLot.id);
    const acquiredAt  = originalLot ? new Date(originalLot.acquiredAt) : new Date(selectedLot.acquiredAt);
    const daysHeld    = Math.floor((now.getTime() - acquiredAt.getTime()) / (1000 * 60 * 60 * 24));

    const lotQty        = parseFloat(selectedLot.quantity);
    const lotCostBasis  = parseFloat(selectedLot.costBasisUsd);
    const lotProceeds   = lotQty * (manifest.estimatedProceedsUsd / parseFloat(manifest.totalQuantity));
    const lotGain       = lotProceeds - lotCostBasis;

    if (lotGain <= 0) continue;

    if (daysHeld >= 365) {
      longTermGain  += lotGain;
    } else {
      shortTermGain += lotGain;
    }
  }

  const estimatedTax = shortTermGain * 0.37 + longTermGain * 0.20;
  return Math.max(0, estimatedTax);
}
