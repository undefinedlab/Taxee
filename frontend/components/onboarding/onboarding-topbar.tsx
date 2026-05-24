import Link from "next/link";
import { TaxeeLogo } from "@/components/landing/logo";
import { ThemeToggle } from "@/components/landing/theme-toggle";

interface OnboardingTopBarProps {
  currentStep: number;
  totalSteps?: number;
  stepLabels?: string[];
}

export function OnboardingTopBar({
  currentStep,
  totalSteps = 4,
  stepLabels = ["Wallet", "Import", "Policy", "Done"],
}: OnboardingTopBarProps) {
  return (
    <header className="landing-area-hero-topbar landing-grid-line flex flex-col border-b border-[#e5e7eb] dark:border-[#1f2937]">
      {/* Top row - Logo and theme */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 sm:gap-4 sm:px-5 lg:px-6">
        <Link href="/" className="shrink-0" aria-label="taxee home">
          <TaxeeLogo showWordmark />
        </Link>

        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />
        </div>
      </div>

      {/* Progress bar row */}
      <div className="px-4 py-3 sm:px-5 lg:px-6">
        <div className="flex items-center gap-2">
          {Array.from({ length: totalSteps }).map((_, index) => {
            const stepNumber = index + 1;
            const isActive = stepNumber === currentStep;
            const isCompleted = stepNumber < currentStep;
            const isPending = stepNumber > currentStep;

            return (
              <div key={index} className="flex items-center gap-2">
                {/* Step indicator */}
                <div
                  className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-[#111827] text-white dark:bg-[#f9fafb] dark:text-[#111827]"
                      : isCompleted
                        ? "bg-[#e5e7eb] text-[#374151] dark:bg-[#374151] dark:text-[#d1d5db]"
                        : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800"
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                      isActive
                        ? "bg-white text-[#111827] dark:bg-[#111827] dark:text-[#f9fafb]"
                        : isCompleted
                          ? "bg-[#6b7280] text-white dark:bg-[#9ca3af] dark:text-[#111827]"
                          : "bg-zinc-200 text-zinc-500 dark:bg-zinc-700"
                    }`}
                  >
                    {isCompleted ? "✓" : stepNumber}
                  </span>
                  <span className="hidden sm:inline">{stepLabels[index]}</span>
                </div>

                {/* Connector line */}
                {index < totalSteps - 1 && (
                  <div
                    className={`h-0.5 w-4 sm:w-8 ${
                      isCompleted
                        ? "bg-[#9ca3af] dark:bg-[#4b5563]"
                        : "bg-zinc-200 dark:bg-zinc-700"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </header>
  );
}
