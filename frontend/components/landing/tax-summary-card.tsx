export function TaxSummaryCard() {
  return (
    <div className="landing-float-delay landing-glass-widget-solid w-[236px] p-3.5">
      <div className="flex items-start justify-between gap-2">
        <span className="font-landing text-[13px] font-semibold text-black dark:text-[#f9fafb]">
          Tax impact YTD
        </span>
        <span className="rounded border border-[#e5e7eb] bg-[#f3f4f6] px-2 py-0.5 font-landing text-[10px] text-[#6b7280] dark:border-[#374151] dark:bg-[#111827] dark:text-[#9ca3af]">
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
      <p className="mt-3 border-t border-[#e5e7eb] pt-2 font-landing text-[9px] text-[#9ca3af] dark:border-[#374151]">
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
