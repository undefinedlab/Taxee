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
    <span className="mx-5 inline-flex items-center gap-2.5 sm:mx-7">
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-black/10 bg-black/[0.04] px-2.5 py-0.5 font-landing text-[10px] font-semibold uppercase tracking-wide text-black/50 dark:border-white/10 dark:bg-white/[0.06] dark:text-white/50">
        <span className="h-1.5 w-1.5 rounded-full bg-[#3dcc4e]/70" />
        {badge}
      </span>
      <span className="whitespace-nowrap font-landing text-[12px] text-black/40 dark:text-white/40 sm:text-[13px]">
        {text}
      </span>
    </span>
  );
}

/** Inline ticker — CSS scroll with soft edge mask (no solid fade panels) */
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
      className="landing-marquee-mask relative hidden min-w-0 flex-1 overflow-hidden md:flex"
      aria-label="Product news"
    >
      <div className="landing-marquee-track flex w-max items-center py-1 opacity-90">
        {track}
        {track}
      </div>
    </div>
  );
}
