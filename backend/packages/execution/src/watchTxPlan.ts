import type { CandidateAction, WatchTxPlan, WatchTxStep } from "@taxee/shared";
import { getChainConfig, isSupportedChain } from "./chainConfig.js";

export interface BuildWatchTxPlanOpts {
  walletAddress: string;
  openInAppUrl?: string;
}

/**
 * Build a human-readable + wallet-actionable plan for watch-only mode.
 * taxee does not broadcast these txs — the user signs in MetaMask / Rabby / etc.
 */
export function buildWatchTxPlan(
  candidate: CandidateAction,
  currentPrices: Record<string, number>,
  opts: BuildWatchTxPlanOpts,
): WatchTxPlan | null {
  const openLots = candidate.lots.filter((l) => l.status === "open" || l.status === "partial");
  if (openLots.length === 0) return null;

  const first = openLots[0]!;
  const chainId = first.chainId;
  const chainName = isSupportedChain(chainId)
    ? getChainConfig(chainId).name
    : `chain ${chainId}`;
  const assetSymbol = first.assetId;
  const quantity = openLots.reduce((s, l) => s + parseFloat(l.quantity), 0);
  const costBasis = openLots.reduce((s, l) => s + parseFloat(l.costBasisUsd), 0);
  const price = currentPrices[assetSymbol] ?? 0;
  const proceeds = quantity * price;
  const gainLoss = proceeds - costBasis;

  const steps: WatchTxStep[] = [];

  switch (candidate.type) {
    case "HARVEST": {
      steps.push({
        order: 1,
        title: `Dispose ${assetSymbol} (realize loss)`,
        detail:
          `On *${chainName}*, sell or swap *${formatQty(quantity)} ${assetSymbol}* ` +
          `(≈ $${proceeds.toFixed(2)} at spot, cost basis ≈ $${costBasis.toFixed(2)}, ` +
          `loss ≈ $${Math.abs(gainLoss).toFixed(2)}).`,
        walletHint: `Network: ${chainName}`,
      });
      if (candidate.replacementAsset) {
        steps.push({
          order: 2,
          title: `Buy replacement (${candidate.replacementAsset})`,
          detail:
            `Re-buy ~$${proceeds.toFixed(2)} of *${candidate.replacementAsset}* on the same chain ` +
            `to keep market exposure after harvesting the loss.`,
          walletHint: "Use your DEX or aggregator of choice",
        });
      }
      const registry = process.env["TAXEE_LOT_REGISTRY_ADDRESS"];
      if (registry) {
        steps.push({
          order: steps.length + 1,
          title: "Record disposal (optional)",
          detail:
            `For on-chain tax records, call *commitDisposal* on the lot registry after the trade:\n` +
            `\`${registry}\` on ${chainName}`,
          walletHint: "Advanced — taxee dashboard",
        });
      }
      break;
    }
    case "PARK": {
      const daysHeld = first.holdingPeriodDays ?? 0;
      const daysToLt = Math.max(0, 365 - daysHeld);
      steps.push({
        order: 1,
        title: "Park proceeds in USYC",
        detail:
          `Move ~$${proceeds.toFixed(2)} into USYC (or stable yield) on ${chainName} while waiting ` +
          `*${daysToLt}* more days for long-term capital-gains treatment.`,
        walletHint: "Swap or deposit to USYC in your wallet",
      });
      break;
    }
    case "REBALANCE": {
      steps.push({
        order: 1,
        title: `Trim ${assetSymbol} (rebalance)`,
        detail:
          `Portfolio drift suggests reducing *${assetSymbol}* on ${chainName}. ` +
          `Sell ~${formatQty(quantity)} ${assetSymbol} (≈ $${proceeds.toFixed(2)}) per your policy.`,
        walletHint: `Network: ${chainName}`,
      });
      break;
    }
    default:
      return null;
  }

  return {
    actionType: candidate.type,
    chainId,
    chainName,
    walletAddress: opts.walletAddress,
    assetSymbol,
    quantity,
    estimatedProceedsUsd: proceeds,
    estimatedCostBasisUsd: costBasis,
    estimatedGainLossUsd: gainLoss,
    ...(candidate.replacementAsset !== undefined
      ? { replacementAsset: candidate.replacementAsset }
      : {}),
    steps,
    ...(opts.openInAppUrl !== undefined ? { openInAppUrl: opts.openInAppUrl } : {}),
  };
}

export function formatWatchTxPlanTelegram(plan: WatchTxPlan): string {
  const lines: string[] = [
    "",
    "📋 *Suggested transactions (your wallet)*",
    `_taxee does not sign or broadcast these — use MetaMask, Rabby, etc._`,
    "",
    `Wallet: \`${shortAddr(plan.walletAddress)}\``,
    `Chain: *${plan.chainName}*`,
  ];

  for (const step of plan.steps) {
    lines.push("", `*${step.order}. ${step.title}*`, step.detail);
    if (step.walletHint) lines.push(`_${step.walletHint}_`);
  }

  if (plan.openInAppUrl) {
    lines.push("", `🔗 Open prefilled flow: ${plan.openInAppUrl}`);
  }

  lines.push(
    "",
    "Copy amounts into your wallet’s Send / Swap UI. Gas is paid by you.",
  );

  return lines.join("\n");
}

function formatQty(q: number): string {
  if (q >= 1) return q.toFixed(4).replace(/\.?0+$/, "");
  return q.toPrecision(4);
}

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}
