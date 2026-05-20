"use client";

import type { ApprovalSettings } from "@/lib/types";
import { updateAgentApproval } from "@/lib/agent-store";
import { cn } from "@/lib/utils";

interface ApprovalModeToggleProps {
  approval: ApprovalSettings;
  onChange: (approval: ApprovalSettings) => void;
}

export function ApprovalModeToggle({
  approval,
  onChange,
}: ApprovalModeToggleProps) {
  function setMode(mode: ApprovalSettings["mode"]) {
    const next = { ...approval, mode };
    const saved = updateAgentApproval(next);
    onChange(saved ?? next);
  }

  return (
    <div className="rounded-xl border border-surface-border bg-surface-raised p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
        Approval mode
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => setMode("manual")}
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm transition-colors",
            approval.mode === "manual"
              ? "bg-accent/20 text-accent"
              : "text-zinc-400 hover:bg-surface-border",
          )}
        >
          Manual
        </button>
        <button
          type="button"
          onClick={() => setMode("delegated")}
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm transition-colors",
            approval.mode === "delegated"
              ? "bg-accent/20 text-accent"
              : "text-zinc-400 hover:bg-surface-border",
          )}
        >
          Delegated
        </button>
      </div>
      <p className="mt-2 text-xs text-zinc-500">
        {approval.mode === "manual"
          ? "You approve every opportunity before execution."
          : "Agent acts autonomously within policy; you receive receipts."}
      </p>
    </div>
  );
}
