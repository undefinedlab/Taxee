/** Site-wide SEO & social sharing config */
export const siteConfig = {
  name: "Taxee",
  title: "Taxee — After-tax DeFi portfolio agent",
  shortTitle: "Taxee",
  description:
    "AI portfolio agent that optimizes after-tax return — not just gross performance. Tax-loss harvesting, lot optimization, and long-term holding embedded in every rebalance.",
  tagline: "Maximise your after-tax alpha.",
  url:
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "https://taxee.io",
  locale: "en_US",
  keywords: [
    "Taxee",
    "DeFi portfolio agent",
    "after-tax returns",
    "tax-loss harvesting",
    "crypto tax optimization",
    "cross-chain rebalancing",
    "Form 8949",
    "Circle wallet",
    "EIP-7702",
    "Base",
    "autonomous portfolio",
  ],
  authors: [{ name: "Taxee", url: "https://taxee.io" }],
  creator: "Taxee",
  twitterHandle: "@taxee",
  telegramBot: "https://t.me/taxee_bot",
} as const;

export function absoluteUrl(path = ""): string {
  const base = siteConfig.url;
  if (!path || path === "/") return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
