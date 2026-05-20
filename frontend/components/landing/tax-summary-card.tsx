export function TaxSummaryCard() {
  return (
    <div className="landing-float-delay landing-glass-widget w-[236px] p-3.5">
      <div className="flex items-start justify-between gap-2">
        <span className="font-landing text-[13px] font-semibold text-black">
          Tax impact YTD
        </span>
        <span className="rounded border border-white/50 bg-white/30 px-2 py-0.5 font-landing text-[10px] text-[#6b7280] backdrop-blur-sm dark:border-white/15 dark:bg-white/10 dark:text-[#9ca3af]">
          Demo
        </span>
      </div>
      <p className="mt-1 font-landing text-[10px] text-[#6b7280]">
        Harvested · avoided · liability
      </p>
      <div className="mt-3 space-y-2.5">
        <MetricRow label="Losses harvested" value="$4.2k" accent="text-[#3dcc4e]" />
        <MetricRow label="Tax cost avoided" value="$12.4k" accent="text-[#4a9eed]" />
        <MetricRow label="Est. year-end liability" value="$8.1k" accent="text-[#1f2937]" />
      </div>
      <p className="mt-3 border-t border-white/40 pt-2 font-landing text-[9px] text-[#9ca3af] dark:border-white/15">
        Arc → Form 8949 pre-fill
      </p>
    </div>
  );
}

function MetricRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="font-landing text-[10px] text-[#6b7280]">{label}</span>
      <span className={`font-landing text-[13px] font-bold ${accent}`}>{value}</span>
    </div>
  );
}
