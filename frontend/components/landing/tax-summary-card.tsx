export function TaxSummaryCard() {
  return (
    <div className="landing-float-delay landing-glass-widget-solid w-[236px] p-3.5">
      <div className="flex items-start justify-between gap-2">
        <span className="font-landing text-[13px] font-semibold text-black dark:text-[#f9fafb]">
          Tax impact YTD
        </span>
      </div>
      <p className="mt-1 font-landing text-[10px] text-[#6b7280] dark:text-[#9ca3af]">
        Harvested · avoided · liability
      </p>
      <div className="mt-3 space-y-2.5">
        <MetricRow label="Losses harvested" value="$4.2k" accent="text-[#525252] dark:text-[#a3a3a3]" />
        <MetricRow label="Tax cost avoided" value="$12.4k" accent="text-landing-active dark:text-[#5eb3f6]" />
        <MetricRow label="Est. year-end liability" value="$8.1k" accent="text-black dark:text-[#f9fafb]" />
      </div>
      <p className="mt-3 border-t border-[#e5e7eb] pt-2 font-landing text-[9px] text-[#9ca3af] dark:border-[#2a2a2a]">
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
      <span className="font-landing text-[10px] text-[#6b7280] dark:text-[#9ca3af]">{label}</span>
      <span className={`font-landing text-[13px] font-bold ${accent}`}>{value}</span>
    </div>
  );
}
