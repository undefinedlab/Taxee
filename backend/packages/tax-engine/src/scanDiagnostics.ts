import type { PortfolioSnapshot, UserPolicy, RegimeState, Position, Lot } from "@taxee/shared";
import { getHarvestTaxRate } from "@taxee/shared";
import { computeRebalanceCandidates } from "./rebalanceOptimizer.js";

const LONG_TERM_DAYS = 365;

export interface ScanDiagnostics {
  harvest: { candidateCount: number; lines: string[] };
  park: { candidateCount: number; lines: string[] };
  rebalance: { candidateCount: number; lines: string[] };
  openLotCount: number;
}

/** Why a tax-engine candidate did or did not become a user-facing opportunity */
export interface CandidateOutcome {
  type: string;
  assetId?: string;
  status: "saved" | "notified" | "duplicate" | "llm_skip" | "error" | "executed";
  llmDecision?: string;
  detail: string;
}

/**
 * Explain why harvest / park / rebalance did or did not fire — for empty-state UX.
 */
export function buildScanDiagnostics(
  snapshot: PortfolioSnapshot,
  policy: UserPolicy,
  regime: RegimeState,
  counts: { harvest: number; park: number; rebalance: number },
): ScanDiagnostics {
  const now = new Date();
  const harvestLines: string[] = [];
  const parkLines: string[] = [];
  const rebalanceLines: string[] = [];

  const openLots = snapshot.positions.flatMap((p) =>
    p.lots.filter((l) => l.status === "open" || l.status === "partial"),
  );

  if (openLots.length === 0) {
    harvestLines.push("No open tax lots in the database — link a wallet and sync on-chain history.");
    parkLines.push("—");
    rebalanceLines.push("—");
    return wrap(counts, openLots.length, harvestLines, parkLines, rebalanceLines);
  }

  const threshold = policy.harvestThresholdPct;
  const minLoss = policy.minHarvestLossUsd ?? 0;
  let harvestNearMiss = 0;

  for (const position of snapshot.positions) {
    const price = snapshot.prices[position.assetId];
    const chain = chainLabel(position.chainId);
    if (!price) {
      harvestLines.push(`*${position.assetId}* (${chain}): no spot price — skipped.`);
      continue;
    }

    const open = position.lots.filter((l) => l.status === "open" || l.status === "partial");
    if (open.length === 0) continue;

    const basis = open.reduce((s, l) => s + parseFloat(l.costBasisUsd), 0);
    const qty = open.reduce((s, l) => s + parseFloat(l.quantity), 0);
    const value = qty * price;
    const uPnL = value - basis;
    const pct = basis > 0 ? (uPnL / basis) * 100 : 0;

    if (uPnL >= 0) {
      harvestLines.push(
        `*${position.assetId}* (${chain}): ${fmtUsd(value)} at ${fmtPct(pct)} — in gain, not a harvest target.`,
      );
    } else if (pct >= threshold) {
      harvestNearMiss++;
      harvestLines.push(
        `*${position.assetId}* (${chain}): ${fmtPct(pct)} loss — below your *${Math.abs(threshold)}%* harvest threshold.`,
      );
    } else if (uPnL > -minLoss) {
      harvestLines.push(
        `*${position.assetId}* (${chain}): ${fmtPct(pct)} loss ($${Math.abs(uPnL).toFixed(2)}) — under min loss *$${minLoss}*.`,
      );
    } else {
      const save = Math.abs(uPnL) * getHarvestTaxRate(policy);
      harvestLines.push(
        `*${position.assetId}* (${chain}): ${fmtPct(pct)} loss — *eligible* (~$${save.toFixed(0)} tax save at ${(getHarvestTaxRate(policy) * 100).toFixed(0)}% rate).`,
      );
    }

    for (const lot of open) {
      parkLines.push(describeParkLot(lot, position, price, policy, now));
    }
  }

  if (harvestLines.length === 0) {
    harvestLines.push("No taxable positions with open lots.");
  }
  if (counts.harvest === 0 && harvestNearMiss === 0 && harvestLines.every((l) => l.includes("in gain"))) {
    harvestLines.push("Note: harvest only targets unrealized losses.");
  }

  const rebalanceCandidates = computeRebalanceCandidates(snapshot, regime, policy);
  if (rebalanceCandidates.length > 0) {
    rebalanceLines.push(
      `${rebalanceCandidates.length} rebalance candidate(s) from regime *${regime.label}* — may still be filtered by LLM or duplicates.`,
    );
  } else {
    const total = snapshot.positions.reduce((s, p) => {
      const price = snapshot.prices[p.assetId] ?? 0;
      return s + parseFloat(p.quantity) * price;
    }, 0);
    if (total <= 0) {
      rebalanceLines.push("Portfolio value too small to model allocation drift.");
    } else {
      rebalanceLines.push(
        `Allocation drift below *${policy.rebalanceAggressiveness}* rebalance threshold, or no overweight assets to trim.`,
      );
      rebalanceLines.push("Note: rebalance trims overweight winners — not loss positions.");
    }
  }

  if (!policy.allowedActions.includes("PARK")) {
    parkLines.unshift("PARK is disabled in your policy.");
  } else if (counts.park === 0) {
    parkLines.push(
      `Note: PARK parks gains in USYC within the last ${policy.maturationBufferDays} days before the ` +
        `${LONG_TERM_DAYS}-day long-term threshold — not for loss lots.`,
    );
  }

  return wrap(counts, openLots.length, harvestLines, parkLines, rebalanceLines);
}

