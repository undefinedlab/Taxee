const newsItems = [
  {
    badge: "Open alpha",
    text: "taxee is in open alpha — register your agent and try watch mode today.",
  },
  {
    badge: "Protocol",
    text: "After-tax optimization now live across Base, Ethereum, and Arbitrum.",
  },
  {
    badge: "Upgrade",
    text: "Delegated approval or manual Execute / Defer / Skip — your choice.",
  },
  {
    badge: "Arc",
    text: "Every disposal logged for Form 8949 pre-fill via Circle stack.",
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
      <span className="inline-flex shrink-0 items-center gap-1.5 bg-[#ecfdf3] px-2 py-0.5 font-landing text-[10px] font-bold uppercase tracking-wide text-[#166534]">
        <span className="h-1.5 w-1.5 animate-pulse bg-[#3dcc4e]" />
        {badge}
      </span>
      <span className="whitespace-nowrap font-landing text-[12px] text-[#374151] sm:text-[13px]">
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
      <div className="pointer-events-none absolute left-0 z-10 h-full w-8 bg-gradient-to-r from-white to-transparent" />
      <div className="pointer-events-none absolute right-0 z-10 h-full w-8 bg-gradient-to-l from-white to-transparent" />
      <div className="landing-marquee-track flex w-max items-center py-1">
        {track}
        {track}
      </div>
    </div>
  );
}
