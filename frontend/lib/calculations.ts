// Tax optimization calculation utilities

export interface PolicyConfig {
  harvestThreshold: number;
  aggressiveness: "conservative" | "aggressive";
  priority: "standard" | "maximum";
}

export interface TaxProjection {
  annualSavings: number;
  harvestsPerYear: number;
  avgHoldTime: number;
  longTermCapture: number;
}

// Base projections from empirical data
const BASE_PROJECTIONS: TaxProjection = {
  annualSavings: 2840,
  harvestsPerYear: 12,
  avgHoldTime: 180,
  longTermCapture: 94,
};

/**
 * Calculate tax projections based on policy configuration
 */
export function calculateTaxProjections(config: PolicyConfig): TaxProjection {
  // Threshold impact: lower threshold = more frequent harvests
  const thresholdMultiplier = 500 / config.harvestThreshold;
  
  // Aggressiveness impact: aggressive = shorter hold times, potentially higher savings
  const aggMultiplier = config.aggressiveness === "aggressive" ? 1.3 : 1;
  const timeMultiplier = config.aggressiveness === "aggressive" ? 0.85 : 1;
  
  // Priority impact: maximum priority = higher long-term capture rate
  const priorityMultiplier = config.priority === "maximum" ? 1.15 : 1;

  return {
    annualSavings: Math.round(BASE_PROJECTIONS.annualSavings * aggMultiplier * priorityMultiplier),
    harvestsPerYear: Math.round(BASE_PROJECTIONS.harvestsPerYear * thresholdMultiplier),
    avgHoldTime: Math.round(BASE_PROJECTIONS.avgHoldTime * timeMultiplier),
    longTermCapture: Math.min(99, Math.round(BASE_PROJECTIONS.longTermCapture * priorityMultiplier)),
  };
}

/**
 * Calculate tax drag for a given rebalance scenario
 */
export function calculateTaxDrag(
  driftPercent: number,
  portfolioValue: number,
  shortTermRate: number,
  longTermRate: number,
  avgHoldPeriod: number
): number {
  const isLongTerm = avgHoldPeriod >= 365;
  const taxRate = isLongTerm ? longTermRate : shortTermRate;
  
  // Tax drag = drift correction amount * tax rate
  const correctionAmount = portfolioValue * (driftPercent / 100);
  return correctionAmount * taxRate;
}

/**
 * Calculate optimal harvest threshold based on portfolio size
 */
export function calculateOptimalThreshold(
  portfolioValue: number,
  transactionCost: number,
  taxRate: number
): number {
  // Minimum threshold where tax savings exceed transaction costs
  const minSavings = transactionCost * 2; // 2x buffer
  return Math.ceil(minSavings / taxRate);
}

/**
 * Estimate annual tax savings from loss harvesting
 */
export function estimateAnnualHarvestSavings(
  portfolioValue: number,
  volatility: number,
  harvestThreshold: number,
  taxRate: number
): number {
  // Rough estimation: volatile portfolios have more harvesting opportunities
  const opportunitiesPerYear = Math.max(4, Math.round(volatility * 20));
  const avgLossPerHarvest = harvestThreshold * 1.5;
  const successRate = 0.7; // Not all opportunities will be executed
  
  return opportunitiesPerYear * avgLossPerHarvest * taxRate * successRate;
}

/**
 * Format currency for display
 */
export function formatCurrency(value: number, compact = false): string {
  if (compact && value >= 1000) {
    return `$${(value / 1000).toFixed(1)}k`;
  }
  return `$${value.toLocaleString()}`;
}

/**
 * Format percentage for display
 */
export function formatPercentage(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}
