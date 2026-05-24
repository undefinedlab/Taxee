"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Agent, Opportunity } from "@/lib/types";
import {
  defaultApproval,
  demoAgent,
  demoPositions,
  demoRegime,
} from "@/lib/mock-data";
import { loadAgent } from "@/lib/agent-store";
import type { ApprovalSettings } from "@/lib/types";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";

interface DashboardClientProps {
  agentId: string;
}

// Mock opportunities data
const MOCK_OPPORTUNITIES: Opportunity[] = [
  {
    id: "opp-1",
    agentId: "agent-1",
    type: "HARVEST",
    status: "pending",
    headline: "Harvest wETH loss",
    taxSavingEstimate: 180,
    llmReasoning: "wETH is down 14% from cost basis. Harvesting now would save ~$180 in taxes. Replace with stETH to maintain ETH exposure.",
    createdAt: new Date().toISOString(),
  },
  {
    id: "opp-2",
    agentId: "agent-1",
    type: "PARK",
    status: "pending",
    headline: "Park USDC in USYC",
    taxSavingEstimate: 45,
    llmReasoning: "Lot approaching long-term threshold (335 days). Park in USYC to earn 4.5% yield while waiting for LT treatment.",
    createdAt: new Date().toISOString(),
  },
];

export function DashboardClient({ agentId }: DashboardClientProps) {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [approval, setApproval] = useState<ApprovalSettings | null>(null);
  const [opportunities, setOpportunities] = useState<Opportunity[]>(MOCK_OPPORTUNITIES);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const stored = loadAgent();
    if (stored && (stored.id === agentId || agentId === "demo")) {
      const withApproval = {
        ...stored,
        approval: stored.approval ?? defaultApproval,
      };
      setAgent(withApproval);
      setApproval(withApproval.approval);
    } else if (agentId === "demo") {
      setAgent(demoAgent);
      setApproval(demoAgent.approval);
    } else {
      setAgent(demoAgent);
      setApproval(demoAgent.approval);
    }
  }, [agentId]);

  const displayAgent = agent ?? demoAgent;
  const displayApproval = approval ?? displayAgent.approval;
  const wallet = displayAgent.wallets[0]?.address ?? "—";
  const pending = opportunities.filter((o) => o.status === "pending");
  
  // Calculate stats
  const totalValue = demoPositions.reduce((sum, pos) => sum + pos.valueUsd, 0);
  const totalCostBasis = demoPositions.reduce((sum, pos) => sum + pos.costBasisUsd, 0);
  const totalUnrealized = totalValue - totalCostBasis;
  const totalTaxSaved = opportunities
    .filter((o) => o.status === "executed" || o.status === "auto_executed")
    .reduce((sum, o) => sum + (o.taxSavingEstimate || 0), 0);
  const pendingTaxSavings = pending.reduce((sum, o) => sum + (o.taxSavingEstimate || 0), 0);

  return (
    <div className="landing-root landing-marble-bg relative min-h-screen">
      <div className="landing-ambient" aria-hidden />
      <DashboardHeader />
      <div className="relative z-[1] p-3 sm:p-5 lg:p-8">
        <div className="mx-auto max-w-[1320px] space-y-6 sm:space-y-8">
          <div className="landing-card-sharp landing-glass landing-animate-in overflow-hidden">
            <main className="px-6 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10">
              {/* Stats Bar - Clean Design */}
              <div className="mb-6 grid grid-cols-2 gap-8 border-b border-[#e5e7eb] pb-6 dark:border-[#374151] sm:grid-cols-4">
                <div>
                  <p className="font-landing text-xs uppercase tracking-wider text-[#9ca3af]">Portfolio Value</p>
                  <p className="mt-1 font-serif text-3xl font-semibold text-[#111827] dark:text-[#f9fafb]">
                    ${totalValue.toLocaleString()}
                  </p>
                  <p className={`mt-1 font-landing text-sm ${totalUnrealized >= 0 ? "text-[#374151] dark:text-[#9ca3af]" : "text-[#374151] dark:text-[#9ca3af]"}`}>
                    {totalUnrealized >= 0 ? "+" : ""}{((totalUnrealized / totalCostBasis) * 100).toFixed(1)}% unrealized
                  </p>
                </div>

                <div>
                  <p className="font-landing text-xs uppercase tracking-wider text-[#9ca3af]">Tax Saved YTD</p>
                  <p className="mt-1 font-serif text-3xl font-semibold text-[#111827] dark:text-[#f9fafb]">
                    ${totalTaxSaved.toLocaleString()}
                  </p>
                  <p className="mt-1 font-landing text-sm text-[#9ca3af]">
                    From harvested losses
                  </p>
                </div>

                <div>
                  <p className="font-landing text-xs uppercase tracking-wider text-[#9ca3af]">Pending</p>
                  <p className="mt-1 font-serif text-3xl font-semibold text-[#111827] dark:text-[#f9fafb]">
                    {pending.length}
                  </p>
                  <p className="mt-1 font-landing text-sm text-[#9ca3af]">
                    ${pendingTaxSavings.toLocaleString()} potential savings
                  </p>
                </div>

                <div>
                  <p className="font-landing text-xs uppercase tracking-wider text-[#9ca3af]">Heartbeat</p>
                  <p className="mt-1 font-serif text-3xl font-semibold text-[#111827] dark:text-[#f9fafb]">
                    Active
                  </p>
                  <p className="mt-1 font-landing text-sm text-[#9ca3af]">
                    Every 60 min
                  </p>
                </div>
              </div>

              {/* Policy Row */}
              <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-[#e5e7eb] pb-3 dark:border-[#374151]">
                <div className="flex items-center gap-2">
                  <span className="font-landing text-xs uppercase tracking-wider text-[#9ca3af]">Harvest</span>
                  <span className="font-landing text-sm font-medium text-[#111827] dark:text-[#f9fafb]">−{displayAgent.policy.harvestThresholdPct}%</span>
                </div>
                <div className="h-4 w-px bg-[#e5e7eb] dark:bg-[#374151]" />
                <div className="flex items-center gap-2">
                  <span className="font-landing text-xs uppercase tracking-wider text-[#9ca3af]">Jurisdiction</span>
                  <span className="font-landing text-sm font-medium text-[#111827] dark:text-[#f9fafb]">{displayAgent.policy.jurisdiction}</span>
                </div>
                <div className="h-4 w-px bg-[#e5e7eb] dark:bg-[#374151]" />
                <div className="flex items-center gap-2">
                  <span className="font-landing text-xs uppercase tracking-wider text-[#9ca3af]">Objective</span>
                  <span className="font-landing text-sm font-medium capitalize text-[#111827] dark:text-[#f9fafb]">{displayAgent.policy.primaryObjective.replace("_", " ")}</span>
                </div>
              </div>

              {/* Two Column Layout */}
              <div className="grid gap-8 lg:grid-cols-3">
                {/* Left Column - Opportunities (2/3) */}
                <div className="lg:col-span-2">
                  {/* Section heading OUTSIDE the card */}
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h2 className="font-serif text-xl font-bold text-[#111827] dark:text-[#f9fafb]">
                        Opportunities
                      </h2>
                      <p className="mt-1 font-landing text-sm text-[#9ca3af]">
                        {pending.length} actions waiting for your review
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-[#6b7280] transition-colors hover:bg-white/50 hover:text-[#111827] dark:text-[#9ca3af] dark:hover:bg-white/10 dark:hover:text-[#f9fafb]"
                        title="Approve all"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </button>
                      <button 
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-[#6b7280] transition-colors hover:bg-white/50 hover:text-[#111827] dark:text-[#9ca3af] dark:hover:bg-white/10 dark:hover:text-[#f9fafb]"
                        title="Refresh"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="23 4 23 10 17 10" />
                          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Individual Opportunity Cards */}
                  <div className="space-y-4">
                    {pending.length === 0 ? (
                      <div className="landing-glass rounded-xl p-8 text-center">
                        <p className="font-landing text-[#9ca3af]">
                          Nothing flagged — agent will rescan on next heartbeat.
                        </p>
                      </div>
                    ) : (
                      pending.map((opportunity) => (
                        <OpportunityCard 
                          key={opportunity.id} 
                          opportunity={opportunity}
                          approvalMode={displayApproval.mode}
                        />
                      ))
                    )}

                    {/* Resolved opportunities */}
                    {opportunities.filter((o) => o.status !== "pending").length > 0 && (
                      <div className="mt-8">
                        <h3 className="mb-4 font-landing text-sm font-medium text-[#9ca3af]">
                          Resolved
                        </h3>
                        <div className="space-y-4 opacity-60">
                          {opportunities
                            .filter((o) => o.status !== "pending")
                            .map((o) => (
                              <OpportunityCard
                                key={o.id}
                                opportunity={o}
                                approvalMode={displayApproval.mode}
                                resolved
                              />
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column - Settings Cards (1/3) */}
                <div>
                  <h3 className="mb-4 font-landing text-xs uppercase tracking-wider text-[#9ca3af]">
                    Settings
                  </h3>
                  <div className="space-y-4">
                    {/* Approval Mode Card */}
                  <div className="landing-glass rounded-xl p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="font-landing text-xs uppercase tracking-wider text-[#9ca3af]">
                        Approval mode
                      </h3>
                      <span className="font-landing text-xs text-[#6b7280] dark:text-[#9ca3af]">
                        {displayApproval.mode === "manual" ? "Manual" : "Delegated"}
                      </span>
                    </div>
                    
                    {/* Toggle Switch */}
                    <button
                      onClick={() => setApproval({ 
                        ...displayApproval, 
                        mode: displayApproval.mode === "manual" ? "delegated" : "manual" 
                      })}
                      className="relative flex h-8 w-full items-center rounded-full bg-white/50 p-1 dark:bg-white/10"
                    >
                      <div
                        className={`absolute h-6 w-1/2 rounded-full bg-[#111827] transition-all duration-200 dark:bg-[#f9fafb] ${
                          displayApproval.mode === "delegated" ? "left-1/2" : "left-1"
                        }`}
                      />
                      <span className={`relative z-10 flex-1 text-center font-landing text-xs ${
                        displayApproval.mode === "manual" 
                          ? "text-white dark:text-[#111827]" 
                          : "text-[#6b7280] dark:text-[#9ca3af]"
                      }`}>
                        Manual
                      </span>
                      <span className={`relative z-10 flex-1 text-center font-landing text-xs ${
                        displayApproval.mode === "delegated" 
                          ? "text-white dark:text-[#111827]" 
                          : "text-[#6b7280] dark:text-[#9ca3af]"
                      }`}>
                        Delegated
                      </span>
                    </button>
                    
                    <p className="mt-3 font-landing text-xs text-[#9ca3af]">
                      {displayApproval.mode === "manual" 
                        ? "You approve each action manually" 
                        : "Agent acts autonomously within policy limits"}
                    </p>
                  </div>

                  {/* Market Regime Card */}
                  <div className="landing-glass rounded-xl p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="font-landing text-xs uppercase tracking-wider text-[#9ca3af]">
                        Market regime
                      </h3>
                      <button 
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-[#9ca3af] transition-colors hover:bg-white/50 hover:text-[#6b7280] dark:hover:bg-white/10"
                        title="Change regime"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                    </div>
                    <div className="rounded-lg bg-white/50 p-4 dark:bg-white/5">
                      <div className="flex items-center justify-between">
                        <span className="font-landing text-lg font-medium capitalize text-[#111827] dark:text-[#f9fafb]">
                          {demoRegime.label.replace("-", " ")}
                        </span>
                        <span className="rounded-full bg-[#f3f4f6] px-3 py-1 font-landing text-xs text-[#6b7280] dark:bg-[#374151] dark:text-[#9ca3af]">
                          {Math.round(demoRegime.confidence * 100)}%
                        </span>
                      </div>
                      <p className="mt-2 font-landing text-sm leading-relaxed text-[#6b7280] dark:text-[#9ca3af]">
                        {demoRegime.reasoning}
                      </p>
                    </div>
                  </div>

                  {/* Positions Card */}
                  <div className="landing-glass rounded-xl p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#9ca3af]">
                          <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <h3 className="font-landing text-xs uppercase tracking-wider text-[#9ca3af]">
                          Positions
                        </h3>
                      </div>
                      <span className="font-landing text-xs text-[#9ca3af]">{demoPositions.length} assets</span>
                    </div>
                    <div className="space-y-2">
                      {demoPositions.slice(0, 4).map((pos, index) => (
                        <div key={index} className="flex items-center justify-between rounded-lg bg-white/50 px-3 py-2 dark:bg-white/5">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f3f4f6] font-bold text-xs text-[#374151] dark:bg-[#374151] dark:text-[#d1d5db]">
                              {pos.assetId.slice(0, 2)}
                            </div>
                            <div>
                              <span className="font-landing text-sm font-medium text-[#111827] dark:text-[#f9fafb]">
                                {pos.assetId}
                              </span>
                              <span className="ml-2 font-landing text-xs text-[#9ca3af]">
                                {pos.chain}
                              </span>
                            </div>
                          </div>
                          <span className="font-landing text-sm text-[#111827] dark:text-[#f9fafb]">
                            ${pos.valueUsd.toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                    <button className="mt-3 w-full rounded-lg bg-white/50 py-2 font-landing text-sm text-[#6b7280] transition-colors hover:bg-white dark:bg-white/5 dark:text-[#9ca3af] dark:hover:bg-white/10">
                      View all positions
                    </button>
                  </div>
                  </div>
                </div>
              </div>
            </main>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-[#e5e7eb] bg-white p-6 shadow-xl dark:border-[#374151] dark:bg-[#111827]">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="font-serif text-xl font-bold text-[#111827] dark:text-[#f9fafb]">
                Agent settings
              </h2>
              <button
                onClick={() => setSettingsOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#9ca3af] transition-colors hover:bg-[#f3f4f6] hover:text-[#111827] dark:hover:bg-[#374151]"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l8 8M14 6l-8 8" />
                </svg>
              </button>
            </div>

            <div className="space-y-3">
              <button className="flex w-full items-center gap-3 rounded-lg border border-[#e5e7eb] p-4 text-left transition-colors hover:bg-[#f9fafb] dark:border-[#374151] dark:hover:bg-[#1f2937]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#9ca3af]">
                  <rect x="6" y="4" width="12" height="16" rx="2" />
                  <line x1="12" y1="8" x2="12" y2="8.01" />
                  <line x1="12" y1="12" x2="12" y2="12.01" />
                  <line x1="12" y1="16" x2="12" y2="16.01" />
                </svg>
                <div>
                  <p className="font-landing font-medium text-[#111827] dark:text-[#f9fafb]">Pause agent</p>
                  <p className="font-landing text-xs text-[#9ca3af]">Temporarily stop the heartbeat</p>
                </div>
              </button>

              <button className="flex w-full items-center gap-3 rounded-lg border border-[#e5e7eb] p-4 text-left transition-colors hover:bg-[#f9fafb] dark:border-[#374151] dark:hover:bg-[#1f2937]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#9ca3af]">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                <div>
                  <p className="font-landing font-medium text-[#111827] dark:text-[#f9fafb]">Edit policy</p>
                  <p className="font-landing text-xs text-[#9ca3af]">Change thresholds and preferences</p>
                </div>
              </button>

              <button className="flex w-full items-center gap-3 rounded-lg border border-[#e5e7eb] p-4 text-left transition-colors hover:bg-[#f9fafb] dark:border-[#374151] dark:hover:bg-[#1f2937]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#9ca3af]">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <div>
                  <p className="font-landing font-medium text-[#111827] dark:text-[#f9fafb]">Heartbeat timing</p>
                  <p className="font-landing text-xs text-[#9ca3af]">Currently every 60 minutes</p>
                </div>
              </button>

              <button className="flex w-full items-center gap-3 rounded-lg border border-[#e5e7eb] p-4 text-left transition-colors hover:bg-[#f9fafb] dark:border-[#374151] dark:hover:bg-[#1f2937]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#9ca3af]">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <div>
                  <p className="font-landing font-medium text-[#111827] dark:text-[#f9fafb]">Export data</p>
                  <p className="font-landing text-xs text-[#9ca3af]">Download transactions and tax records</p>
                </div>
              </button>

              <div className="my-4 border-t border-[#e5e7eb] dark:border-[#374151]" />

              <button className="flex w-full items-center gap-3 rounded-lg border border-red-200 p-4 text-left transition-colors hover:bg-red-50 dark:border-red-900/30 dark:hover:bg-red-900/20">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-500">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                <div>
                  <p className="font-landing font-medium text-red-600 dark:text-red-400">Delete agent</p>
                  <p className="font-landing text-xs text-red-400/70">Permanently remove this agent and all data</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



// Opportunity Card Component
function OpportunityCard({ 
  opportunity, 
  approvalMode,
  resolved = false 
}: { 
  opportunity: Opportunity; 
  approvalMode: string;
  resolved?: boolean;
}) {
  const typeLabels: Record<string, string> = {
    HARVEST: "Tax Loss Harvest",
    REBALANCE: "Rebalance",
    PARK: "Yield Park",
  };

  return (
    <div className={`landing-glass rounded-xl p-5 ${resolved ? "opacity-60" : ""}`}>
      {/* Tags Row */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-white/70 px-3 py-1 font-landing text-xs text-[#9ca3af] dark:bg-white/10">
          {typeLabels[opportunity.type] || opportunity.type}
        </span>
        {opportunity.taxSavingEstimate > 0 && (
          <span className="rounded-full bg-[#111827] px-3 py-1 font-landing text-xs font-bold text-white dark:bg-[#f9fafb] dark:text-[#111827]">
            +${opportunity.taxSavingEstimate.toLocaleString()}
          </span>
        )}
        {!resolved && approvalMode === "delegated" && (
          <span className="rounded-full bg-white/70 px-3 py-1 font-landing text-xs text-[#6b7280] dark:bg-white/10 dark:text-[#9ca3af]">
            Auto
          </span>
        )}
        {resolved && (
          <span className="rounded-full bg-white/70 px-3 py-1 font-landing text-xs capitalize text-[#9ca3af] dark:bg-white/10">
            {opportunity.status.replace("_", " ")}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h3 className="font-landing font-medium text-[#111827] dark:text-[#f9fafb]">
            {opportunity.headline}
          </h3>
          <p className="mt-2 font-landing text-sm leading-relaxed text-[#6b7280] dark:text-[#9ca3af]">
            {opportunity.llmReasoning}
          </p>
        </div>

        {/* Actions */}
        {!resolved && approvalMode === "manual" && (
          <div className="flex shrink-0 gap-2">
            <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#111827] px-4 py-2 font-landing text-sm text-white transition-colors hover:bg-[#374151] dark:bg-[#f9fafb] dark:text-[#111827] dark:hover:bg-[#e5e7eb]">
              Approve
            </button>
            <button className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#e5e7eb] px-4 py-2 font-landing text-sm text-[#6b7280] transition-colors hover:bg-white/50 dark:border-[#374151] dark:text-[#9ca3af]">
              Skip
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
