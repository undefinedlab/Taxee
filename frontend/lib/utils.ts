import clsx, { type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatUsd(value: number, compact = false): string {
  if (compact && Math.abs(value) >= 1000) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPct(value: number, signed = true): string {
  const prefix = signed && value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(1)}%`;
}

export function truncateAddress(address: string): string {
  if (address.length < 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** One-line summary for opportunity cards */
export function opportunitySummary(headline: string, reasoning: string): string {
  const h = headline?.trim();
  if (h) return h.length > 100 ? `${h.slice(0, 97)}…` : h;
  const line = reasoning.trim().split(/[.!?\n]/)[0]?.trim() ?? "";
  if (!line) return "Tax action suggested";
  return line.length > 100 ? `${line.slice(0, 97)}…` : line;
}
