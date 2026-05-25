"use client";

import Link from "next/link";
import { useState } from "react";
import { DashboardShowcase } from "@/components/landing/dashboard-showcase";
import { TaxComparisonChart } from "@/components/landing/tax-comparison-chart";

import { ApprovalModesPanel } from "@/components/landing/approval-modes-panel";
import { SectionIcon } from "@/components/landing/section-icon";
import { HowItWorksStep } from "@/components/landing/how-it-works-step";
import { LandingBandSection } from "@/components/landing/landing-band-section";
import {
  cta,
  execution,
  howItWorks,
  problem,
  solution,
} from "@/components/landing/landing-content";
import { SectionHeader } from "@/components/landing/section-header";
import { cn } from "@/lib/utils";

export function LandingScrollSections() {
  const [selectedPlatform, setSelectedPlatform] = useState<"web" | "telegram" | "mcp">("web");

  return (
    <div className="mx-auto mt-10 max-w-[1320px] space-y-8 px-4 pb-24 sm:mt-12 sm:space-y-10 sm:px-5 lg:mt-14 lg:space-y-12 lg:px-8">
      <LandingBandSection id="problem" className="landing-scroll-band-tight">
        <div className="mx-auto max-w-5xl">
          <SectionHeader
            layout="centered"
            label={problem.label}
            title={problem.title}
            description={problem.lead}
            className="!mb-12"
          />
          {/* 3 Problem Cards - No border, no background */}
          <div className="grid gap-12 sm:grid-cols-3 sm:gap-8 lg:gap-12">
            {problem.bullets.map((item, index) => (
              <div key={item.title} className="text-center">
                <h3 className="font-landing text-3xl font-bold tracking-tight text-black dark:text-[#f9fafb] sm:text-4xl">
                  {item.title}
                </h3>
                <p className="mt-3 font-landing text-[14px] leading-[1.7] text-[#4b5563] dark:text-[#9ca3af]">
                  {item.body}
                </p>
              </div>
            ))}
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
              title={phase.title}
              description={phase.description}
            />
          ))}
        </div>
      </LandingBandSection>

      {/* Control Section - No background */}
      <section id="approval" className="py-12 sm:py-16 lg:py-20">
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
      </section>

      <LandingBandSection id="contact" className="!py-10 sm:!py-12 lg:!py-14">
        <div className="mx-auto max-w-5xl">
          {/* Header */}
          <div className="text-center mb-12 mx-auto max-w-3xl">
            <p className="font-landing text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7280] dark:text-[#9ca3af]">
              {cta.eyebrow}
            </p>
            <h2 className="mt-3 font-serif text-[2rem] font-bold leading-[1.08] tracking-tight text-black dark:text-[#f9fafb] sm:text-[2.5rem] lg:text-[2.85rem] xl:text-[3.1rem]">
              {cta.title}
            </h2>
            <p className="mt-4 font-landing text-[16px] text-[#4b5563] dark:text-[#9ca3af]">
              {cta.subtitle}
            </p>
          </div>

          {/* Platform Selector */}
          <div className="mt-24 grid gap-8 lg:grid-cols-[280px_500px] lg:gap-16 items-start justify-center">
            {/* Left: Platform Toggle - Glassmorphic Cards - Pushed down */}
            <div className="flex flex-col gap-3 pt-8">
              {(Object.keys(cta.platforms) as Array<keyof typeof cta.platforms>).map((key) => (
                <button
                  key={key}
                  onClick={() => setSelectedPlatform(key)}
                  className={cn(
                    "group relative overflow-hidden rounded-2xl border px-5 py-4 text-left transition-all duration-300 backdrop-blur-md",
                    selectedPlatform === key
                      ? "border-white/60 bg-white/40 shadow-lg dark:border-white/20 dark:bg-white/10"
                      : "border-white/20 bg-white/10 hover:border-white/40 hover:bg-white/20 dark:border-white/5 dark:bg-white/5"
                  )}
                >
                  {/* Shine effect */}
                  <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                  <p className="relative font-landing text-base font-semibold tracking-tight text-black dark:text-white">
                    {cta.platforms[key].title}
                  </p>
                  {/* Active indicator */}
                  {selectedPlatform === key && (
                    <div className="absolute right-3 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-landing-active" />
                  )}
                </button>
              ))}
            </div>

            {/* Right: Platform Details - Fixed height container */}
            <div className="h-[320px] relative -mt-12">
              {/* Web */}
              {selectedPlatform === 'web' && (
                <div className="h-full flex flex-col justify-center space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                  <p className="font-landing text-lg leading-[1.7] text-[#374151] dark:text-[#d1d5db]">
                    {cta.platforms.web.description}
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <Link
                      href={cta.platforms.web.href}
                      className="group inline-flex items-center justify-center gap-2 rounded-xl bg-black px-8 py-4 font-landing text-[15px] font-semibold text-white transition-all hover:bg-gray-800 hover:scale-105 dark:bg-white dark:text-black dark:hover:bg-gray-200"
                    >
                      {cta.platforms.web.cta}
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 20 20"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="transition-transform group-hover:translate-x-1"
                      >
                        <path d="M5 10h10M11 6l4 4-4 4" />
                      </svg>
                    </Link>
                    <Link
                      href="/dashboard"
                      className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-[#e5e7eb] px-8 py-4 font-landing text-[15px] font-medium text-black transition-all hover:bg-[#f9fafb] hover:border-[#d1d5db] dark:border-[#2a2a2a] dark:text-white dark:hover:bg-[#1a1a1a]"
                    >
                      Go to Dashboard
                    </Link>
                  </div>
                </div>
              )}

              {/* Telegram */}
              {selectedPlatform === 'telegram' && (
                <div className="h-full flex flex-col justify-center space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                  <p className="font-landing text-lg leading-[1.7] text-[#374151] dark:text-[#d1d5db]">
                    {cta.platforms.telegram.description}
                  </p>
                  <div className="space-y-4">
                    <p className="font-landing text-[14px] text-[#6b7280] dark:text-[#9ca3af]">
                      Start chatting with:
                    </p>
                    <a
                      href={cta.platforms.telegram.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group inline-flex items-center gap-4 rounded-2xl bg-[#0088cc]/10 px-8 py-5 transition-all hover:bg-[#0088cc]/20 hover:scale-105"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#0088cc]">
                        <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                        </svg>
                      </div>
                      <div>
                        <span className="block font-landing text-[13px] text-[#6b7280] dark:text-[#9ca3af]">Telegram Bot</span>
                        <span className="font-landing text-[18px] font-bold text-[#0088cc]">
                          @taxee_bot
                        </span>
                      </div>
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 20 20"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="text-[#0088cc] transition-transform group-hover:translate-x-1 ml-2"
                      >
                        <path d="M5 10h10M11 6l4 4-4 4" />
                      </svg>
                    </a>
                  </div>
                </div>
              )}

              {/* MCP */}
              {selectedPlatform === 'mcp' && (
                <div className="h-full flex flex-col justify-center space-y-6 animate-in fade-in slide-in-from-right-4 duration-300 overflow-hidden">
                  <p className="font-landing text-lg leading-[1.7] text-[#374151] dark:text-[#d1d5db]">
                    {cta.platforms.mcp.description}
                  </p>
                  <div className="space-y-3">
                  
                    <div className="relative rounded-2xl bg-[#1e1e1e] p-5 shadow-2xl">
                      <div className="flex items-center gap-2 mb-3 border-b border-white/10 pb-2">
                        <div className="h-3 w-3 rounded-full bg-[#ff5f56]" />
                        <div className="h-3 w-3 rounded-full bg-[#ffbd2e]" />
                        <div className="h-3 w-3 rounded-full bg-[#27c93f]" />
                        <span className="ml-2 font-landing text-[11px] text-white/40">mcp.json</span>
                      </div>
                      <pre className="font-mono text-[12px] leading-relaxed text-[#d4d4d4] overflow-x-auto">
                        <code>{`{
  "mcpServers": {
    "taxee": {
      "command": "npx",
      "args": ["-y", "@taxee/mcp-server"],
      "env": {
        "TAXEE_API_KEY": "your-api-key"
      }
    }
  }
}`}</code>
                      </pre>
                      <button
                        onClick={() => navigator.clipboard.writeText(`{\n  "mcpServers": {\n    "taxee": {\n      "command": "npx",\n      "args": ["-y", "@taxee/mcp-server"],\n      "env": {\n        "TAXEE_API_KEY": "your-api-key"\n      }\n    }\n  }\n}`)}
                        className="absolute right-4 top-14 rounded-lg bg-white/10 px-3 py-1.5 font-landing text-[12px] text-white/70 transition-all hover:bg-white/20 hover:text-white"
                      >
                        Copy
                      </button>
                    </div>
                 
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </LandingBandSection>
    </div>
  );
}
