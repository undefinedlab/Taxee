export function AnalyticsCard() {
  const bars = [42, 55, 48, 62, 58, 78, 85];

  return (
    <div className="landing-float landing-glass-widget w-[200px] p-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="font-landing text-[12px] font-semibold leading-tight text-black dark:text-[#f9fafb]">
          After-tax return
        </span>
        <span className="flex shrink-0 items-center gap-0.5 rounded border border-white/50 bg-white/30 px-1.5 py-0.5 font-landing text-[11px] font-bold text-[#166534] backdrop-blur-sm dark:border-white/15 dark:bg-white/10 dark:text-[#86efac]">
          <svg width="10" height="10" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
            <path d="M6 2L10 8H2L6 2Z" />
          </svg>
          +2.8%
        </span>
      </div>
      <p className="mt-1 font-landing text-[9px] text-[#6b7280] dark:text-[#9ca3af]">
        vs gross-only benchmark
      </p>
      <div className="mt-3 flex h-[72px] items-end justify-between gap-1.5">
        {bars.map((h, i) => (
          <div
            key={i}
            className="landing-bar-animate w-[18px] bg-[#4a9eed] dark:bg-[#5eb3f6]"
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
