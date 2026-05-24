import { AnalyticsCard } from "@/components/landing/analytics-card";
import { TaxSummaryCard } from "@/components/landing/tax-summary-card";

/** Widget stack for section showcase panels */
export function DashboardShowcase() {
  return (
    <div className="relative mx-auto h-[220px] w-full max-w-[340px] sm:h-[240px]">
      <div className="absolute bottom-0 left-0 z-10">
        <AnalyticsCard />
      </div>
      <div className="absolute right-0 top-0 z-20">
        <TaxSummaryCard />
      </div>
    </div>
  );
}
