"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import type { ApprovalSettings, UserPolicy } from "@/lib/types";
import { defaultApproval, defaultPolicy } from "@/lib/mock-data";
import { ApprovalModePicker } from "@/components/onboarding/approval-mode-picker";
import { OnboardingTopBar } from "@/components/onboarding/onboarding-topbar";
import { registerAgent } from "@/lib/agent-store";
import { truncateAddress } from "@/lib/utils";
import { WalletOnboardingStep } from "@/components/wallet/wallet-onboarding-step";
import { useWalletData } from "@/hooks/use-wallet-data";

type Step = "wallet-input" | "wallet-connect" | "import" | "policy" | "done";

const STEP_ORDER: Step[] = ["wallet-input", "wallet-connect", "import", "policy", "done"];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("wallet-input");
  const [wallet, setWallet] = useState("");
  const [importing, setImporting] = useState(false);
  const [policy, setPolicy] = useState<UserPolicy>({ ...defaultPolicy });
  const [approval, setApproval] = useState<ApprovalSettings>({
    ...defaultApproval,
  });
  const [agentId, setAgentId] = useState<string | null>(null);
  const [goals, setGoals] = useState<string[]>([
    "Minimize taxes this year",
  ]);
  const [newGoal, setNewGoal] = useState("");

  const walletValid = /^0x[a-fA-F0-9]{40}$/.test(wallet.trim());
  
  // Get connected wallet address
  const { address: connectedAddress } = useAccount();
  const walletAddress = connectedAddress || wallet;
  
  // Fetch real wallet data
  const { positions, totalValueUsd, isLoading: walletLoading, error: walletError } = useWalletData(walletAddress);
  
  // Set importing state based on wallet loading
  useEffect(() => {
    if (step === "import" && walletLoading) {
      setImporting(true);
    } else if (step === "import" && !walletLoading) {
      setImporting(false);
    }
  }, [step, walletLoading]);

  const currentStepNumber = STEP_ORDER.indexOf(step) + 1;

  function goBack() {
    const currentIndex = STEP_ORDER.indexOf(step);
    if (currentIndex > 0) {
      setStep(STEP_ORDER[currentIndex - 1]);
    }
  }

  function addGoal() {
    if (newGoal.trim()) {
      setGoals([...goals, newGoal.trim()]);
      setNewGoal("");
    }
  }

  function removeGoal(index: number) {
    setGoals(goals.filter((_, i) => i !== index));
  }

  function finishOnboarding() {
    const agent = registerAgent(walletAddress || '', policy, approval);
    setAgentId(agent.id);
    setStep("done");
  }

  // Use real data from wallet
  const totalValue = totalValueUsd;
  // Note: cost basis requires historical data which needs more complex tracking
  const totalCostBasis = totalValueUsd * 0.9; // Estimate 10% gain for demo
  const totalUnrealizedPnl = totalCostBasis > 0 ? ((totalValue - totalCostBasis) / totalCostBasis) * 100 : 0;

  return (
    <div className="landing-root landing-marble-bg relative min-h-screen">
      <div className="landing-ambient" aria-hidden />
      <div className="relative z-[1] p-3 sm:p-5 lg:p-8">
        <div className="mx-auto max-w-[1320px] space-y-6 sm:space-y-8">
          <div className="landing-card-sharp landing-glass landing-animate-in overflow-hidden">
            <OnboardingTopBar currentStep={currentStepNumber} />

            <main className="landing-grid-line border-t border-[#e5e7eb] bg-white/50 px-6 py-10 dark:border-[#1f2937] dark:bg-[#0b0f19]/50 sm:px-8 sm:py-12 lg:px-12 lg:py-16">
              {/* Back button */}
              {step !== "wallet-input" && step !== "done" && (
                <div className="mb-6">
                  <button
                    type="button"
                    onClick={goBack}
                    className="inline-flex items-center gap-2 font-landing text-sm text-[#6b7280] transition-colors hover:text-[#111827] dark:text-[#9ca3af] dark:hover:text-[#f9fafb]"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 20 20"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M12 16l-4-4 4-4" />
                    </svg>
                    Back
                  </button>
                </div>
              )}

              <div className={step === "policy" ? "mx-auto max-w-6xl" : "mx-auto max-w-lg"}>
                {step === "wallet-input" && (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <h2 className="font-serif text-2xl font-bold text-black dark:text-[#f9fafb]">
                        Connect wallet
                      </h2>
                      <p className="font-landing text-sm leading-relaxed text-[#6b7280] dark:text-[#9ca3af]">
                        Choose how you want to connect your wallet to Taxee.
                      </p>
                    </div>

                    <div className="space-y-4">
                      {/* Option 1: Connect with Wallet (MetaMask, etc.) */}
                      <button
                        type="button"
                        onClick={() => setStep("wallet-connect")}
                        className="group w-full rounded-xl border border-[#e5e7eb] bg-white p-6 text-left transition-all hover:border-[#111827] hover:shadow-lg dark:border-[#374151] dark:bg-[#111827] dark:hover:border-[#f9fafb]"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#f3f4f6] dark:bg-[#374151]">
                            <svg className="h-6 w-6 text-[#111827] dark:text-[#f9fafb]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                          </div>
                          <div className="flex-1">
                            <h3 className="font-landing font-medium text-[#111827] dark:text-[#f9fafb]">
                              Connect Wallet
                            </h3>
                              <p className="font-landing text-sm text-[#6b7280] dark:text-[#9ca3af]">
                              MetaMask, Rainbow, Coinbase Wallet, and 50+ more
                            </p>
                          </div>
                          <svg className="h-5 w-5 text-[#9ca3af] transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </button>

                      {/* Option 2: Watch Address */}
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-[#e5e7eb] dark:border-[#374151]" />
                        </div>
                        <div className="relative flex justify-center text-sm">
                          <span className="bg-white px-2 font-landing text-[#9ca3af] dark:bg-[#0b0f19]">or</span>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <input
                          type="text"
                          placeholder="0x… (watch-only mode)"
                          value={wallet}
                          onChange={(e) => setWallet(e.target.value)}
                          className="w-full rounded-lg border border-[#e5e7eb] bg-white px-4 py-3 font-mono text-sm text-[#111827] placeholder:text-[#9ca3af] focus:border-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827]/20 dark:border-[#374151] dark:bg-[#111827] dark:text-[#f9fafb] dark:focus:border-[#f9fafb] dark:focus:ring-[#f9fafb]/20"
                        />
                        <button
                          type="button"
                          onClick={() => setStep("import")}
                          disabled={!/^0x[a-fA-F0-9]{40}$/.test(wallet.trim())}
                          className="group inline-flex w-full items-stretch overflow-hidden rounded-lg bg-black shadow-[0_4px_16px_rgba(0,0,0,0.12)] disabled:opacity-50 disabled:cursor-not-allowed dark:bg-[#f9fafb] dark:shadow-none"
                        >
                          <span className="flex flex-1 items-center justify-center px-6 py-3.5 font-landing text-[14px] font-medium text-white dark:text-[#111827]">
                            Continue (Watch-Only)
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
                      </div>

                      <button
                        type="button"
                        onClick={() => setWallet(DEMO_WALLET)}
                        className="text-xs text-[#6b7280] underline hover:text-[#111827] dark:text-[#9ca3af] dark:hover:text-[#f9fafb]"
                      >
                        Use demo wallet ({truncateAddress(DEMO_WALLET)})
                      </button>
                    </div>
                  </div>
                )}

                {step === "wallet-connect" && (
                  <WalletOnboardingStep 
                    onComplete={() => setStep("import")}
                    onBack={() => setStep("wallet-input")}
                  />
                )}

                {step === "import" && (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <h2 className="font-serif text-2xl font-bold text-black dark:text-[#f9fafb]">
                        Import portfolio
                      </h2>
                      <p className="font-landing text-sm leading-relaxed text-[#6b7280] dark:text-[#9ca3af]">
                        Scanning blockchain for your wallet balances on {walletAddress ? truncateAddress(walletAddress) : 'connected wallet'} — no keys required.
                      </p>
                    </div>

                    {walletLoading ? (
                      <div className="rounded-lg border border-[#e5e7eb] bg-white p-8 text-center dark:border-[#1f2937] dark:bg-[#111827]">
                        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-[#6b7280] border-t-transparent dark:border-[#9ca3af]" />
                        <p className="font-landing text-sm text-[#6b7280] dark:text-[#9ca3af]">
                          Scanning blockchain for balances...
                        </p>
                      </div>
                    ) : walletError ? (
                      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center dark:border-red-900/30 dark:bg-red-900/20">
                        <p className="font-landing text-sm text-red-600 dark:text-red-400">
                          Error loading wallet: {walletError}
                        </p>
                        <button
                          type="button"
                          onClick={() => window.location.reload()}
                          className="mt-4 text-sm text-red-600 underline dark:text-red-400"
                        >
                          Try again
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Show found positions summary */}
                        <div className="rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-4 dark:border-[#374151] dark:bg-[#1f2937]">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-landing text-xs text-[#6b7280] dark:text-[#9ca3af]">Wallet</p>
                              <p className="font-landing font-medium text-[#111827] dark:text-[#f9fafb]">
                                {walletAddress ? truncateAddress(walletAddress) : 'Connected'}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-landing text-xs text-[#6b7280] dark:text-[#9ca3af]">Positions Found</p>
                              <p className="font-landing text-lg font-semibold text-[#111827] dark:text-[#f9fafb]">
                                {positions.length}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-landing text-xs text-[#6b7280] dark:text-[#9ca3af]">Total Value</p>
                              <p className="font-landing text-lg font-semibold text-[#111827] dark:text-[#f9fafb]">
                                ${totalValueUsd.toLocaleString()}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Preview of positions */}
                        {positions.length > 0 && (
                          <div className="space-y-2">
                            <p className="font-landing text-xs uppercase tracking-wider text-[#9ca3af]">Preview</p>
                            <div className="space-y-2 max-h-40 overflow-y-auto">
                              {positions.slice(0, 3).map((pos, idx) => (
                                <div key={idx} className="flex items-center justify-between rounded-lg border border-[#e5e7eb] bg-white p-3 dark:border-[#374151] dark:bg-[#111827]">
                                  <div className="flex items-center gap-2">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f3f4f6] text-xs font-bold text-[#374151] dark:bg-[#374151] dark:text-[#d1d5db]">
                                      {pos.symbol.charAt(0)}
                                    </div>
                                    <span className="font-landing font-medium text-sm text-[#111827] dark:text-[#f9fafb]">{pos.symbol}</span>
                                  </div>
                                  <span className="font-landing text-sm text-[#6b7280] dark:text-[#9ca3af]">
                                    ${pos.valueUsd.toLocaleString()}
                                  </span>
                                </div>
                              ))}
                              {positions.length > 3 && (
                                <p className="text-center text-xs text-[#9ca3af]">
                                  +{positions.length - 3} more positions
                                </p>
                              )}
                            </div>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => setStep("policy")}
                          className="group inline-flex w-full items-stretch overflow-hidden rounded-lg bg-black shadow-[0_4px_16px_rgba(0,0,0,0.12)] dark:bg-[#f9fafb] dark:shadow-none"
                        >
                          <span className="flex flex-1 items-center justify-center px-6 py-3.5 font-landing text-[14px] font-medium text-white dark:text-[#111827]">
                            Continue to Policy Setup
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
                      </div>
                    )}
                  </div>
                )}

                {step === "policy" && (
                  <div className="grid gap-8 lg:grid-cols-2">
                    {/* Left column - Positions */}
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <h2 className="font-serif text-2xl font-bold text-black dark:text-[#f9fafb]">
                          Portfolio positions
                        </h2>
                        <p className="font-landing text-sm text-[#6b7280] dark:text-[#9ca3af]">
                          {walletLoading ? (
                            "Scanning blockchain..."
                          ) : walletError ? (
                            `Error: ${walletError}`
                          ) : (
                            `Found ${positions.length} position${positions.length !== 1 ? 's' : ''} on ${walletAddress ? truncateAddress(walletAddress) : 'connected wallet'}`
                          )}
                        </p>
                      </div>

                      {/* Summary card */}
                      <div className="rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-4 dark:border-[#374151] dark:bg-[#1f2937]">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="font-landing text-xs text-[#6b7280] dark:text-[#9ca3af]">Total value</p>
                            <p className="font-landing text-lg font-semibold text-[#111827] dark:text-[#f9fafb]">
                              ${totalValue.toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <p className="font-landing text-xs text-[#6b7280] dark:text-[#9ca3af]">Unrealized P&L</p>
                            <p className={`font-landing text-lg font-semibold ${totalUnrealizedPnl >= 0 ? "text-[#374151] dark:text-[#d1d5db]" : "text-[#374151] dark:text-[#d1d5db]"}`}>
                              {totalUnrealizedPnl >= 0 ? "+" : ""}{totalUnrealizedPnl.toFixed(1)}%
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Positions list */}
                      <div className="space-y-3">
                        {walletLoading ? (
                          <div className="rounded-lg border border-[#e5e7eb] bg-white p-8 text-center dark:border-[#1f2937] dark:bg-[#111827]">
                            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-[#6b7280] border-t-transparent dark:border-[#9ca3af]" />
                            <p className="font-landing text-sm text-[#6b7280] dark:text-[#9ca3af]">
                              Loading portfolio from blockchain...
                            </p>
                          </div>
                        ) : positions.length === 0 ? (
                          <div className="rounded-lg border border-[#e5e7eb] bg-white p-6 text-center dark:border-[#1f2937] dark:bg-[#111827]">
                            <p className="font-landing text-sm text-[#6b7280] dark:text-[#9ca3af]">
                              No positions found on this wallet
                            </p>
                          </div>
                        ) : (
                          positions.map((pos, index) => (
                            <div
                              key={index}
                              className="flex items-center justify-between rounded-lg border border-[#e5e7eb] bg-white p-4 dark:border-[#374151] dark:bg-[#111827]"
                            >
                              <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f3f4f6] font-bold text-[#374151] dark:bg-[#374151] dark:text-[#d1d5db]">
                                  {pos.symbol.charAt(0)}
                                </div>
                                <div>
                                  <p className="font-landing font-medium text-[#111827] dark:text-[#f9fafb]">
                                    {pos.symbol}
                                  </p>
                                  <p className="font-landing text-xs text-[#6b7280] dark:text-[#9ca3af]">
                                    {parseFloat(pos.quantity).toFixed(4)} · {pos.chain}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-landing font-medium text-[#111827] dark:text-[#f9fafb]">
                                  ${pos.valueUsd.toLocaleString()}
                                </p>
                                <p className="font-landing text-xs text-[#9ca3af]">
                                  Current Value
                                </p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Right column - Policy settings */}
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <h2 className="font-serif text-2xl font-bold text-black dark:text-[#f9fafb]">
                          Agent preferences
                        </h2>
                        <p className="font-landing text-sm text-[#6b7280] dark:text-[#9ca3af]">
                          Configure how your taxee agent manages your portfolio.
                        </p>
                      </div>

                      <div className="space-y-5">
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
                            className="w-full rounded-lg border border-[#e5e7eb] bg-white px-3 py-2.5 font-landing text-sm text-[#111827] focus:border-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827]/20 dark:border-[#374151] dark:bg-[#111827] dark:text-[#f9fafb] dark:focus:border-[#f9fafb] dark:focus:ring-[#f9fafb]/20"
                          >
                            <option value="US">United States</option>
                            <option value="UK">United Kingdom</option>
                            <option value="EU">Europe</option>
                            <option value="BR">Brasil</option>
                            <option value="MX">Mexico</option>
                            <option value="IN">India</option>
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
                            className="w-full rounded-lg border border-[#e5e7eb] bg-white px-3 py-2.5 font-landing text-sm text-[#111827] focus:border-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827]/20 dark:border-[#374151] dark:bg-[#111827] dark:text-[#f9fafb] dark:focus:border-[#f9fafb] dark:focus:ring-[#f9fafb]/20"
                          >
                            <option value={5}>5%</option>
                            <option value={8}>8%</option>
                            <option value={10}>10%</option>
                          </select>
                        </label>

                        <ApprovalModePicker value={approval} onChange={setApproval} />

                        {/* Goal Parser with add/remove functionality */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="font-landing text-sm font-medium text-[#111827] dark:text-[#f9fafb]">
                              Goals
                            </span>
                            <span className="font-landing text-xs text-[#9ca3af]">
                              LLM will parse these into policy rules
                            </span>
                          </div>

                          {/* Existing goals */}
                          <div className="space-y-2">
                            {goals.map((goal, index) => (
                              <div
                                key={index}
                                className="flex items-start gap-2 rounded-lg border border-[#e5e7eb] bg-white p-3 dark:border-[#374151] dark:bg-[#111827]"
                              >
                                <span className="mt-0.5 text-[#9ca3af]">•</span>
                                <p className="flex-1 font-landing text-sm text-[#111827] dark:text-[#f9fafb]">
                                  {goal}
                                </p>
                                <button
                                  type="button"
                                  onClick={() => removeGoal(index)}
                                  className="text-[#9ca3af] transition-colors hover:text-[#6b7280]"
                                >
                                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M6 6l8 8M14 6l-8 8" />
                                  </svg>
                                </button>
                              </div>
                            ))}
                          </div>

                          {/* Add new goal */}
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="Add a goal..."
                              value={newGoal}
                              onChange={(e) => setNewGoal(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  addGoal();
                                }
                              }}
                              className="flex-1 rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 font-landing text-sm text-[#111827] placeholder:text-[#9ca3af] focus:border-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827]/20 dark:border-[#374151] dark:bg-[#111827] dark:text-[#f9fafb] dark:focus:border-[#f9fafb] dark:focus:ring-[#f9fafb]/20"
                            />
                            <button
                              type="button"
                              onClick={addGoal}
                              className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#111827] text-white transition-colors hover:bg-[#374151] dark:bg-[#f9fafb] dark:text-[#111827] dark:hover:bg-[#e5e7eb]"
                            >
                              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M10 5v10M5 10h10" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={finishOnboarding}
                        className="group inline-flex w-full items-stretch overflow-hidden bg-black shadow-[0_4px_16px_rgba(0,0,0,0.12)] dark:bg-[#f9fafb] dark:shadow-none"
                      >
                        <span className="flex flex-1 items-center justify-center px-6 py-3.5 font-landing text-[14px] font-medium text-white dark:text-[#111827]">
                          Activate agent
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
                    </div>
                  </div>
                )}

                {step === "done" && agentId && (
                  <div className="space-y-6 text-center">
                    <div className="rounded-xl border border-[#e5e7eb] bg-[#f9fafb] p-8 dark:border-[#374151] dark:bg-[#1f2937]">
                      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#111827] dark:bg-[#f9fafb]">
                        <svg
                          width="32"
                          height="32"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="white"
                          strokeWidth="3"
                          className="dark:stroke-[#111827]"
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
