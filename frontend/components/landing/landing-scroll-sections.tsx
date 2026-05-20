import Link from "next/link";
import { FeatureCard } from "@/components/landing/feature-card";
import { cn } from "@/lib/utils";

export function LandingScrollSections() {
  return (
    <div className="mx-auto mt-10 max-w-[1320px] space-y-8 pb-16 sm:mt-12 sm:space-y-10 lg:space-y-12">
      {/* How it works — 3 phases */}
      <section
        id="how-it-works"
        className="landing-card-sharp overflow-hidden border border-[#e5e7eb] bg-white shadow-[0_4px_24px_rgba(0,0,0,0.05)]"
      >
        <div className="landing-grid-line border-b px-6 py-8 sm:px-10 sm:py-10 lg:px-12 lg:py-12">
          <p className="font-landing text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b7280]">
            How it works
          </p>
          <h2 className="mt-2 font-serif text-2xl font-bold text-black sm:text-3xl">
            Three phases. Set up once, run forever.
          </h2>
        </div>
        <div className="grid divide-y divide-[#e8eaed] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <FeatureCard
            className="!border-0"
            tag="Phase 1 — Once"
            title="Onboarding"
            description="Connect wallet, import onchain history, set jurisdiction and harvest threshold. Two minutes — never again."
            accent="both"
            href="/onboarding"
          />
          <FeatureCard
            className="!border-0"
            tag="Phase 2 — Always on"
            title="Heartbeat"
            description="Hourly scan of prices, lots, and regime. The agent reasons; you only hear when there's an opportunity."
            metric="60m"
            metricLabel="scan interval"
            accent="blue"
          />
          <FeatureCard
            className="!border-0"
            tag="Phase 3 — Your call"
            title="Action loop"
            description="Approve each move, or delegate — the agent executes within your policy and sends a receipt every time."
            accent="green"
            href="/dashboard/demo"
          />
        </div>
      </section>

      {/* Features — 2x2 grid */}
      <section
        id="features"
        className="landing-card-sharp overflow-hidden border border-[#e5e7eb] bg-white shadow-[0_4px_24px_rgba(0,0,0,0.05)]"
      >
        <div className="landing-grid-line border-b px-6 py-8 sm:px-10 sm:py-10 lg:px-12 lg:py-12">
          <p className="font-landing text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b7280]">
            Features
          </p>
          <h2 className="mt-2 font-serif text-2xl font-bold text-black sm:text-3xl">
            Tax engine embedded in every decision
          </h2>
        </div>
        <div className="grid divide-y divide-[#e8eaed] md:grid-cols-2 md:divide-x md:divide-y-0">
          <FeatureCard
            className="!border-0"
            tag="Rebalance"
            title="Regime-aware, tax-adjusted"
            description="Weighs disposal cost against drift before any rebalance. Delays or splits when the tax hit isn't worth it."
            metric="−8%"
            metricLabel="typical tax drag avoided"
            accent="green"
          />
          <FeatureCard
            className="!border-0"
            tag="Harvest"
            title="Cross-chain loss harvesting"
            description="Scans all chains, books losses against gains, swaps into correlated assets to keep exposure."
            accent="blue"
          />
          <FeatureCard
            className="!border-0 md:border-t"
            tag="Maturation"
            title="Holding-period engine"
            description="Lots near 365 days get parked in USYC — yield while aging, not sold at short-term rates."
            metric="365d"
            metricLabel="long-term threshold"
            accent="both"
          />
          <FeatureCard
            className="!border-0"
            tag="Dashboard"
            title="After-tax alpha"
            description="Gross vs after-tax return, losses harvested YTD, tax cost avoided, and estimated year-end liability."
            metric="+2.8%"
            metricLabel="vs gross-only"
            accent="green"
            href="/dashboard/demo"
          />
        </div>
      </section>

      {/* Circle stack — 3 columns */}
      <section
        id="execution"
        className="landing-card-sharp overflow-hidden border border-[#e5e7eb] bg-white shadow-[0_4px_24px_rgba(0,0,0,0.05)]"
      >
        <div className="landing-grid-line border-b px-6 py-8 sm:px-10 sm:py-10 lg:px-12 lg:py-12">
          <p className="font-landing text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b7280]">
            Execution
          </p>
          <h2 className="mt-2 font-serif text-2xl font-bold text-black sm:text-3xl">
            Built on Circle
          </h2>
        </div>
        <div className="grid divide-y divide-[#e8eaed] lg:grid-cols-3 lg:divide-x lg:divide-y-0">
          <FeatureCard
            className="!border-0"
            title="Specific-ID lots"
            description="IRS-compliant lot selection on every disposal. Arc logs each trade — Form 8949, pre-filled."
            accent="green"
          />
          <FeatureCard
            className="!border-0"
            title="CCTP & Gateway"
            description="Cross-chain moves with consistent settlement across Ethereum, Base, and Arbitrum."
            accent="blue"
          />
          <FeatureCard
            className="!border-0"
            title="Paymaster gas"
            description="Gas paid in USDC. No ETH required in wallet for agent execution."
            accent="both"
          />
        </div>
      </section>

      {/* Approval modes — 2 wide cards */}
      <section className="landing-card-sharp overflow-hidden border border-[#e5e7eb] bg-white shadow-[0_4px_24px_rgba(0,0,0,0.05)]">
        <div className="grid md:grid-cols-2">
          <div className="landing-grid-line border-b p-8 md:border-b-0 md:border-r sm:p-10 lg:p-12">
            <span className="inline-block bg-[#f3f4f6] px-3 py-1 font-landing text-[11px] font-semibold text-black">
              Manual approval
            </span>
            <h3 className="mt-4 font-serif text-xl font-bold text-black">
              You approve every move
            </h3>
            <p className="mt-3 font-landing text-[14px] leading-relaxed text-[#4b5563]">
              Execute, Defer, or Skip from Telegram or the dashboard. Nothing
              runs until you tap — full control, full reasoning chain visible.
            </p>
          </div>
          <div className="bg-gradient-to-br from-[#e8f4fd] to-white p-8 sm:p-10 lg:p-12">
            <span className="inline-block bg-[#3dcc4e]/20 px-3 py-1 font-landing text-[11px] font-semibold text-[#166534]">
              Delegated
            </span>
            <h3 className="mt-4 font-serif text-xl font-bold text-black">
              Agent runs autonomously
            </h3>
            <p className="mt-3 font-landing text-[14px] leading-relaxed text-[#4b5563]">
              Delegate approval within policy guardrails. Harvest, park, and
              rebalance fire automatically — you always get a receipt.
            </p>
          </div>
        </div>
      </section>

      {/* Reachable via — compact row */}
      <section className="landing-card-sharp overflow-hidden border border-[#e5e7eb] bg-white shadow-[0_4px_24px_rgba(0,0,0,0.05)]">
        <div className="landing-grid-line border-b px-6 py-6 sm:px-10 sm:py-8 lg:px-12">
          <p className="font-landing text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b7280]">
            Reachable anywhere
          </p>
        </div>
        <div className="grid sm:grid-cols-3">
          {[
            {
              title: "Web dashboard",
              desc: "Register, monitor, approve actions.",
            },
            {
              title: "Telegram bot",
              desc: "Onboard, notify, inline Execute / Defer / Skip.",
            },
            {
              title: "MCP / OpenClaw",
              desc: "Bring your agent — taxee_scan & approve tools.",
            },
          ].map((item, i) => (
            <div
              key={item.title}
              className={cn(
                "landing-grid-line border-b p-7 sm:border-b-0 sm:p-8 lg:p-10",
                i > 0 && "sm:border-l",
              )}
            >
              <h3 className="font-landing text-[15px] font-semibold text-black">
                {item.title}
              </h3>
              <p className="mt-1.5 font-landing text-[13px] text-[#6b7280]">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA footer card */}
      <section
        id="contact"
        className="landing-card-sharp overflow-hidden border border-[#1f2937] bg-[#111827] shadow-[0_4px_24px_rgba(0,0,0,0.12)]"
      >
        <div className="flex flex-col items-start justify-between gap-8 px-8 py-12 sm:flex-row sm:items-center sm:px-10 lg:px-14 lg:py-16">
          <div>
            <h2 className="font-serif text-2xl font-bold text-white sm:text-3xl">
              Ready to optimize what you keep?
            </h2>
            <p className="mt-2 max-w-md font-landing text-[14px] text-[#9ca3af]">
              Register in two minutes. Watch tier — address only, no seed phrase.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/onboarding"
              className="inline-flex items-stretch overflow-hidden bg-white font-landing text-[14px] font-medium text-black"
            >
              <span className="px-6 py-3">Get Started Now</span>
              <span className="flex w-12 items-center justify-center bg-[#3dcc4e]">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="#111827"
                  strokeWidth="2.2"
                >
                  <path d="M5 10h10M11 6l4 4-4 4" />
                </svg>
              </span>
            </Link>
            <Link
              href="/dashboard/demo"
              className="border border-[#374151] px-6 py-3 font-landing text-[14px] font-medium text-white hover:bg-[#1f2937]"
            >
              View demo
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
