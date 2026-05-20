import type { PortfolioMetrics } from "@/lib/types";
import { formatPct, formatUsd } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface MetricsGridProps {
  metrics: PortfolioMetrics;
}

export function MetricsGrid({ metrics }: MetricsGridProps) {
  const alphaDelta =
    metrics.afterTaxReturnPct - metrics.benchmarkBtcReturnPct;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        label="After-tax return"
        value={formatPct(metrics.afterTaxReturnPct)}
        highlight
        sub={`vs BTC ${formatPct(metrics.benchmarkBtcReturnPct)} (${formatPct(alphaDelta)} alpha)`}
      />
      <MetricCard
        label="Gross return"
        value={formatPct(metrics.grossReturnPct)}
        sub={`${formatPct(metrics.grossReturnPct - metrics.afterTaxReturnPct)} lost to tax drag`}
        muted
      />
      <MetricCard
        label="Losses harvested YTD"
        value={formatUsd(metrics.lossesHarvestedYtd)}
        sub="Booked against realized gains"
      />
      <MetricCard
        label="Tax cost avoided"
        value={formatUsd(metrics.taxCostAvoided)}
        sub={`Est. liability ${formatUsd(metrics.estimatedYearEndLiability)}`}
      />
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
  highlight,
  muted,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        highlight
          ? "border-accent/30 bg-emerald-950/20"
          : "border-surface-border bg-surface-raised",
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 font-mono text-2xl font-semibold tabular-nums",
          highlight ? "text-accent" : muted ? "text-zinc-400" : "text-zinc-100",
        )}
      >
        {value}
      </p>
      {sub && <p className="mt-2 text-xs text-zinc-500">{sub}</p>}
    </div>
  );
}
