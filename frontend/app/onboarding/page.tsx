"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import type { ApprovalSettings, UserPolicy, WalletConnectionType } from "@/lib/types";
import { defaultApproval, defaultPolicy } from "@/lib/mock-data";
import { ApprovalModePicker } from "@/components/onboarding/approval-mode-picker";
import { OnboardingTopBar } from "@/components/onboarding/onboarding-topbar";
import { registerAgent } from "@/lib/agent-store";
import { syncWebAgentToBackend } from "@/lib/web-agent-api";
import { saveWalletConnectionType } from "@/lib/wallet-session";
import { DepositFundsButton } from "@/components/wallet/deposit-funds-button";
import { getCircleWalletAddress } from "@/hooks/use-circle-wallet";
import {
  resolvePrimaryWalletAddress,
  walletModeLabel,
} from "@/lib/primary-wallet";
import { truncateAddress } from "@/lib/utils";
import { SimpleWalletConnect } from "@/components/wallet/simple-wallet-connect";
import { CircleWalletSetup } from "@/components/wallet/circle-wallet-setup";
import { AgentActivation } from "@/components/wallet/agent-activation";
import { useWalletData } from "@/hooks/use-wallet-data";

type Step = "wallet-input" | "wallet-connect" | "circle-setup" | "import" | "policy" | "review" | "activate" | "done";

