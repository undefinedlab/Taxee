export function AnalyticsCard() {
  const bars = [42, 55, 48, 62, 58, 78, 85];

  return (
    <div className="landing-float w-[200px] bg-[#5eb3f6] p-3.5 shadow-[0_8px_24px_rgba(45,127,212,0.35)]">
      <div className="flex items-center justify-between gap-2">
        <span className="font-landing text-[12px] font-semibold leading-tight text-white">
          After-tax return
        </span>
        <span className="flex shrink-0 items-center gap-0.5 rounded bg-white/20 px-1.5 py-0.5 font-landing text-[11px] font-bold text-[#b8f55a]">
          <svg width="10" height="10" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
            <path d="M6 2L10 8H2L6 2Z" />
          </svg>
          +2.8%
        </span>
      </div>
      <p className="mt-1 font-landing text-[9px] text-white/80">vs gross-only benchmark</p>
      <div className="mt-3 flex h-[72px] items-end justify-between gap-1.5">
        {bars.map((h, i) => (
          <div
            key={i}
            className="landing-bar-animate w-[18px] bg-white"
            style={{
              height: `${h}%`,
              animationDelay: `${0.6 + i * 0.06}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
