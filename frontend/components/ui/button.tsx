import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-accent text-surface font-medium hover:bg-accent-muted disabled:opacity-50",
  secondary:
    "bg-surface-raised border border-surface-border text-zinc-200 hover:border-zinc-500",
  ghost: "text-zinc-400 hover:text-zinc-100 hover:bg-surface-raised",
  danger: "bg-red-950/80 border border-red-800/60 text-red-200 hover:bg-red-900/50",
};

export function Button({
  variant = "primary",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm transition-colors",
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
