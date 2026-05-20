import { AnalyticsCard } from "@/components/landing/analytics-card";
import { TaxSummaryCard } from "@/components/landing/tax-summary-card";

/** Dashboard widget preview — neutral glass, no tinted panel */
export function ProductPreview() {
  return (
    <div className="landing-glass-cell landing-animate-in landing-delay-4 relative h-full min-h-[260px] w-full lg:min-h-0">
      <div className="relative z-[1] flex h-full min-h-[260px] items-center justify-center p-6 lg:min-h-[320px] lg:p-8">
        <div className="relative h-[200px] w-full max-w-[340px]">
          <div className="absolute bottom-0 left-0 z-10">
            <AnalyticsCard />
          </div>
          <div className="absolute right-0 top-0 z-20">
            <TaxSummaryCard />
          </div>
        </div>
      </div>
    </div>
  );
}
