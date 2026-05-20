import type { RegimeState } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

interface RegimePanelProps {
  regime: RegimeState;
}

export function RegimePanel({ regime }: RegimePanelProps) {
  const labelClass =
    regime.label === "risk-off"
      ? "warn"
      : regime.label === "risk-on"
        ? "success"
        : "default";

  return (
    <div className="rounded-xl border border-surface-border bg-surface-raised p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          Regime (LLM)
        </p>
        <Badge variant={labelClass}>{regime.label}</Badge>
      </div>
      <p className="mt-2 font-mono text-sm text-zinc-300">
        Confidence {(regime.confidence * 100).toFixed(0)}%
      </p>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        {regime.reasoning}
      </p>
    </div>
  );
}
