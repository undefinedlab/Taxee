export { selectLots, estimateTaxCost } from "./lotSelector.js";
export type { LotSelectionMethod } from "./lotSelector.js";

export { scanForHarvestOpportunities } from "./harvestScanner.js";
export { trackMaturationOpportunities, getLongTermCrossoverDate, getMaturedLots } from "./maturationTracker.js";
export { computeRebalanceCandidates } from "./rebalanceOptimizer.js";
export { buildScanDiagnostics, formatScanDiagnosticsTelegram } from "./scanDiagnostics.js";
export type { ScanDiagnostics } from "./scanDiagnostics.js";
