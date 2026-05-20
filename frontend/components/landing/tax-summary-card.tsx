export function TaxSummaryCard() {
  return (
    <div className="landing-float-delay w-[228px] border border-[#e8eaed] bg-white p-3.5 shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
      <div className="flex items-start justify-between gap-2">
        <span className="font-landing text-[13px] font-semibold text-black">
          Tax Summary
        </span>
        <button
          type="button"
          className="rounded border border-[#e8eaed] px-2 py-0.5 font-landing text-[10px] text-[#6b7280]"
        >
          Weekly
        </button>
      </div>
      <p className="mt-1.5 font-landing text-[28px] font-bold leading-none tracking-tight text-black">
        $139.76
      </p>
      <div className="relative mt-2.5 h-[52px]">
        <svg
          className="h-full w-full overflow-visible"
          viewBox="0 0 200 48"
          preserveAspectRatio="none"
        >
          <polyline
            className="landing-line-animate"
            fill="none"
            stroke="#4a9eed"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points="0,40 28,34 56,38 84,24 112,30 140,14 168,20 200,6"
          />
        </svg>
        <span className="absolute -right-0.5 top-0 font-landing text-[10px] font-bold text-[#3dcc4e]">
          +10.12%
        </span>
      </div>
      <div className="mt-2.5 space-y-1.5">
        <LegendRow label="Income" pct={23} color="bg-[#3dcc4e]" />
        <LegendRow label="Assets" pct={20} color="bg-[#4a9eed]" />
        <LegendRow label="Properties" pct={57} color="bg-[#1f2937]" />
      </div>
    </div>
  );
}

function LegendRow({
  label,
  pct,
  color,
}: {
  label: string;
  pct: number;
  color: string;
}) {
  return (
    <div>
      <div className="mb-0.5 flex justify-between font-landing text-[9px] text-[#6b7280]">
        <span>{label}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-[5px] overflow-hidden rounded-full bg-[#f3f4f6]">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
