"use client";

import { useState } from "react";
import { SectionIcon, type SectionIconName } from "@/components/landing/section-icon";
import { cn } from "@/lib/utils";

type ApprovalMode = {
  icon: SectionIconName;
  tag: string;
  title: string;
  description: string;
  flow: readonly string[];
  bestFor: readonly string[];
};

export function ApprovalModesPanel({
  label,
  title,
  lead,
  manual,
  automatic,
  defaultMode = "automatic",
}: {
  label: string;
  title: string;
  lead: string;
  manual: ApprovalMode;
  automatic: ApprovalMode;
  defaultMode?: "manual" | "automatic";
}) {
  const [mode, setMode] = useState<"manual" | "automatic">(defaultMode);
  const active = mode === "manual" ? manual : automatic;

  return (
    <div className="grid gap-8 lg:grid-cols-2 lg:items-start lg:gap-10 xl:gap-14">
      <div className="max-w-xl">
        <header>
          <p className="font-landing text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b7280] dark:text-[#9ca3af]">
            {label}
          </p>
          <h2 className="mt-3 font-serif text-2xl font-bold leading-tight text-black dark:text-[#f9fafb] sm:text-3xl lg:text-4xl">
            {title}
          </h2>
          <p className="mt-4 font-landing text-[15px] leading-[1.75] text-[#4b5563] dark:text-[#9ca3af]">
            {lead}
          </p>
        </header>

        <div
          className="mt-6 inline-flex w-fit rounded-xl border border-black/[0.08] bg-black/[0.04] p-1 dark:border-white/10 dark:bg-white/[0.06] sm:mt-8"
          role="tablist"
          aria-label="Approval mode"
        >
          {(
            [
              { id: "manual" as const, label: "Manual" },
              { id: "automatic" as const, label: "Automatic" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="tab"
              aria-selected={mode === opt.id}
              onClick={() => setMode(opt.id)}
              className={cn(
                "rounded-lg px-5 py-2.5 font-landing text-[13px] font-semibold transition-colors sm:px-6 sm:text-[14px]",
                mode === opt.id
                  ? "bg-black text-white shadow-sm dark:bg-[#f9fafb] dark:text-[#111827]"
                  : "text-[#6b7280] hover:text-black dark:text-[#9ca3af] dark:hover:text-[#f9fafb]",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <article
        key={mode}
        className="w-full lg:min-h-[280px] lg:pt-1"
        role="tabpanel"
      >
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-8">
          <SectionIcon
            name={active.icon}
            variant="plain"
            className="h-12 w-12 shrink-0 [&_svg]:h-7 [&_svg]:w-7 sm:h-14 sm:w-14 sm:[&_svg]:h-8 sm:[&_svg]:w-8"
          />
          <div className="min-w-0 flex-1">
            <span className="inline-block bg-[#f3f4f6] px-3 py-1 font-landing text-[11px] font-semibold text-black dark:bg-[#1f2937] dark:text-[#f9fafb]">
              {active.tag}
            </span>
            <h3 className="mt-4 font-landing text-xl font-semibold text-black dark:text-[#f9fafb] sm:text-2xl">
              {active.title}
            </h3>
            <p className="mt-3 font-landing text-[14px] leading-[1.7] text-[#4b5563] dark:text-[#9ca3af] sm:text-[15px]">
              {active.description}
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-2">
              <span className="font-landing text-[10px] font-bold uppercase tracking-[0.12em] text-[#9ca3af] dark:text-[#6b7280]">
                Flow
              </span>
              {active.flow.map((step, i) => (
                <span key={step} className="inline-flex items-center gap-2">
                  <span className="rounded-md bg-black/[0.05] px-2.5 py-1 font-landing text-[12px] font-medium text-black dark:bg-white/10 dark:text-[#f9fafb]">
                    {step}
                  </span>
                  {i < active.flow.length - 1 ? (
                    <span
                      className="text-[#9ca3af] dark:text-[#6b7280]"
                      aria-hidden
                    >
                      →
                    </span>
                  ) : null}
                </span>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <span className="w-full font-landing text-[10px] font-bold uppercase tracking-[0.12em] text-[#9ca3af] dark:text-[#6b7280] sm:mr-2 sm:w-auto sm:self-center">
                Best for
              </span>
              {active.bestFor.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-[#e5e7eb] px-3 py-1 font-landing text-[11px] text-[#4b5563] dark:border-[#374151] dark:text-[#9ca3af]"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}
