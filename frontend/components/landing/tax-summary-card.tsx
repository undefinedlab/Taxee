export function TaxSummaryCard() {
  return (
    <div className="landing-float-delay w-[236px] rounded-xl bg-gradient-to-br from-white via-gray-50 to-gray-100 p-3.5 shadow-md dark:from-gray-800 dark:via-gray-900 dark:to-gray-950">
      <div className="flex items-start justify-between gap-2">
        <span className="font-landing text-[13px] font-semibold text-black dark:text-[#f9fafb]">
          Tax impact YTD
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
