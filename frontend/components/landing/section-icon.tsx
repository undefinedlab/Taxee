import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type SectionIconName =
  | "chart-down"
  | "shuffle"
  | "clock"
  | "rebalance"
  | "rotate"
  | "hold"
  | "harvest"
  | "wallet"
  | "pulse"
  | "loop"
  | "trend-up"
  | "layers"
  | "calendar"
  | "dashboard"
  | "fingerprint"
  | "bridge"
  | "zap"
  | "hand"
  | "bolt"
  | "monitor"
  | "message"
  | "plug";

const iconPaths: Record<SectionIconName, ReactNode> = {
  "chart-down": (
    <>
      <path d="M4 14l4-4 3 3 5-6" />
      <path d="M4 18h12" />
    </>
  ),
  shuffle: (
    <>
      <path d="M16 4h2v4" />
      <path d="M8 20H6v-4" />
      <path d="M6 8l4 4-4 4" />
      <path d="M18 16l-4-4 4-4" />
    </>
  ),
  clock: (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 6v4l3 2" />
    </>
  ),
  rebalance: (
    <>
      <path d="M3 8h5" />
      <path d="M8 8l-2-2" />
      <path d="M8 8l-2 2" />
      <path d="M17 12h-5" />
      <path d="M12 12l2-2" />
      <path d="M12 12l2 2" />
    </>
  ),
  rotate: (
    <>
      <path d="M14 4a6 6 0 0 1 2 10" />
      <path d="M14 4v4h-4" />
      <path d="M6 16a6 6 0 0 1-2-10" />
      <path d="M6 16v-4h4" />
    </>
  ),
  hold: (
    <>
      <path d="M6 10V6a4 4 0 0 1 8 0v4" />
      <rect x="5" y="10" width="10" height="7" rx="1" />
    </>
  ),
  harvest: (
    <>
      <path d="M4 14h12" />
      <path d="M7 14V8" />
      <path d="M10 14V5" />
      <path d="M13 14V9" />
    </>
  ),
  wallet: (
    <>
      <rect x="3" y="6" width="14" height="10" rx="2" />
      <path d="M3 10h14" />
      <circle cx="14" cy="13" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  pulse: <path d="M3 10h3l2-5 3 10 3-6 2 4h3" />,
  loop: (
    <>
      <path d="M7 6a5 5 0 0 1 8 2" />
      <path d="M15 8v-2h2" />
      <path d="M13 14a5 5 0 0 1-8-2" />
      <path d="M5 12v2H3" />
    </>
  ),
  "trend-up": (
    <>
      <path d="M4 14l4-4 3 3 5-6" />
      <path d="M4 18h12" />
    </>
  ),
  layers: (
    <>
      <path d="M10 3 3 7l7 4 7-4-7-4z" />
      <path d="M3 12l7 4 7-4" />
      <path d="M3 16l7 4 7-4" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="14" height="12" rx="2" />
      <path d="M3 9h14M7 3v4M13 3v4" />
    </>
  ),
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="12" y="3" width="5" height="4" rx="1" />
      <rect x="12" y="10" width="5" height="7" rx="1" />
      <rect x="3" y="13" width="7" height="4" rx="1" />
    </>
  ),
  fingerprint: (
    <>
      <path d="M6 10a4 4 0 0 1 8 0c0 2-1 3-2 4" />
      <path d="M10 6v8M7 8.5a3 3 0 0 0 0 5M13 8.5a3 3 0 0 1 0 5" />
    </>
  ),
  bridge: (
    <>
      <path d="M4 10h12" />
      <path d="M6 10V7a4 4 0 0 1 8 0v3" />
      <path d="M8 14h4" />
    </>
  ),
  zap: <path d="M11 3 6 11h4l-1 6 5-8H10l1-6z" />,
  hand: (
    <>
      <path d="M6 11V7a2 2 0 0 1 4 0v4" />
      <path d="M10 11V6a2 2 0 0 1 4 0v6" />
      <path d="M6 11v2a4 4 0 0 0 8 0v-1" />
    </>
  ),
  bolt: <path d="M11 3 6 11h4l-1 6 5-8H10l1-6z" />,
  monitor: (
    <>
      <rect x="3" y="4" width="14" height="10" rx="2" />
      <path d="M8 18h4" />
    </>
  ),
  message: (
    <>
      <path d="M4 5h12a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H8l-4 3V7a2 2 0 0 1 2-2z" />
      <path d="M7 9h6M7 12h4" />
    </>
  ),
  plug: (
    <>
      <path d="M7 4v4M13 4v4" />
      <path d="M5 8h10v4a3 3 0 0 1-3 3h-4a3 3 0 0 1-3-3V8z" />
      <path d="M10 15v3" />
    </>
  ),
};

interface SectionIconProps {
  name: SectionIconName;
  variant?: "default" | "plain";
  className?: string;
}

export function SectionIcon({
  name,
  variant = "default",
  className,
}: SectionIconProps) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center text-[#111827] dark:text-[#f3f4f6]",
        variant === "default" &&
          "h-10 w-10 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] dark:border-[#374151] dark:bg-[#111827]",
        variant === "plain" && "h-9 w-9",
        className,
      )}
      aria-hidden
    >
      <svg
        className="h-5 w-5"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {iconPaths[name]}
      </svg>
    </span>
  );
}
