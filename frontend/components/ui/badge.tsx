import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warn" | "muted";
  className?: string;
}

const variants = {
  default: "bg-surface-raised border-surface-border text-zinc-300",
  success: "bg-emerald-950/60 border-emerald-800/50 text-accent",
  warn: "bg-amber-950/50 border-amber-800/40 text-warn",
  muted: "bg-surface-raised text-zinc-500",
};

export function Badge({
  children,
  variant = "default",
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
