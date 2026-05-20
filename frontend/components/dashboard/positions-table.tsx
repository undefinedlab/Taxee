import type { Position } from "@/lib/types";
import { formatUsd } from "@/lib/utils";

interface PositionsTableProps {
  positions: Position[];
}

export function PositionsTable({ positions }: PositionsTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-surface-border">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead>
          <tr className="border-b border-surface-border bg-surface-raised text-xs uppercase tracking-wider text-zinc-500">
            <th className="px-4 py-3 font-medium">Asset</th>
            <th className="px-4 py-3 font-medium">Chain</th>
            <th className="px-4 py-3 font-medium text-right">Value</th>
            <th className="px-4 py-3 font-medium text-right">Unrealized G/L</th>
            <th className="px-4 py-3 font-medium text-right">Held</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((p) => (
            <tr
              key={`${p.assetId}-${p.chain}`}
              className="border-b border-surface-border/60 last:border-0"
            >
              <td className="px-4 py-3 font-medium text-zinc-100">{p.assetId}</td>
              <td className="px-4 py-3 text-zinc-400">{p.chain}</td>
              <td className="px-4 py-3 text-right font-mono tabular-nums text-zinc-200">
                {formatUsd(p.valueUsd)}
              </td>
              <td
                className={`px-4 py-3 text-right font-mono tabular-nums ${
                  p.unrealizedGlUsd >= 0 ? "text-accent" : "text-red-400"
                }`}
              >
                {formatUsd(p.unrealizedGlUsd, true)}
              </td>
              <td className="px-4 py-3 text-right text-zinc-400">
                {p.holdingPeriodDays}d
                {p.holdingPeriodDays >= 335 && (
                  <span className="ml-1 text-warn">· near LT</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
