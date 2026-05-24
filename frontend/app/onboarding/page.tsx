"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ApprovalSettings, UserPolicy } from "@/lib/types";
import { defaultApproval, defaultPolicy, DEMO_WALLET } from "@/lib/mock-data";
import { ApprovalModePicker } from "@/components/onboarding/approval-mode-picker";
import { OnboardingTopBar } from "@/components/onboarding/onboarding-topbar";
import { registerAgent } from "@/lib/agent-store";
import { Button } from "@/components/ui/button";
import { truncateAddress } from "@/lib/utils";

type Step = "wallet" | "import" | "policy" | "done";

const STEP_ORDER: Step[] = ["wallet", "import", "policy", "done"];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("wallet");
  const [wallet, setWallet] = useState("");
  const [importing, setImporting] = useState(false);
  const [policy, setPolicy] = useState<UserPolicy>({ ...defaultPolicy });
  const [approval, setApproval] = useState<ApprovalSettings>({
    ...defaultApproval,
  });
  const [agentId, setAgentId] = useState<string | null>(null);

  const walletValid = /^0x[a-fA-F0-9]{40}$/.test(wallet.trim());

  const currentStepNumber = STEP_ORDER.indexOf(step) + 1;

  async function runImport() {
    if (!walletValid) return;
    setImporting(true);
    await new Promise((r) => setTimeout(r, 1200));
    setImporting(false);
    setStep("policy");
  }

  function finishOnboarding() {
    const agent = registerAgent(wallet.trim(), policy, approval);
    setAgentId(agent.id);
    setStep("done");
  }

  return (
    <div className="landing-root landing-marble-bg relative min-h-screen">
      <div className="landing-ambient" aria-hidden />
      <div className="relative z-[1] p-3 sm:p-5 lg:p-8">
        <div className="mx-auto max-w-[1320px] space-y-6 sm:space-y-8">
          <div className="landing-card-sharp landing-glass landing-animate-in overflow-hidden">
            <OnboardingTopBar currentStep={currentStepNumber} />

            <main className="landing-grid-line border-t border-[#e5e7eb] bg-white/50 px-6 py-10 dark:border-[#1f2937] dark:bg-[#0b0f19]/50 sm:px-8 sm:py-12 lg:px-12 lg:py-16">
              <div className="mx-auto max-w-lg">
                {step === "wallet" && (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <h2 className="font-serif text-2xl font-bold text-black dark:text-[#f9fafb]">
                        Connect wallet
                      </h2>
                      <p className="font-landing text-sm leading-relaxed text-[#6b7280] dark:text-[#9ca3af]">
                        Watch tier only — paste a public address. We never ask
                        for a seed phrase or private key.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <input
                        type="text"
                        placeholder="0x…"
                        value={wallet}
                        onChange={(e) => setWallet(e.target.value)}
                        className="w-full rounded-lg border border-[#e5e7eb] bg-white px-4 py-3 font-mono text-sm text-[#111827] placeholder:text-[#9ca3af] focus:border-[#3dcc4e] focus:outline-none focus:ring-1 focus:ring-[#3dcc4e]/30 dark:border-[#1f2937] dark:bg-[#111827] dark:text-[#f9fafb]"
                      />
                      <button
                        type="button"
                        onClick={() => setWallet(DEMO_WALLET)}
                        className="text-xs text-[#6b7280] underline hover:text-[#111827] dark:text-[#9ca3af] dark:hover:text-[#f9fafb]"
                      >
                        Use demo wallet ({truncateAddress(DEMO_WALLET)})
                      </button>
                    </div>

                    <button
                      type="button"
                      disabled={!walletValid}
                      onClick={() => setStep("import")}
                      className="group inline-flex w-full items-stretch overflow-hidden bg-black shadow-[0_4px_16px_rgba(0,0,0,0.12)] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#f9fafb] dark:shadow-none"
                    >
                      <span className="flex flex-1 items-center justify-center px-6 py-3.5 font-landing text-[14px] font-medium text-white dark:text-[#111827]">
                        Continue
                      </span>
                      <span className="flex w-[52px] items-center justify-center bg-[#374151] transition-colors group-hover:bg-[#4b5563] group-disabled:bg-zinc-400 dark:bg-[#4b5563] dark:group-hover:bg-[#6b7280]">
                        <svg
                          className="landing-cta-arrow"
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
                    </button>
                  </div>
                )}

                {step === "import" && (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <h2 className="font-serif text-2xl font-bold text-black dark:text-[#f9fafb]">
                        Import history
                      </h2>
                      <p className="font-landing text-sm leading-relaxed text-[#6b7280] dark:text-[#9ca3af]">
                        Read-only scan on Base, Ethereum, and Arbitrum — no keys
                        required.
                      </p>
                    </div>

                    {importing ? (
                      <div className="rounded-lg border border-[#e5e7eb] bg-white p-8 text-center dark:border-[#1f2937] dark:bg-[#111827]">
                        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-[#6b7280] border-t-transparent dark:border-[#9ca3af]" />
                        <p className="font-landing text-sm text-[#6b7280] dark:text-[#9ca3af]">
                          Importing transfers and reconstructing lots…
                        </p>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={runImport}
                          className="group inline-flex w-full items-stretch overflow-hidden bg-black shadow-[0_4px_16px_rgba(0,0,0,0.12)] dark:bg-[#f9fafb] dark:shadow-none"
                        >
                          <span className="flex flex-1 items-center justify-center px-6 py-3.5 font-landing text-[14px] font-medium text-white dark:text-[#111827]">
                            Run onchain import
                          </span>
                      <span className="flex w-[52px] items-center justify-center bg-[#374151] transition-colors group-hover:bg-[#4b5563] dark:bg-[#4b5563] dark:group-hover:bg-[#6b7280]">
                            <svg
                              className="landing-cta-arrow"
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
                        </button>
                        <p className="text-center text-xs text-[#9ca3af]">
                          Expect ~4 positions and 12 provisional lots for demo
                          wallets
                        </p>
                      </>
                    )}
                  </div>
                )}

                {step === "policy" && (
                  <div className="space-y-6">
                    <div className="rounded-lg border border-[#3dcc4e]/30 bg-[#3dcc4e]/5 p-4 dark:bg-[#3dcc4e]/10">
                      <p className="font-landing text-sm text-[#111827] dark:text-[#f9fafb]">
                        Found 4 positions, 12 lots (provisional)
                      </p>
                      <p className="mt-1 font-landing text-sm font-medium text-[#3dcc4e]">
                        Est. YTD realized gains: $8,400
                      </p>
                    </div>

                    <div className="space-y-2">
                      <h2 className="font-serif text-2xl font-bold text-black dark:text-[#f9fafb]">
                        Preferences
                      </h2>
                      <p className="font-landing text-sm text-[#6b7280] dark:text-[#9ca3af]">
                        Configure how your taxee agent manages your portfolio.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <label className="block space-y-2">
                        <span className="font-landing text-sm font-medium text-[#111827] dark:text-[#f9fafb]">
                          Jurisdiction
                        </span>
                        <select
                          value={policy.jurisdiction}
                          onChange={(e) =>
                            setPolicy({
                              ...policy,
                              jurisdiction: e.target
                                .value as UserPolicy["jurisdiction"],
                            })
                          }
                          className="w-full rounded-lg border border-[#e5e7eb] bg-white px-3 py-2.5 font-landing text-sm text-[#111827] focus:border-[#3dcc4e] focus:outline-none focus:ring-1 focus:ring-[#3dcc4e]/30 dark:border-[#1f2937] dark:bg-[#111827] dark:text-[#f9fafb]"
                        >
                          <option value="US">United States</option>
                          <option value="OTHER">Other</option>
                        </select>
                      </label>

                      <label className="block space-y-2">
                        <span className="font-landing text-sm font-medium text-[#111827] dark:text-[#f9fafb]">
                          Harvest when loss exceeds
                        </span>
                        <select
                          value={policy.harvestThresholdPct}
                          onChange={(e) =>
                            setPolicy({
                              ...policy,
                              harvestThresholdPct: Number(e.target.value),
                            })
                          }
                          className="w-full rounded-lg border border-[#e5e7eb] bg-white px-3 py-2.5 font-landing text-sm text-[#111827] focus:border-[#3dcc4e] focus:outline-none focus:ring-1 focus:ring-[#3dcc4e]/30 dark:border-[#1f2937] dark:bg-[#111827] dark:text-[#f9fafb]"
                        >
                          <option value={5}>5%</option>
                          <option value={8}>8%</option>
                          <option value={10}>10%</option>
                        </select>
                      </label>

                      <ApprovalModePicker value={approval} onChange={setApproval} />

                      <label className="block space-y-2">
                        <span className="font-landing text-sm font-medium text-[#111827] dark:text-[#f9fafb]">
                          Goal
                        </span>
                        <textarea
                          defaultValue="Minimize taxes this year. Don't sell lots within 30 days of long-term threshold."
                          rows={3}
                          className="w-full rounded-lg border border-[#e5e7eb] bg-white px-3 py-2.5 font-landing text-sm text-[#111827] focus:border-[#3dcc4e] focus:outline-none focus:ring-1 focus:ring-[#3dcc4e]/30 dark:border-[#1f2937] dark:bg-[#111827] dark:text-[#f9fafb]"
                          readOnly
                        />
                        <span className="block text-xs text-[#9ca3af]">
                          LLM Goal Parser will map this on backend (demo: static
                          policy)
                        </span>
                      </label>
                    </div>

                    <button
                      type="button"
                      onClick={finishOnboarding}
                      className="group inline-flex w-full items-stretch overflow-hidden bg-black shadow-[0_4px_16px_rgba(0,0,0,0.12)] dark:bg-[#f9fafb] dark:shadow-none"
                    >
                      <span className="flex flex-1 items-center justify-center px-6 py-3.5 font-landing text-[14px] font-medium text-white dark:text-[#111827]">
                        Activate agent
                      </span>
                      <span className="flex w-[52px] items-center justify-center bg-[#3dcc4e] transition-colors group-hover:bg-[#34b844]">
                        <svg
                          className="landing-cta-arrow"
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
                    </button>
                  </div>
                )}

                {step === "done" && agentId && (
                  <div className="space-y-6 text-center">
                    <div className="rounded-xl border border-[#3dcc4e]/30 bg-[#3dcc4e]/10 p-8">
                      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#3dcc4e]">
                        <svg
                          width="32"
                          height="32"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="white"
                          strokeWidth="3"
                        >
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      </div>
                      <p className="font-serif text-xl font-bold text-[#111827] dark:text-[#f9fafb]">
                        Agent active
                      </p>
                      <p className="mt-2 font-landing text-sm text-[#6b7280] dark:text-[#9ca3af]">
                        Heartbeat every 60 minutes ·{" "}
                        {approval.mode === "delegated"
                          ? "delegated (autonomous within policy)"
                          : "manual (you approve each action)"}
                      </p>
                      <p className="mt-4 font-mono text-xs text-[#9ca3af]">
                        {agentId}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => router.push(`/dashboard/${agentId}`)}
                      className="group inline-flex w-full items-stretch overflow-hidden bg-black shadow-[0_4px_16px_rgba(0,0,0,0.12)] dark:bg-[#f9fafb] dark:shadow-none"
                    >
                      <span className="flex flex-1 items-center justify-center px-6 py-3.5 font-landing text-[14px] font-medium text-white dark:text-[#111827]">
                        Open dashboard
                      </span>
                      <span className="flex w-[52px] items-center justify-center bg-[#3dcc4e] transition-colors group-hover:bg-[#34b844]">
                        <svg
                          className="landing-cta-arrow"
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
                    </button>
                  </div>
                )}
              </div>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