const STEP_ORDER: Step[] = ["wallet-input", "wallet-connect", "circle-setup", "import", "policy", "review", "activate", "done"];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("wallet-input");
  const [wallet, setWallet] = useState("");
  const [importing, setImporting] = useState(false);
  const [policy, setPolicy] = useState<UserPolicy>({ ...defaultPolicy });
  const [approval, setApproval] = useState<ApprovalSettings>({
    ...defaultApproval,
    mode: "manual",
  });
  const [agentId, setAgentId] = useState<string | null>(null);
  const [goals, setGoals] = useState<string[]>([
    "Minimize taxes this year",
  ]);
  const [newGoal, setNewGoal] = useState("");
  const [walletConnectionType, setWalletConnectionType] =
    useState<WalletConnectionType | null>(null);

  const walletValid = /^0x[a-fA-F0-9]{40}$/.test(wallet.trim());
  const needsEip7702 = walletConnectionType === "external_eip7702";
  
  const { address: connectedAddress } = useAccount();
  const walletAddress = resolvePrimaryWalletAddress({
    connectionType: walletConnectionType,
    storedWallet: wallet,
    wagmiAddress: connectedAddress,
  });
  const walletMode = walletModeLabel(walletConnectionType);
  
  const scanAddress =
    walletAddress && /^0x[a-fA-F0-9]{40}$/i.test(walletAddress)
      ? walletAddress
      : undefined;
  const { positions, totalValueUsd, isLoading: walletLoading, error: walletError } =
    useWalletData(scanAddress, {
      fallbackToConnected: walletConnectionType === 'external_eip7702',
    });
  
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

  async function finishOnboarding(conn: WalletConnectionType = walletConnectionType ?? "external_eip7702") {
    const finalPolicy: UserPolicy = { ...policy, walletConnectionType: conn };
    saveWalletConnectionType(conn);
    const addr =
      conn === "circle"
        ? getCircleWalletAddress() || wallet
        : walletAddress || "";
    const agent = registerAgent(addr, finalPolicy, approval);
    if (conn === "circle" && addr) {
      const synced = await syncWebAgentToBackend(addr, finalPolicy, approval);
      if (!synced) {
        console.warn(
          "Server agent sync skipped (deploy latest API for /circle/sync-web-agent). Local agent is ready.",
        );
      }
    }
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
                        onClick={() => {
                          setWalletConnectionType("external_eip7702");
                          saveWalletConnectionType("external_eip7702");
                          setStep("wallet-connect");
                        }}
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

                      {/* Option 2: Circle MPC Wallet */}
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-[#e5e7eb] dark:border-[#374151]" />
                        </div>
                        <div className="relative flex justify-center text-sm">
                          <span className="bg-white px-2 font-landing text-[#9ca3af] dark:bg-[#0b0f19]">or</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setWalletConnectionType("circle");
                          saveWalletConnectionType("circle");
                          setStep("circle-setup");
                        }}
                        className="group w-full rounded-xl border border-[#e5e7eb] bg-white p-6 text-left transition-all hover:border-[#111827] hover:shadow-lg dark:border-[#374151] dark:bg-[#111827] dark:hover:border-[#f9fafb]"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#f3f4f6] dark:bg-[#374151]">
                            <svg className="h-6 w-6 text-[#111827] dark:text-[#f9fafb]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                          </div>
                          <div className="flex-1">
                            <h3 className="font-landing font-medium text-[#111827] dark:text-[#f9fafb]">
                            Connect Circle Wallet
                            </h3>
                            <p className="font-landing text-sm text-[#6b7280] dark:text-[#9ca3af]">
                              MPC-based wallet with PIN protection.
                            </p>
                          </div>
                          <svg className="h-5 w-5 text-[#9ca3af] transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </button>

                      {/* Option 3: Watch Address */}
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
                          onClick={() => {
                            setWalletConnectionType("watch");
                            saveWalletConnectionType("watch");
                            setStep("import");
                          }}
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

                    </div>
                  </div>
                )}

                {step === "wallet-connect" && (
                  <SimpleWalletConnect 
                    onComplete={() => setStep("import")}
                    onBack={() => setStep("wallet-input")}
                  />
                )}

                {step === "circle-setup" && (
                  <CircleWalletSetup
                    onComplete={(circleWalletAddress) => {
                      setWallet(circleWalletAddress);
                      setStep("import");
                    }}
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
                        Scanning {walletMode.toLowerCase()}{" "}
                        {walletAddress ? truncateAddress(walletAddress) : ""} — balances for the wallet you chose, not MetaMask unless you picked Connect Wallet.
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
                              <p className="font-landing text-xs text-[#6b7280] dark:text-[#9ca3af]">{walletMode}</p>
                              <p className="font-landing font-medium text-[#111827] dark:text-[#f9fafb]">
                                {walletAddress ? truncateAddress(walletAddress) : "—"}
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
                            `Found ${positions.length} position${positions.length !== 1 ? 's' : ''} on ${walletMode} ${walletAddress ? truncateAddress(walletAddress) : ""}`
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
                          <div className="space-y-4 rounded-lg border border-[#e5e7eb] bg-white p-6 text-center dark:border-[#1f2937] dark:bg-[#111827]">
                            <p className="font-landing text-sm text-[#6b7280] dark:text-[#9ca3af]">
                              No positions found on {walletMode}
                              {walletAddress ? ` ${truncateAddress(walletAddress)}` : ""}
                            </p>
                            {walletAddress && /^0x[a-fA-F0-9]{40}$/i.test(walletAddress) && (
                              <DepositFundsButton address={walletAddress} className="mx-auto" />
                            )}
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
                            <option value={-5}>5% loss</option>
                            <option value={-8}>8% loss</option>
                            <option value={-10}>10% loss</option>
                            <option value={-15}>15% loss</option>
                          </select>
                        </label>

                        <label className="block space-y-2">
                          <span className="font-landing text-sm font-medium text-[#111827] dark:text-[#f9fafb]">
                            Minimum loss (USD) to suggest harvest
                          </span>
                          <select
                            value={policy.minHarvestLossUsd ?? 0}
                            onChange={(e) =>
                              setPolicy({
                                ...policy,
                                minHarvestLossUsd: Number(e.target.value),
                              })
                            }
                            className="w-full rounded-lg border border-[#e5e7eb] bg-white px-3 py-2.5 font-landing text-sm text-[#111827] focus:border-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827]/20 dark:border-[#374151] dark:bg-[#111827] dark:text-[#f9fafb] dark:focus:border-[#f9fafb] dark:focus:ring-[#f9fafb]/20"
                          >
                            <option value={0}>Any loss size</option>
                            <option value={50}>$50+</option>
                            <option value={100}>$100+</option>
                            <option value={250}>$250+</option>
                            <option value={500}>$500+</option>
                            <option value={1000}>$1,000+</option>
                          </select>
                        </label>

                        <label className="block space-y-2">
                          <span className="font-landing text-sm font-medium text-[#111827] dark:text-[#f9fafb]">
                            Portfolio scan rhythm
                          </span>
                          <select
                            value={policy.heartbeatIntervalMinutes ?? 30}
                            onChange={(e) =>
                              setPolicy({
                                ...policy,
                                heartbeatIntervalMinutes: Number(e.target.value),
                              })
                            }
                            className="w-full rounded-lg border border-[#e5e7eb] bg-white px-3 py-2.5 font-landing text-sm text-[#111827] focus:border-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827]/20 dark:border-[#374151] dark:bg-[#111827] dark:text-[#f9fafb] dark:focus:border-[#f9fafb] dark:focus:ring-[#f9fafb]/20"
                          >
                            <option value={15}>Every 15 minutes</option>
                            <option value={30}>Every 30 minutes</option>
                            <option value={60}>Every hour</option>
                            <option value={120}>Every 2 hours</option>
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
                        onClick={() => setStep("review")}
                        className="group inline-flex w-full items-stretch overflow-hidden bg-black shadow-[0_4px_16px_rgba(0,0,0,0.12)] dark:bg-[#f9fafb] dark:shadow-none"
                      >
                        <span className="flex flex-1 items-center justify-center px-6 py-3.5 font-landing text-[14px] font-medium text-white dark:text-[#111827]">
                          Review & Activate
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

                {step === "review" && (
                  <div className="space-y-8">
                    <div className="text-center space-y-2">
                      <h2 className="font-serif text-2xl font-bold text-black dark:text-[#f9fafb]">
                        Review & Activate
                      </h2>
                      <p className="font-landing text-sm text-[#6b7280] dark:text-[#9ca3af]">
                        Review your portfolio and policy before activating your Taxee agent
                      </p>
                    </div>

                    {/* Portfolio Summary */}
                    <div className="rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-4 dark:border-[#374151] dark:bg-[#1f2937]">
                      <h3 className="font-landing text-sm font-medium text-[#111827] dark:text-[#f9fafb] mb-3">
                        Portfolio ({positions.length} positions)
                      </h3>
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {positions.slice(0, 5).map((pos, idx) => (
                          <div key={idx} className="flex items-center justify-between text-sm">
                            <span className="font-landing text-[#111827] dark:text-[#f9fafb]">{pos.symbol}</span>
                            <span className="font-landing text-[#6b7280] dark:text-[#9ca3af]">
                              {parseFloat(pos.quantity).toFixed(4)} · ${pos.valueUsd.toLocaleString()}
                            </span>
                          </div>
                        ))}
                        {positions.length > 5 && (
                          <p className="text-xs text-[#9ca3af] text-center">+{positions.length - 5} more</p>
                        )}
                      </div>
                      <div className="mt-3 pt-3 border-t border-[#e5e7eb] dark:border-[#374151]">
                        <div className="flex justify-between">
                          <span className="font-landing text-sm text-[#6b7280] dark:text-[#9ca3af]">Total Value</span>
                          <span className="font-landing font-semibold text-[#111827] dark:text-[#f9fafb]">${totalValueUsd.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Policy Summary */}
                    <div className="rounded-lg border border-[#e5e7eb] bg-white p-4 dark:border-[#374151] dark:bg-[#111827]">
                      <h3 className="font-landing text-sm font-medium text-[#111827] dark:text-[#f9fafb] mb-3">
                        Agent Policy
                      </h3>
                      <ul className="space-y-2 text-sm">
                     
                     
                        <li className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="font-landing text-[#111827] dark:text-[#f9fafb]">Valid for 90 days</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="font-landing text-[#111827] dark:text-[#f9fafb]">Approval: {approval.mode === 'delegated' ? 'Autonomous' : 'Manual'}</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="font-landing text-[#111827] dark:text-[#f9fafb]">Jurisdiction: {policy.jurisdiction}</span>
                        </li>
                      </ul>
                    </div>

                   
                    {walletConnectionType === "watch" && (
                      <div className="p-4 rounded-xl bg-[#f9fafb] border border-[#e5e7eb] dark:border-[#374151] dark:bg-[#1f2937]">
                        <p className="font-landing text-sm text-[#6b7280] dark:text-[#9ca3af]">
                          Watch-only mode: Taxee scans and suggests actions. You execute trades yourself in your wallet.
                        </p>
                      </div>
                    )}

                    {needsEip7702 && (
                      <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                        <div className="flex items-start gap-3">
                          <svg className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div>
                            <p className="font-landing text-sm font-medium text-[#111827] dark:text-[#f9fafb]">
                              EIP-7702 delegation (MetaMask)
                            </p>
                            <p className="mt-1 font-landing text-sm text-[#6b7280] dark:text-[#9ca3af]">
                              Next you&apos;ll sign once in MetaMask to grant Taxee limited on-chain authority
                              within your policy limits. You keep your keys and can revoke anytime.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setStep("policy")}
                        className="flex-1 px-6 py-3 rounded-xl border border-[#e5e7eb] font-landing text-sm font-medium text-[#6b7280] hover:bg-[#f9fafb] dark:border-[#374151] dark:text-[#9ca3af] dark:hover:bg-[#1f2937]"
                      >
                        Edit Policy
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (needsEip7702) setStep("activate");
                          else finishOnboarding(walletConnectionType ?? "circle");
                        }}
                        className="flex-[2] group inline-flex items-stretch overflow-hidden rounded-xl bg-black shadow-[0_4px_16px_rgba(0,0,0,0.12)] dark:bg-[#f9fafb] dark:shadow-none"
                      >
                        <span className="flex flex-1 items-center justify-center px-6 py-3 font-landing text-sm font-medium text-white dark:text-[#111827]">
                          {needsEip7702 ? "Continue to Sign" : "Activate Agent"}
                        </span>
                        <span className="flex w-[52px] items-center justify-center bg-[#374151] transition-colors group-hover:bg-[#4b5563] dark:bg-[#4b5563] dark:group-hover:bg-[#6b7280]">
                          <svg className="landing-cta-arrow" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#111827" strokeWidth="2.2">
                            <path d="M5 10h10M11 6l4 4-4 4" />
                          </svg>
                        </span>
                      </button>
                    </div>
                  </div>
                )}

                {step === "activate" && needsEip7702 && (
                  <AgentActivation
                    policy={policy}
                    onSuccess={() => finishOnboarding("external_eip7702")}
                    onBack={() => setStep("review")}
                  />
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
