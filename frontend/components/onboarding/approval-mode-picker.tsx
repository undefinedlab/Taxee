import type { ApprovalMode, ApprovalSettings } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ApprovalModePickerProps {
  value: ApprovalSettings;
  onChange: (settings: ApprovalSettings) => void;
}

export function ApprovalModePicker({ value, onChange }: ApprovalModePickerProps) {
  function setMode(mode: ApprovalMode) {
    onChange({ ...value, mode });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-400">
        How should the agent act when it finds an opportunity?
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <ModeCard
          title="I approve each action"
          description="Notify me with Execute, Defer, or Skip. Nothing runs until you choose."
          selected={value.mode === "manual"}
          onSelect={() => setMode("manual")}
        />
        <ModeCard
          title="Delegate to agent"
          description="Agent executes autonomously within your policy. You always get a receipt notification."
          selected={value.mode === "delegated"}
          onSelect={() => setMode("delegated")}
        />
      </div>
      {value.mode === "delegated" && (
        <p className="text-xs text-zinc-500">
          Guardrails still apply: harvest threshold, maturation parking, and max
          tax per action. Change mode anytime in the dashboard.
        </p>
      )}
    </div>
  );
}

function ModeCard({
  title,
  description,
  selected,
  onSelect,
}: {
  title: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "rounded-xl border p-4 text-left transition-colors",
        selected
          ? "border-accent/40 bg-emerald-950/25"
          : "border-surface-border bg-surface-raised hover:border-zinc-600",
      )}
    >
      <p className="font-medium text-zinc-100">{title}</p>
      <p className="mt-2 text-xs leading-relaxed text-zinc-400">{description}</p>
    </button>
  );
}
