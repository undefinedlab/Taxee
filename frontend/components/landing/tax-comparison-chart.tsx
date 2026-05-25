/** Stacked bars per year — grey = without tax awareness, blue = extra with taxee */

const WITHOUT_ANNUAL_PCT = 13;
const ANNUAL_SPREAD_PCT = 11;
const WITH_ANNUAL_PCT = WITHOUT_ANNUAL_PCT + ANNUAL_SPREAD_PCT;
const YEARS = 3;

function cumulativePct(annualPct: number, years: number) {
  const rate = annualPct / 100;
  return Math.round(((1 + rate) ** years - 1) * 1000) / 10;
}

const yearData = Array.from({ length: YEARS }, (_, i) => {
  const year = i + 1;
  const without = cumulativePct(WITHOUT_ANNUAL_PCT, year);
  const withTaxee = cumulativePct(WITH_ANNUAL_PCT, year);
  return {
    year,
    without,
    withTaxee,
    extra: Math.round((withTaxee - without) * 10) / 10,
  };
});

const maxTotal = yearData[yearData.length - 1].withTaxee;
const BAR_MAX_PX = 176;

function StackedYearBar({
  without,
  extra,
  label,
}: {
  without: number;
  extra: number;
  label: string;
}) {
  const greyPx = Math.max(4, Math.round((without / maxTotal) * BAR_MAX_PX));
  const bluePx = Math.max(4, Math.round((extra / maxTotal) * BAR_MAX_PX));

  return (
    <div className="flex flex-1 flex-col items-center">
      <span className="mb-2.5 font-landing text-xs font-bold tabular-nums text-landing-active dark:text-[#5eb3f6] sm:text-[13px]">
        +{extra}%
      </span>
      <div
        className="flex w-full max-w-[68px] flex-col items-center justify-end sm:max-w-[76px]"
        style={{ height: BAR_MAX_PX + 28 }}
      >
        <div
          className="flex w-full flex-col justify-end overflow-hidden rounded-t-md"
          style={{ height: greyPx + bluePx }}
        >
          <div
            className="w-full bg-landing-active dark:bg-[#5eb3f6]"
            style={{ height: bluePx }}
            title={`+${extra}% extra with taxee`}
          />
          <div
            className="w-full bg-[#9ca3af]/55 dark:bg-[#6b7280]/65"
            style={{ height: greyPx }}
            title={`+${without}% without tax awareness`}
          />
        </div>
      </div>
      <p className="mt-2.5 text-center font-landing text-[11px] font-medium text-[#6b7280] dark:text-[#9ca3af] sm:text-xs">
        {label}
      </p>
    </div>
  );
}

export function TaxComparisonChart() {
  return (
    <div className="w-full px-1 py-2 sm:px-2">
      <div className="flex justify-center gap-5 sm:gap-8 lg:gap-10">
        {yearData.map((d) => (
          <StackedYearBar
            key={d.year}
            without={d.without}
            extra={d.extra}
            label={`Year ${d.year}`}
          />
        ))}
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-5 sm:gap-8">
        <span className="inline-flex items-center gap-2 font-landing text-xs text-[#6b7280] dark:text-[#9ca3af]">
          <span className="h-3.5 w-3.5 rounded-sm bg-[#9ca3af]/55 dark:bg-[#6b7280]/65" />
          Without Taxee
        </span>
        <span className="inline-flex items-center gap-2 font-landing text-xs text-[#6b7280] dark:text-[#9ca3af]">
          <span className="h-3.5 w-3.5 rounded-sm bg-landing-active dark:bg-[#5eb3f6]" />
          With Taxee (+{ANNUAL_SPREAD_PCT}%/yr)
        </span>
      </div>
    </div>
  );
}