function describeParkLot(
  lot: Lot,
  position: Position,
  price: number,
  policy: UserPolicy,
  now: Date,
): string {
  const chain = chainLabel(position.chainId);
  const qty = parseFloat(lot.quantity);
  const basis = parseFloat(lot.costBasisUsd);
  const value = qty * price;
  const gain = value - basis;
  const daysHeld = Math.floor((now.getTime() - new Date(lot.acquiredAt).getTime()) / 86_400_000);
  const daysToLt = LONG_TERM_DAYS - daysHeld;
  const buf = policy.maturationBufferDays;

  if (gain <= 0) {
    return `*${position.assetId}* (${chain}, ${daysHeld}d held): at a loss — PARK is for gains nearing long-term treatment, not maturing losses.`;
  }
  if (daysToLt <= 0) {
    return `*${position.assetId}* (${chain}): already long-term (${daysHeld}d) — no maturation park needed.`;
  }
  if (daysToLt > buf) {
    return `*${position.assetId}* (${chain}, ${daysHeld}d held): +${fmtPct((gain / basis) * 100)} gain — *${daysToLt}d* until long-term (PARK triggers within last *${buf}d*).`;
  }
  return `*${position.assetId}* (${chain}): +${fmtPct((gain / basis) * 100)} gain, *${daysToLt}d* to long-term — *eligible for PARK*.`;
}

export function formatScanDiagnosticsTelegram(d: ScanDiagnostics): string {
  const lines = [
    "✅ *Tax analysis complete*",
    "",
    `📚 *${d.openLotCount}* open tax lot(s) in DB`,
    "",
    "🌾 *Harvest (losses)*",
    ...d.harvest.lines.map((l) => `  • ${l}`),
    "",
    "🏦 *Park (long-term maturation)*",
    ...d.park.lines.map((l) => `  • ${l}`),
    "",
    "⚖️ *Rebalance*",
    ...d.rebalance.lines.map((l) => `  • ${l}`),
  ];

  const total =
    d.harvest.candidateCount + d.park.candidateCount + d.rebalance.candidateCount;
  if (total === 0) {
    lines.push(
      "",
      "No opportunities saved this scan (engine found 0 matches, or LLM chose SKIP / duplicate pending).",
    );
  } else {
    lines.push(
      "",
      `Engine: ${d.harvest.candidateCount} harvest, ${d.park.candidateCount} park, ${d.rebalance.candidateCount} rebalance — check notifications if any were approved.`,
    );
  }

  return lines.join("\n");
}

export function formatCandidateOutcomesTelegram(outcomes: CandidateOutcome[]): string {
  if (outcomes.length === 0) return "";

  const lines = ["", "📋 *Decisions this scan*", ""];
  for (const o of outcomes) {
    const icon =
      o.status === "saved" || o.status === "notified" || o.status === "executed"
        ? "✅"
        : o.status === "duplicate"
          ? "⏳"
          : o.status === "llm_skip"
            ? "⏭"
            : "⚠️";
    const asset = o.assetId ? ` *${o.assetId}*` : "";
    lines.push(`  ${icon} *${o.type}*${asset}: ${o.detail}`);
  }
  lines.push("", "Use /opportunities to approve, defer, or skip pending actions.");
  return lines.join("\n");
}

function wrap(
  counts: { harvest: number; park: number; rebalance: number },
  openLotCount: number,
  harvestLines: string[],
  parkLines: string[],
  rebalanceLines: string[],
): ScanDiagnostics {
  return {
    harvest: { candidateCount: counts.harvest, lines: harvestLines },
    park: { candidateCount: counts.park, lines: parkLines },
    rebalance: { candidateCount: counts.rebalance, lines: rebalanceLines },
    openLotCount,
  };
}

function chainLabel(chainId: number): string {
  const names: Record<number, string> = {
    1: "Ethereum",
    8453: "Base",
    84532: "Base Sepolia",
    11155111: "Sepolia",
    10: "Optimism",
    42161: "Arbitrum",
  };
  return names[chainId] ?? `chain ${chainId}`;
}

function fmtPct(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

function fmtUsd(n: number): string {
  return `$${n.toFixed(2)}`;
}
