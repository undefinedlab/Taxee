import Link from "next/link";
import { DashboardShowcase } from "@/components/landing/dashboard-showcase";
import { TaxComparisonChart } from "@/components/landing/tax-comparison-chart";

import { ApprovalModesPanel } from "@/components/landing/approval-modes-panel";
import { SectionIcon } from "@/components/landing/section-icon";
import { HowItWorksStep } from "@/components/landing/how-it-works-step";
import { LandingBandSection } from "@/components/landing/landing-band-section";
import { ValueCardsCarousel } from "@/components/landing/value-cards-carousel";
import {
  channels,
  cta,
  execution,
  howItWorks,
  problem,
  solution,
} from "@/components/landing/landing-content";
import { SectionHeader } from "@/components/landing/section-header";

export function LandingScrollSections() {
  return (
    <div className="mx-auto mt-10 max-w-[1320px] space-y-8 px-4 pb-24 sm:mt-12 sm:space-y-10 sm:px-5 lg:mt-14 lg:space-y-12 lg:px-8">
      <LandingBandSection id="problem" className="landing-scroll-band-tight">
        <div className="landing-scroll-hero-row landing-scroll-hero-row--tight !items-stretch">
          <SectionHeader
            layout="hero"
            label={problem.label}
            title={problem.title}
            description={problem.lead}
            className="order-1 lg:flex lg:flex-col lg:justify-center"
          />
          <div className="order-2 flex min-h-[320px] min-w-0 flex-col pt-8 lg:min-h-0 lg:self-stretch">
            <ValueCardsCarousel
              items={problem.bullets.map((item) => ({
                title: `"${item.title}"`,
                description: item.body,
              }))}
              ariaLabel="Problem points"
              minimal={true}
            />
          </div>
        </div>
      </LandingBandSection>

      <LandingBandSection
        id="solution"
        className="landing-scroll-stack landing-scroll-band-tight !mt-16 sm:!mt-20 lg:!mt-24"
      >
        <div className="landing-scroll-hero-row landing-scroll-hero-row--tight">
          <div className="order-2 min-w-0 p-6 lg:order-1 lg:p-10">
            <TaxComparisonChart />
          </div>
          <SectionHeader
            layout="heroRight"
            label={solution.label}
            title={solution.title}
            description={solution.lead}
            className="order-1 lg:order-2 lg:flex lg:flex-col lg:justify-start lg:pt-16"
          />
        </div>
        <div className="mt-10 grid gap-12 sm:grid-cols-3 sm:gap-14 lg:mt-12 lg:gap-20">
          {solution.items.map((item) => (
            <div key={item.title} className="flex flex-col text-center">
              <h3 className="font-landing text-2xl font-bold leading-snug tracking-tight text-black dark:text-[#f9fafb] sm:text-3xl">
                {item.title}
              </h3>
              <p className="mt-5 font-landing text-[15px] leading-[1.8] text-[#4b5563] dark:text-[#9ca3af]">
                {item.description}
              </p>
            </div>
          ))}
        </div>
        {solution.control ? (
          <p className="mx-auto max-w-2xl text-center font-landing text-[14px] leading-[1.75] text-[#6b7280] dark:text-[#9ca3af]">
            {solution.control}
          </p>
        ) : null}
      </LandingBandSection>

      <section id="execution" className="pb-10 pt-3 sm:pb-12 sm:pt-4 lg:pb-14 lg:pt-5">
        <p className="mb-3 text-center font-landing text-[11px] font-bold uppercase tracking-[0.14em] text-[#9ca3af]/70 dark:text-[#6b7280]/70">
          Execution via Circle stack
        </p>
        <div className="relative mt-20 overflow-hidden">

          <div className="animate-marquee flex gap-8 hover:[animation-play-state:paused]">
            {[...execution.items, ...execution.items, ...execution.items].map((item, index) => (
              <div
                key={`${item.title}-${index}`}
                className="flex w-[280px] shrink-0 flex-col items-center text-center px-4"
              >
                <SectionIcon
                  name={item.icon}
                  variant="plain"
                  className="mb-5 h-20 w-20 [&_svg]:h-12 [&_svg]:w-12"
                />
                <h3 className="font-landing text-[15px] font-semibold text-black dark:text-[#f9fafb]">
                  {item.title}
                </h3>
                <p className="mt-2 font-landing text-[13px] leading-[1.65] text-[#4b5563] dark:text-[#9ca3af]">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <LandingBandSection id="how-it-works" className="!py-12 sm:!py-16 lg:!py-20">
        {/* How It Works Section */}
        <SectionHeader
          layout="centered"
          label={howItWorks.label}
          title={howItWorks.title}
          className="!mb-4 !max-w-4xl [&_h2]:text-3xl [&_h2]:sm:text-4xl [&_h2]:lg:text-5xl"
        />
        <div className="grid gap-10 sm:grid-cols-2 sm:gap-12 lg:grid-cols-3 lg:gap-14">
          {howItWorks.phases.map((phase) => (
            <HowItWorksStep
              key={phase.title}
              phase={phase.phase}
              icon={phase.icon}
              title={phase.title}
              description={phase.description}
            />
          ))}
        </div>

        {/* Control Section */}
        <div className="mt-10 sm:mt-14 lg:mt-16">
          <ApprovalModesPanel
            label={execution.modes.label}
            title={execution.modes.title}
            lead="Same opportunity flow — you choose whether to confirm each move or delegate within guardrails."
            manual={{
              tag: execution.modes.manual.tag,
              title: execution.modes.manual.title,
              description: execution.modes.manual.description,
              flow: execution.modes.manual.flow,
              bestFor: execution.modes.manual.bestFor,
            }}
            automatic={{
              tag: execution.modes.delegated.tag,
              title: execution.modes.delegated.title,
              description: execution.modes.delegated.description,
              flow: execution.modes.delegated.flow,
              bestFor: execution.modes.delegated.bestFor,
            }}
            defaultMode="automatic"
          />
        </div>
      </LandingBandSection>

      {/* Platforms Section - Detached */}
      <section id="platforms" className="py-12 sm:py-16 lg:py-20">
        <SectionHeader
          layout="centered"
          label="Platforms"
          title="Reachable where you already work"
          className="!mb-10"
        />
        <div className="mx-auto grid max-w-4xl gap-5 sm:grid-cols-3 sm:gap-8">
          {channels.map((item) => (
            <div
              key={item.title}
              className="rounded-xl border border-white/40 bg-gradient-to-br from-white/80 via-white/50 to-gray-100/60 px-5 py-6 text-center shadow-sm backdrop-blur-xl transition-all duration-300 hover:border-white/60 hover:shadow-md dark:border-white/10 dark:from-gray-800/60 dark:via-gray-900/40 dark:to-black/50"
            >
              <p className="font-landing text-xl font-bold tracking-tight text-black dark:text-white">
                {item.title}
              </p>
              <p className="mt-3 font-landing text-[13px] leading-[1.7] text-gray-600 dark:text-gray-300">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      <LandingBandSection id="contact" className="!py-10 sm:!py-12 lg:!py-14">
        <div className="landing-scroll-cta-grid">
          <div className="max-w-xl">
            <p className="font-landing text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7280] dark:text-[#9ca3af]">
              {cta.eyebrow}
            </p>
            <h2 className="mt-3 font-serif text-[2rem] font-bold leading-[1.08] tracking-tight text-black dark:text-[#f9fafb] sm:text-[2.5rem] lg:text-[2.85rem] xl:text-[3.1rem]">
              {cta.title}
            </h2>
            <p className="mt-5 max-w-lg font-landing text-base leading-[1.75] text-[#4b5563] dark:text-[#9ca3af] sm:text-[17px]">
              {cta.subtitle}
            </p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
              <Link
                href="/onboarding"
                className="group inline-flex items-stretch overflow-hidden bg-black shadow-[0_6px_24px_rgba(0,0,0,0.14)] dark:bg-[#f9fafb] dark:shadow-none"
              >
                <span className="flex flex-col justify-center px-7 py-4 sm:px-8">
                  <span className="font-landing text-[15px] font-semibold text-white dark:text-[#111827] sm:text-base">
                    {cta.primary}
                  </span>
                  <span className="mt-0.5 font-landing text-[11px] font-medium text-white/70 dark:text-[#111827]/65">
                    {cta.primaryHint}
                  </span>
                </span>
                <span className="flex w-14 items-center justify-center bg-[#3dcc4e] transition-colors group-hover:bg-[#34b844] sm:w-16">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="#111827"
                    strokeWidth="2.2"
                    aria-hidden
                  >
                    <path d="M5 10h10M11 6l4 4-4 4" />
                  </svg>
                </span>
              </Link>
              <Link
                href="/dashboard/demo"
                className="font-landing text-[15px] font-medium text-black underline-offset-4 hover:underline dark:text-[#f9fafb] sm:px-2"
              >
                {cta.secondary}
              </Link>
            </div>
          </div>
          <div className="landing-scroll-cta-deco min-h-[12rem] sm:min-h-[14rem]" aria-hidden>
            <DashboardShowcase />
          </div>
        </div>
      </LandingBandSection>
    </div>
  );
}
