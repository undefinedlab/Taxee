export function TaxSummaryCard() {
  return (
    <div className="landing-float-delay w-[236px] border border-[#e8eaed] bg-white p-3.5 shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
      <div className="flex items-start justify-between gap-2">
        <span className="font-landing text-[13px] font-semibold text-black">
          Tax impact YTD
        </span>
        <span className="rounded border border-[#e8eaed] px-2 py-0.5 font-landing text-[10px] text-[#6b7280]">
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
      <p className="mt-3 border-t border-[#f3f4f6] pt-2 font-landing text-[9px] text-[#9ca3af]">
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
