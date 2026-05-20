import { AnalyticsCard } from "@/components/landing/analytics-card";
import { TaxSummaryCard } from "@/components/landing/tax-summary-card";

/** Center blue panel with overlapping dashboard widgets (reference design) */
export function ProductPreview() {
  return (
    <div className="landing-animate-in landing-delay-4 relative h-full min-h-[260px] w-full overflow-hidden bg-[#4a9eed] lg:min-h-0">
      <div className="absolute inset-0 bg-gradient-to-br from-[#5eb3f6] to-[#2d7fd4] opacity-90" />
      <div className="relative flex h-full min-h-[260px] items-center justify-center p-6 lg:min-h-[320px] lg:p-8">
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
