import Link from "next/link";
import { FeatureCard } from "@/components/landing/feature-card";
import {
  approvalModes,
  channels,
  cta,
  execution,
  features,
  howItWorks,
  problem,
  solution,
} from "@/components/landing/landing-content";
import { SectionHeader } from "@/components/landing/section-header";
import { cn } from "@/lib/utils";

const cardShell = "landing-card-sharp landing-glass";

export function LandingScrollSections() {
  return (
    <div className="mx-auto mt-10 max-w-[1320px] space-y-6 pb-16 sm:mt-12 sm:space-y-8 lg:space-y-10">
      {/* Problem */}
      <section id="problem" className={cardShell}>
        <SectionHeader
          label={problem.label}
          title={problem.title}
          description={problem.lead}
        />
        <div className="grid divide-y divide-white/40 dark:divide-white/10 md:grid-cols-3 md:divide-x md:divide-y-0">
          {problem.bullets.map((item) => (
            <div
              key={item.title}
              className="landing-glass-cell px-6 py-8 sm:px-10 sm:py-10 lg:px-12 lg:py-12"
            >
              <h3 className="font-landing text-lg font-semibold text-black dark:text-[#f9fafb]">
                {item.title}
              </h3>
              <p className="mt-3 font-landing text-[14px] leading-relaxed text-[#4b5563] dark:text-[#9ca3af]">
                {item.body}
              </p>
            </div>
          ))}
        </div>
        <p className="landing-grid-line border-t px-6 py-6 font-landing text-[14px] font-medium text-[#1f2937] dark:text-[#e5e7eb] sm:px-10 lg:px-12">
          {problem.closing}
        </p>
      </section>

      {/* Solution — decision matrix */}
      <section id="solution" className={cardShell}>
        <SectionHeader
          label={solution.label}
          title={solution.title}
          description={solution.lead}
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse font-landing text-left text-[14px]">
            <thead>
              <tr className="landing-grid-line border-b landing-glass-cell">
                <th className="px-6 py-4 font-semibold text-black dark:text-[#f9fafb] sm:px-10 lg:px-12">
                  Decision
                </th>
                <th className="px-6 py-4 font-semibold text-black dark:text-[#f9fafb] sm:pr-10 lg:pr-12">
                  Tax-aware behavior
                </th>
              </tr>
            </thead>
            <tbody>
              {solution.decisions.map((row, i) => (
                <tr
                  key={row.decision}
                  className={cn(
                    "landing-grid-line border-b last:border-b-0",
                    i % 2 === 1 && "landing-glass-cell",
                  )}
                >
                  <td className="px-6 py-4 font-semibold text-black dark:text-[#f9fafb] sm:px-10 lg:px-12">
                    <span className="mr-2 inline-block h-2 w-2 bg-[#3dcc4e]" />
                    {row.decision}
                  </td>
                  <td className="px-6 py-4 text-[#4b5563] dark:text-[#9ca3af] sm:pr-10 lg:pr-12">
                    {row.behavior}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="landing-grid-line border-t px-6 py-6 font-landing text-[13px] text-[#6b7280] dark:text-[#9ca3af] sm:px-10 lg:px-12">
          {solution.control}
        </p>
      </section>

      {/* How it works */}
      <section id="how-it-works" className={cardShell}>
        <SectionHeader
          label={howItWorks.label}
          title={howItWorks.title}
        />
        <div className="grid divide-y divide-white/40 dark:divide-white/10 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {howItWorks.phases.map((phase) => (
            <FeatureCard
              key={phase.title}
              className="!border-0"
              tag={phase.tag}
              title={phase.title}
              description={phase.description}
              metric={"metric" in phase ? phase.metric : undefined}
              metricLabel={"metricLabel" in phase ? phase.metricLabel : undefined}
              accent={
                phase.title === "Heartbeat"
                  ? "blue"
                  : phase.title === "Onboarding"
                    ? "both"
                    : "green"
              }
              href={"href" in phase ? phase.href : undefined}
            />
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className={cardShell}>
        <SectionHeader label={features.label} title={features.title} />
        <div className="grid divide-y divide-white/40 dark:divide-white/10 md:grid-cols-2 md:divide-x md:divide-y-0">
          {features.items.map((item, i) => (
            <FeatureCard
              key={item.title}
              className={cn("!border-0", i >= 2 && "md:border-t")}
              tag={item.tag}
              title={item.title}
              description={item.description}
              metric={"metric" in item ? item.metric : undefined}
              metricLabel={"metricLabel" in item ? item.metricLabel : undefined}
              accent={item.accent}
              href={"href" in item ? item.href : undefined}
            />
          ))}
        </div>
      </section>

      {/* Circle execution */}
      <section id="execution" className={cardShell}>
        <SectionHeader label={execution.label} title={execution.title} />
        <div className="grid divide-y divide-white/40 dark:divide-white/10 lg:grid-cols-3 lg:divide-x lg:divide-y-0">
          {execution.items.map((item) => (
            <FeatureCard
              key={item.title}
              className="!border-0"
              title={item.title}
              description={item.description}
              accent={item.accent}
            />
          ))}
        </div>
      </section>

      {/* Approval modes */}
      <section id="approval" className={cardShell}>
        <SectionHeader
          label="Control"
          title="Manual approval or delegated — your choice"
        />
        <div className="grid md:grid-cols-2">
          {approvalModes.map((mode) => (
            <div
              key={mode.tag}
              className={cn(
                "p-8 sm:p-10 lg:p-12",
                mode.variant === "neutral"
                  ? "landing-grid-line landing-glass-cell border-b md:border-b-0 md:border-r"
                  : "landing-glass-accent",
              )}
            >
              <span
                className={cn(
                  "inline-block px-3 py-1 font-landing text-[11px] font-semibold",
                  mode.variant === "highlight"
                    ? "bg-[#3dcc4e]/20 text-[#166534] dark:text-[#86efac]"
                    : "bg-[#f3f4f6] text-black dark:bg-[#1f2937] dark:text-[#f9fafb]",
                )}
              >
                {mode.tag}
              </span>
              <h3 className="mt-4 font-serif text-xl font-bold text-black dark:text-[#f9fafb]">
                {mode.title}
              </h3>
              <p className="mt-3 font-landing text-[14px] leading-relaxed text-[#4b5563] dark:text-[#9ca3af]">
                {mode.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Channels */}
      <section className={cardShell}>
        <SectionHeader
          label="Access"
          title="Reachable where you already work"
        />
        <div className="grid sm:grid-cols-3">
          {channels.map((item, i) => (
            <div
              key={item.title}
              className={cn(
                "landing-grid-line landing-glass-cell border-b p-7 sm:border-b-0 sm:p-8 lg:p-10",
                i > 0 && "sm:border-l",
              )}
            >
              <h3 className="font-landing text-[15px] font-semibold text-black dark:text-[#f9fafb]">
                {item.title}
              </h3>
              <p className="mt-1.5 font-landing text-[13px] text-[#6b7280] dark:text-[#9ca3af]">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section
        id="contact"
        className="landing-card-sharp landing-glass-cta"
      >
        <div className="flex flex-col items-start justify-between gap-8 px-8 py-12 sm:flex-row sm:items-center sm:px-10 lg:px-14 lg:py-16">
          <div>
            <h2 className="font-serif text-2xl font-bold text-white sm:text-3xl">
              {cta.title}
            </h2>
            <p className="mt-2 max-w-md font-landing text-[14px] leading-relaxed text-[#9ca3af]">
              {cta.subtitle}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/onboarding"
              className="landing-glass-btn inline-flex items-stretch overflow-hidden rounded-lg font-landing text-[14px] font-medium text-[#111827]"
            >
              <span className="px-6 py-3">{cta.primary}</span>
              <span className="flex w-12 items-center justify-center bg-[#3dcc4e]">
                <svg
                  width="18"
                  height="18"
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
              className="border border-[#374151] px-6 py-3 font-landing text-[14px] font-medium text-white transition-colors hover:bg-[#1f2937]"
            >
              {cta.secondary}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
