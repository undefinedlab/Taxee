const newsItems = [
  {
    badge: "Open alpha",
    text: "First DeFi portfolio agent optimizing after-tax return — not gross performance.",
  },
  {
    badge: "Cross-chain",
    text: "Ethereum, Base, and Arbitrum — rebalance, harvest, and park with tax awareness.",
  },
  {
    badge: "Control",
    text: "Manual Execute / Defer / Skip or delegate within policy — Arc audit on every move.",
  },
  {
    badge: "USYC",
    text: "Lots near 365-day threshold park in USYC for yield while maturing to long-term.",
  },
];

function NewsItem({
  badge,
  text,
}: {
  badge: string;
  text: string;
}) {
  return (
    <span className="mx-5 inline-flex items-center gap-2 sm:mx-6">
      <span className="inline-flex shrink-0 items-center gap-1.5 bg-[#ecfdf3] px-2 py-0.5 font-landing text-[10px] font-bold uppercase tracking-wide text-[#166534] dark:bg-[#14532d]/40 dark:text-[#86efac]">
        <span className="h-1.5 w-1.5 animate-pulse bg-[#3dcc4e]" />
        {badge}
      </span>
      <span className="whitespace-nowrap font-landing text-[12px] text-[#374151] dark:text-[#d1d5db] sm:text-[13px]">
        {text}
      </span>
    </span>
  );
}

/** Inline ticker for hero header — between logo and profile menu */
export function NewsMarquee() {
  const track = (
    <>
      {newsItems.map((item) => (
        <NewsItem key={item.text} badge={item.badge} text={item.text} />
      ))}
    </>
  );

  return (
    <div
      id="news"
      className="relative hidden min-w-0 flex-1 items-center overflow-hidden md:flex"
      aria-label="Product news"
    >
      <div className="pointer-events-none absolute left-0 z-10 h-full w-12 bg-gradient-to-r from-[#f8f7f5]/95 via-[#f8f7f5]/40 to-transparent dark:from-[#0c0e12]/95 dark:via-[#0c0e12]/40" />
      <div className="pointer-events-none absolute right-0 z-10 h-full w-12 bg-gradient-to-l from-[#f8f7f5]/95 via-[#f8f7f5]/40 to-transparent dark:from-[#0c0e12]/95 dark:via-[#0c0e12]/40" />
      <div className="landing-marquee-track flex w-max items-center py-1">
        {track}
        {track}
      </div>
    </div>
  );
}
