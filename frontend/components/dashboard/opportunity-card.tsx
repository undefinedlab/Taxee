"use client";

import { useState } from "react";
import type { Opportunity } from "@/lib/types";
import { updateOpportunityStatus } from "@/lib/agent-store";
import { formatUsd } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface OpportunityCardProps {
  opportunity: Opportunity;
  onUpdate?: (opportunities: Opportunity[]) => void;
}

const typeLabels: Record<Opportunity["type"], string> = {
  HARVEST: "Loss harvest",
  REBALANCE: "Rebalance",
  PARK: "Maturation park",
};

export function OpportunityCard({ opportunity, onUpdate }: OpportunityCardProps) {
  const [status, setStatus] = useState(opportunity.status);
  const [busy, setBusy] = useState(false);

  const resolved = status !== "pending";

  async function handleAction(action: "executed" | "deferred" | "skipped") {
    setBusy(true);
    const updated = updateOpportunityStatus(opportunity.id, action);
    setStatus(action);
    onUpdate?.(updated);
    setBusy(false);
  }

  return (
    <article
      className={`rounded-xl border p-5 ${
        resolved
          ? "border-surface-border bg-surface-raised/50 opacity-80"
          : "border-accent/25 bg-surface-raised"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge variant={resolved ? "muted" : "warn"}>
            {typeLabels[opportunity.type]}
          </Badge>
          <h3 className="mt-2 text-lg font-medium text-zinc-100">
            {opportunity.headline}
          </h3>
          <p className="mt-1 text-sm text-accent">
            Est. tax saving {formatUsd(opportunity.taxSavingEstimate)}
          </p>
        </div>
        {resolved && (
          <Badge variant="muted" className="capitalize">
            {status}
          </Badge>
        )}
      </div>

      <div className="mt-4 rounded-lg border border-surface-border bg-surface p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          Agent reasoning
        </p>
        <p className="mt-2 text-sm leading-relaxed text-zinc-300">
          {opportunity.llmReasoning}
        </p>
      </div>

      {!resolved && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button disabled={busy} onClick={() => handleAction("executed")}>
            Execute
          </Button>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => handleAction("deferred")}
          >
            Defer {opportunity.deferDays ? `${opportunity.deferDays}d` : ""}
          </Button>
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => handleAction("skipped")}
          >
            Skip
          </Button>
        </div>
      )}

      {status === "deferred" && opportunity.deferReason && (
        <p className="mt-3 text-xs text-zinc-500">
          Re-check scheduled — {opportunity.deferReason}
        </p>
      )}
      {status === "executed" && (
        <p className="mt-3 text-sm text-accent">
          Confirmed — loss booked to Arc ledger (demo)
        </p>
      )}
    </article>
  );
}
