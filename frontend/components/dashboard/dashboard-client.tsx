"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import type { Agent, Opportunity, WalletConnectionType } from "@/lib/types";
import { defaultApproval, demoAgent, demoRegime } from "@/lib/mock-data";
import {
  loadAgent,
  loadOpportunities,
  saveOpportunities,
  updateAgentApproval,
  updateOpportunityStatus,
} from "@/lib/agent-store";
import {
  approveOpportunityOnServer,
  fetchWebOpportunities,
  reloadOpportunitiesFromServer,
  runWebOpportunityScan,
  skipOpportunityOnServer,
  fullWebReset,
  getTaxeeUserId,
  isServerExecutableOpportunity,
  syncWebAgentToBackend,
} from "@/lib/web-agent-api";
import {
  getStoredCircleAddress,
  resolvePrimaryWalletAddress,
  walletModeLabel,
} from "@/lib/primary-wallet";
import {
  getWalletConnectionType,
  getActiveWalletAddress,
} from "@/lib/wallet-session";
import { DepositFundsButton } from "@/components/wallet/deposit-funds-button";
import { useWalletData } from "@/hooks/use-wallet-data";
import { truncateAddress, opportunitySummary } from "@/lib/utils";
import type { ApprovalSettings } from "@/lib/types";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { LandingMorphBackground } from "@/components/landing/landing-morph-background";
import { useDelegationStatus } from "@/components/wallet/use-taxee-contracts";
import { AgentActivation } from "@/components/wallet/agent-activation";

interface DashboardClientProps {
  agentId: string;
}

function resolveConnectionType(agent: Agent | null): WalletConnectionType {
  if (agent?.policy.walletConnectionType) return agent.policy.walletConnectionType;
  const stored = getWalletConnectionType();
  if (stored) return stored;
  return "external_eip7702";
}

export function DashboardClient({ agentId }: DashboardClientProps) {
  const router = useRouter();
  const { address: wagmiAddress } = useAccount();
  const [agent, setAgent] = useState<Agent | null>(() =>
    typeof window !== "undefined" ? loadAgent() : null,
  );
  const [hydrated, setHydrated] = useState(false);
  const [approval, setApproval] = useState<ApprovalSettings | null>(null);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activityTab, setActivityTab] = useState<"opportunities" | "history">(
    "opportunities",
  );
  const [refreshingOpps, setRefreshingOpps] = useState(false);
  const [oppsRefreshNote, setOppsRefreshNote] = useState<string | null>(null);
  const [showActivation, setShowActivation] = useState(false);

  useEffect(() => {
    setHydrated(true);
    const stored = loadAgent();
    if (stored && (stored.id === agentId || agentId === "demo")) {
      const conn = resolveConnectionType(stored);
      const patched = stored;
      const withApproval = {
        ...patched,
        approval: {
          ...defaultApproval,
          ...patched.approval,
          mode: patched.approval?.mode ?? "manual",
        },
      };
      setAgent(withApproval);
      setApproval(withApproval.approval);
    } else if (agentId === "demo") {
      setAgent(demoAgent);
      setApproval(demoAgent.approval);
    } else if (!stored) {
      setAgent(null);
      setApproval(null);
    } else {
      setAgent(demoAgent);
      setApproval(demoAgent.approval);
    }
    const storedOpps = loadOpportunities().filter(
      (o) => o.agentId === agentId || agentId === "demo",
    );

    void (async () => {
      const { opportunities: remote, error, apiRouteMissing } =
        await fetchWebOpportunities();
      if (remote.length > 0) {
        setOpportunities(remote);
        saveOpportunities(remote);
        setOppsRefreshNote(null);
      } else {
        setOpportunities(storedOpps);
        if (error) setOppsRefreshNote(error);
        else if (apiRouteMissing) {
          setOppsRefreshNote(
            "Production API is missing opportunity routes — redeploy Railway API.",
          );
        }
      }
    })();
  }, [agentId]);

  const hasRegisteredAgent = !!agent && agentId !== "demo";
  const displayAgent = agent ?? demoAgent;
  const connType = resolveConnectionType(agent);
  const displayApproval: ApprovalSettings = {
    ...defaultApproval,
    ...displayAgent.approval,
    ...(approval ?? {}),
    mode: approval?.mode ?? displayAgent.approval?.mode ?? "manual",
  };
  const wallet =
    connType === "circle"
      ? getActiveWalletAddress(connType, displayAgent.wallets[0]?.address)
      : resolvePrimaryWalletAddress({
          connectionType: connType,
          storedWallet: displayAgent.wallets[0]?.address,
          wagmiAddress: wagmiAddress,
        });
  const walletValid = /^0x[a-fA-F0-9]{40}$/.test(wallet);
  const walletMode = walletModeLabel(connType);
  const {
    positions: livePositions,
    totalValueUsd,
    isLoading: portfolioLoading,
    error: portfolioError,
  } = useWalletData(walletValid ? wallet : undefined, {
    fallbackToConnected: connType === "external_eip7702",
  });

  const { hasDelegation, isLoading: delegationLoading, refetch: refetchDelegation } = useDelegationStatus();

  const activeOpportunities = opportunities.filter(
    (o) =>
      o.status === "pending" ||
      o.status === "approved" ||
      o.status === "failed",
  );
  const pending = activeOpportunities;
  const history = opportunities
    .filter((o) => o.status !== "pending" && o.status !== "approved")
    .sort(
      (a, b) =>
        new Date(b.resolvedAt ?? b.createdAt).getTime() -
        new Date(a.resolvedAt ?? a.createdAt).getTime(),
    );

  const displayApprovalMode = displayApproval?.mode ?? "manual";

  const totalValue = walletValid ? totalValueUsd : 0;
  const totalTaxSaved = opportunities
    .filter((o) => o.status === "executed" || o.status === "auto_executed")
    .reduce((sum, o) => sum + (o.taxSavingEstimate || 0), 0);
  const pendingTaxSavings = pending.reduce((sum, o) => sum + (o.taxSavingEstimate || 0), 0);

  const heartbeatMin =
    displayAgent.policy.heartbeatIntervalMinutes ??
    displayAgent.heartbeatIntervalMinutes ??
    60;
  const agentStatusLabel =
    displayAgent.status === "active"
      ? "Active"
      : displayAgent.status === "paused"
        ? "Paused"
        : "Setup";

  const needsWalletSetup =
    hydrated &&
    hasRegisteredAgent &&
    (connType === "circle" ? !getStoredCircleAddress() : !walletValid);
  const needsOnboarding = hydrated && !hasRegisteredAgent && agentId !== "demo";

  const applyServerOpportunities = useCallback(
    (remote: Opportunity[]) => {
      setOpportunities(remote);
      saveOpportunities(remote);
    },
    [],
  );

  const handleApprove = useCallback(
    async (opp: Opportunity) => {
      if (connType === "watch") {
        window.alert(
          "Watch-only mode: Taxee cannot execute from the dashboard.",
        );
        return;
      }

      if (!isServerExecutableOpportunity(opp)) {
        window.alert(
          "This opportunity is only stored locally. Refresh after a server scan, or reset onboarding.",
        );
        return;
      }

      if (connType === "external_eip7702" && !delegationLoading && !hasDelegation) {
        setShowActivation(true);
        return;
      }

      if (connType === "circle") {
        const approved = await approveOpportunityOnServer(opp.id);
        if (!approved.ok) {
          window.alert(approved.error ?? "Approve failed");
          return;
        }
        router.push(`/execute?oppId=${encodeURIComponent(opp.id)}`);
        return;
      }

      const result = await approveOpportunityOnServer(opp.id, {
        preferredExecution:
          connType === "external_eip7702" ? "eip7702" : undefined,
      });
      if (!result.ok) {
        window.alert(result.error ?? "Approve failed");
        return;
      }

      const remote = await reloadOpportunitiesFromServer();
      if (remote.opportunities.length > 0) {
        applyServerOpportunities(remote.opportunities);
      }

      if (result.execution === "eip7702_started") {
        setOppsRefreshNote(
          "Executing via EIP-7702 on Base Sepolia — tx hash will appear in History shortly.",
        );
      } else if (result.execution === "circle_started") {
        setOppsRefreshNote("Executing on-chain via Circle — check History for tx hash.");
      } else {
        setOppsRefreshNote(
          result.message ??
            "Approved on server. Tx hash appears in History after execution completes.",
        );
      }

      const pollMs = result.execution === "eip7702_started" ? 3000 : 4000;
      window.setTimeout(() => {
        void reloadOpportunitiesFromServer().then((r) => {
          if (r.opportunities.length > 0) applyServerOpportunities(r.opportunities);
        });
      }, pollMs);
    },
    [connType, router, applyServerOpportunities, hasDelegation, delegationLoading],
  );

  const handleSkip = useCallback(
    async (opp: Opportunity) => {
      if (isServerExecutableOpportunity(opp)) {
        const result = await skipOpportunityOnServer(opp.id);
        if (!result.ok) {
          window.alert(result.error ?? "Skip failed");
          return;
        }
        const remote = await reloadOpportunitiesFromServer();
        applyServerOpportunities(remote.opportunities);
        return;
      }
      setOpportunities(updateOpportunityStatus(opp.id, "skipped"));
    },
    [applyServerOpportunities],
  );

  const handleRefreshOpportunities = useCallback(async () => {
    setRefreshingOpps(true);
    setOppsRefreshNote(null);
    let note: string | null = null;
    try {
      let scan = await runWebOpportunityScan();
      if (scan.error?.includes('No server agent') && walletValid) {
        const synced = await syncWebAgentToBackend(
          wallet,
          { ...displayAgent.policy, walletConnectionType: connType },
          displayApproval,
        );
        if (synced) {
          scan = await runWebOpportunityScan();
        } else {
          note =
            connType === 'circle'
              ? 'Could not link Circle agent — finish PIN setup, then Settings → Sync.'
              : 'Could not link MetaMask agent — connect the same wallet, then Settings → Sync.';
        }
      }
      if (scan.error) {
        note = scan.error;
      } else if (scan.ok && scan.totalSaved !== undefined) {
        note =
          scan.totalSaved > 0
            ? `Scan complete — ${scan.totalSaved} new opportunit${scan.totalSaved === 1 ? "y" : "ies"}.`
            : "Scan complete — no tax actions flagged (empty wallet, no losses, or LLM skipped).";
      }

      const { opportunities: remote, error, apiRouteMissing } =
        await fetchWebOpportunities();
      if (remote.length > 0) {
        setOpportunities(remote);
        saveOpportunities(remote);
        if (scan.ok && scan.totalSaved && scan.totalSaved > 0) {
          note = `Showing ${remote.length} opportunit${remote.length === 1 ? "y" : "ies"}.`;
        } else {
          note = null;
        }
      } else if (!scan.error && !error) {
        const stored = loadOpportunities().filter(
          (o) => o.agentId === agentId || agentId === "demo",
        );
        setOpportunities(stored);
      }
      if (error) note = error;
      else if (apiRouteMissing && !scan.apiRouteMissing) {
        note =
          note ??
          "Deploy latest API so Refresh can list opportunities from the database.";
      }
      setOppsRefreshNote(note);
    } finally {
      setRefreshingOpps(false);
    }
  }, [
    agentId,
    connType,
    wallet,
    walletValid,
    displayAgent.policy,
    displayApproval,
  ]);

  const handleApproveAll = useCallback(() => {
    if (pending.length === 0) return;
    const executable = pending.find((o) => isServerExecutableOpportunity(o));
    if (connType === "circle") {
      if (!executable) {
        window.alert("No server-backed opportunities to execute. Sync via Settings or use Telegram.");
        return;
      }
      router.push(`/execute?oppId=${encodeURIComponent(executable.id)}`);
      return;
    }
    void handleApprove(executable ?? pending[0]!);
  }, [pending, connType, router, handleApprove]);

  const handleResetRegistration = useCallback(async () => {
    if (
      !window.confirm(
        "Reset this registration?\n\nClears local data and deletes web agents on the server. You can onboard again (MetaMask or Circle).",
      )
    ) {
      return;
    }
    await fullWebReset();
    setSettingsOpen(false);
    router.push("/onboarding");
  }, [router]);

  const handleResyncAgent = useCallback(async () => {
    const policy = {
      ...displayAgent.policy,
      walletConnectionType: connType,
    };
    const synced = await syncWebAgentToBackend(wallet, policy, displayApproval);
    if (synced) {
      const mode =
        connType === "circle"
          ? `Circle wallet linked (${synced.circleWalletId ? "MPC ready" : "pending"})`
          : `MetaMask agent linked at ${truncateAddress(wallet)}`;
      window.alert(`Linked to server.\n${mode}`);
      const remote = await fetchWebOpportunities();
      if (remote.opportunities.length > 0) {
        setOpportunities(remote.opportunities);
        saveOpportunities(remote.opportunities);
      }
    } else {
      window.alert(
        connType === "circle"
          ? "Sync failed — complete Circle PIN or redeploy API."
          : "Sync failed — connect MetaMask with the same address you used in onboarding, then try again.",
      );
    }
  }, [wallet, connType, displayAgent.policy, displayApproval]);

  return (
    <div className="landing-root landing-marble-bg relative min-h-screen">
      <LandingMorphBackground />
      <div className="relative z-[1] p-3 sm:p-5 lg:p-8">
        <div className="mx-auto max-w-[1320px] space-y-6 sm:space-y-8">
          <div className="landing-card-sharp landing-glass landing-animate-in overflow-hidden">
            <DashboardHeader
              onOpenSettings={() => setSettingsOpen(true)}
              walletConnectionType={connType}
            />
            <main className="relative px-6 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10">
              {(needsOnboarding || needsWalletSetup) && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/75 p-6 backdrop-blur-sm dark:bg-[#0a0a0a]/80">
                  <div className="max-w-md rounded-xl border border-[#e5e7eb] bg-white p-8 text-center shadow-lg dark:border-[#2a2a2a] dark:bg-[#141414]">
                    <h2 className="font-serif text-xl font-bold text-[#111827] dark:text-[#f9fafb]">
                      {needsOnboarding ? "Register your wallet first" : "Complete wallet setup"}
                    </h2>
                    <p className="mt-2 font-landing text-sm text-[#6b7280] dark:text-[#9ca3af]">
                      {needsOnboarding
                        ? "Finish onboarding to create or connect your taxee wallet before using the dashboard."
                        : "Your Circle wallet is not linked in this browser. Finish setup or reset registration."}
                    </p>
                    <button
                      type="button"
                      onClick={() => router.push("/onboarding")}
                      className="mt-6 rounded-lg bg-[#111827] px-6 py-3 font-landing text-sm font-medium text-white dark:bg-[#f9fafb] dark:text-[#111827]"
                    >
                      Go to onboarding
                    </button>
                  </div>
                </div>
              )}
              {/* Stats Bar - Clean Design */}
              <div className="mb-6 grid grid-cols-2 gap-8 border-b border-[#e5e7eb] pb-6 dark:border-[#2a2a2a] sm:grid-cols-4">
                <div>
                  <p className="font-landing text-xs uppercase tracking-wider text-[#9ca3af]">Portfolio Value</p>
                  <p className="mt-1 font-serif text-3xl font-semibold text-[#111827] dark:text-[#f9fafb]">
                    ${totalValue.toLocaleString()}
                  </p>
                  <p className="mt-1 font-landing text-sm text-[#9ca3af]">
                    {portfolioLoading
                      ? "Loading…"
                      : portfolioError
                        ? "Scan error"
                        : walletValid
                          ? `${livePositions.length} on-chain position${livePositions.length !== 1 ? "s" : ""}`
                          : "No wallet"}
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
                  <p className="font-landing text-xs uppercase tracking-wider text-[#9ca3af]">Agent</p>
                  <p className="mt-1 font-serif text-3xl font-semibold text-[#111827] dark:text-[#f9fafb]">
                    {agentStatusLabel}
                  </p>
                  <p className="mt-1 font-landing text-sm text-[#9ca3af]">
                    Heartbeat every {heartbeatMin} min · {walletMode}
                  </p>
                </div>
              </div>

              {/* Policy Row */}
              <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-[#e5e7eb] pb-3 dark:border-[#2a2a2a]">
                <div className="flex items-center gap-2">
                  <span className="font-landing text-xs uppercase tracking-wider text-[#9ca3af]">Harvest</span>
                  <span className="font-landing text-sm font-medium text-[#111827] dark:text-[#f9fafb]">−{displayAgent.policy.harvestThresholdPct}%</span>
                </div>
                <div className="h-4 w-px bg-[#e5e7eb] dark:bg-[#2a2a2a]" />
                <div className="flex items-center gap-2">
                  <span className="font-landing text-xs uppercase tracking-wider text-[#9ca3af]">Jurisdiction</span>
                  <span className="font-landing text-sm font-medium text-[#111827] dark:text-[#f9fafb]">{displayAgent.policy.jurisdiction}</span>
                </div>
                <div className="h-4 w-px bg-[#e5e7eb] dark:bg-[#2a2a2a]" />
                <div className="flex items-center gap-2">
                  <span className="font-landing text-xs uppercase tracking-wider text-[#9ca3af]">Objective</span>
                  <span className="font-landing text-sm font-medium capitalize text-[#111827] dark:text-[#f9fafb]">{displayAgent.policy.primaryObjective.replace("_", " ")}</span>
                </div>
              </div>

              {/* Two Column Layout */}
              <div className="grid gap-8 lg:grid-cols-3">
                {/* Left Column - Opportunities (2/3) */}
                <div className="lg:col-span-2">
                  <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <h2 className="font-serif text-xl font-bold text-[#111827] dark:text-[#f9fafb]">
                        Activity
                      </h2>
                      <p className="mt-1 font-landing text-sm text-[#9ca3af]">
                        {activityTab === "opportunities"
                          ? `${pending.length} waiting for review`
                          : `${history.length} past action${history.length !== 1 ? "s" : ""}`}
                      </p>
                    </div>
                    {activityTab === "opportunities" && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void handleRefreshOpportunities()}
                          disabled={refreshingOpps}
                          className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#e5e7eb] text-[#6b7280] transition-colors hover:bg-white/50 hover:text-[#111827] disabled:opacity-50 dark:border-[#2a2a2a] dark:text-[#9ca3af] dark:hover:bg-white/10 dark:hover:text-[#f9fafb]"
                          title="Check for new opportunities"
                          aria-label="Refresh opportunities"
                        >
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className={refreshingOpps ? "animate-spin" : undefined}
                            aria-hidden
                          >
                            <path d="M23 4v6h-6" />
                            <path d="M1 20v-6h6" />
                            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={handleApproveAll}
                          disabled={pending.length === 0}
                          className="flex h-9 w-9 items-center justify-center rounded-lg text-[#6b7280] transition-colors hover:bg-white/50 hover:text-[#111827] disabled:opacity-40 dark:text-[#9ca3af] dark:hover:bg-white/10 dark:hover:text-[#f9fafb]"
                          title="Approve all"
                          aria-label="Approve all"
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* ── Delegation activation banner ──────────────────── */}
                  {connType === "external_eip7702" && !delegationLoading && !hasDelegation && (
                    <div className="mb-4 landing-glass rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                      {showActivation ? (
                        <AgentActivation
                          policy={displayAgent.policy as Parameters<typeof AgentActivation>[0]["policy"]}
                          onSuccess={() => {
                            setShowActivation(false);
                            void refetchDelegation();
                          }}
                          onBack={() => setShowActivation(false)}
                        />
                      ) : (
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="font-landing text-sm font-medium text-amber-400">
                              Agent activation required
                            </p>
                            <p className="font-landing text-xs text-[#9ca3af] mt-0.5">
                              Sign a one-time EIP-7702 delegation so Taxee can execute on your behalf.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowActivation(true)}
                            className="shrink-0 rounded-lg bg-amber-500 px-4 py-2 font-landing text-sm font-medium text-white hover:bg-amber-400 transition-colors"
                          >
                            Activate
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mb-4 inline-flex rounded-lg border border-[#e5e7eb] bg-white/50 p-1 dark:border-[#2a2a2a] dark:bg-white/5">
                    <button
                      type="button"
                      onClick={() => setActivityTab("opportunities")}
                      className={`rounded-md px-4 py-2 font-landing text-sm font-medium transition-colors ${
                        activityTab === "opportunities"
                          ? "bg-[#111827] text-white dark:bg-[#f9fafb] dark:text-[#111827]"
                          : "text-[#6b7280] hover:text-[#111827] dark:text-[#9ca3af] dark:hover:text-[#f9fafb]"
                      }`}
                    >
                      Opportunities
                      {pending.length > 0 && (
                        <span className="ml-2 rounded-full bg-white/20 px-1.5 py-0.5 text-xs dark:bg-black/10">
                          {pending.length}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActivityTab("history")}
                      className={`rounded-md px-4 py-2 font-landing text-sm font-medium transition-colors ${
                        activityTab === "history"
                          ? "bg-[#111827] text-white dark:bg-[#f9fafb] dark:text-[#111827]"
                          : "text-[#6b7280] hover:text-[#111827] dark:text-[#9ca3af] dark:hover:text-[#f9fafb]"
                      }`}
                    >
                      History
                      {history.length > 0 && (
                        <span className="ml-2 rounded-full bg-white/20 px-1.5 py-0.5 text-xs dark:bg-black/10">
                          {history.length}
                        </span>
                      )}
                    </button>
                  </div>

                  <div className="space-y-4">
                    {activityTab === "opportunities" &&
                      (pending.length === 0 ? (
                        <div className="landing-glass rounded-xl p-8 text-center space-y-3">
                          <p className="font-landing text-[#9ca3af]">
                            {refreshingOpps
                              ? "Running scan and checking opportunities…"
                              : "Nothing flagged yet — tap Refresh to run a scan."}
                          </p>
                          {oppsRefreshNote && (
                            <p className="font-landing text-xs text-amber-700 dark:text-amber-400/90 max-w-md mx-auto">
                              {oppsRefreshNote}
                            </p>
                          )}
                          {!oppsRefreshNote && !refreshingOpps && (
                            <p className="font-landing text-xs text-[#9ca3af] max-w-md mx-auto">
                              Needs: server agent synced, funded wallet with open lots, and API +
                              agent worker deployed on Railway.
                            </p>
                          )}
                        </div>
                      ) : (
                        pending.map((opportunity) => (
                          <OpportunityCard
                            key={opportunity.id}
                            opportunity={opportunity}
                            approvalMode={displayApprovalMode}
                            onApprove={() => handleApprove(opportunity)}
                            onSkip={() => handleSkip(opportunity)}
                          />
                        ))
                      ))}

                    {activityTab === "history" &&
                      (history.length === 0 ? (
                        <div className="landing-glass rounded-xl p-8 text-center">
                          <p className="font-landing text-[#9ca3af]">
                            No transactions yet. Approved, skipped, and executed actions will appear here.
                          </p>
                        </div>
                      ) : (
                        history.map((item) => (
                          <TransactionHistoryRow key={item.id} item={item} />
                        ))
                      ))}
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
                        {displayApprovalMode === "manual" ? "Manual (default)" : "Delegated"}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const next: ApprovalSettings = {
                          ...displayApproval,
                          mode:
                            displayApprovalMode === "manual" ? "delegated" : "manual",
                        };
                        setApproval(next);
                        updateAgentApproval(next);
                      }}
                      className="relative flex h-8 w-full items-center rounded-full bg-white/50 p-1 dark:bg-white/10"
                    >
                      <div
                        className={`absolute h-6 w-1/2 rounded-full bg-[#111827] transition-all duration-200 dark:bg-[#f9fafb] ${
                          displayApprovalMode === "delegated" ? "left-1/2" : "left-1"
                        }`}
                      />
                      <span
                        className={`relative z-10 flex-1 text-center font-landing text-xs ${
                          displayApprovalMode === "manual"
                            ? "text-white dark:text-[#111827]"
                            : "text-[#6b7280] dark:text-[#9ca3af]"
                        }`}
                      >
                        Manual
                      </span>
                      <span
                        className={`relative z-10 flex-1 text-center font-landing text-xs ${
                          displayApprovalMode === "delegated"
                            ? "text-white dark:text-[#111827]"
                            : "text-[#6b7280] dark:text-[#9ca3af]"
                        }`}
                      >
                        Delegated
                      </span>
                    </button>

                    <p className="mt-3 font-landing text-xs text-[#9ca3af]">
                      {displayApprovalMode === "manual"
                        ? "Standard: you approve each action before anything runs"
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
                        <span className="rounded-full bg-[#f3f4f6] px-3 py-1 font-landing text-xs text-[#6b7280] dark:bg-[#2a2a2a] dark:text-[#9ca3af]">
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
                      <span className="font-landing text-xs text-[#9ca3af]">
                        {walletValid ? `${livePositions.length} on-chain` : "—"}
                      </span>
                    </div>
                    {portfolioError && (
                      <p className="mb-2 font-landing text-xs text-red-500">{portfolioError}</p>
                    )}
                    <div className="space-y-2">
                      {portfolioLoading && walletValid ? (
                        <p className="font-landing text-sm text-[#9ca3af] py-4 text-center">Loading balances…</p>
                      ) : livePositions.length === 0 ? (
                        <div className="space-y-3 py-4 text-center">
                          <p className="font-landing text-sm text-[#9ca3af]">
                            {walletValid
                              ? `No positions on ${truncateAddress(wallet)} (Base Sepolia)`
                              : "Connect or complete onboarding with a wallet address"}
                          </p>
                          {walletValid && (
                            <DepositFundsButton address={wallet} className="mx-auto" />
                          )}
                        </div>
                      ) : (
                        livePositions.slice(0, 6).map((pos, index) => (
                          <div key={`${pos.symbol}-${index}`} className="flex items-center justify-between rounded-lg bg-white/50 px-3 py-2 dark:bg-white/5">
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f3f4f6] font-bold text-xs text-[#374151] dark:bg-[#2a2a2a] dark:text-[#d1d5db]">
                                {pos.symbol.slice(0, 2)}
                              </div>
                              <div>
                                <span className="font-landing text-sm font-medium text-[#111827] dark:text-[#f9fafb]">
                                  {pos.symbol}
                                </span>
                                <span className="ml-2 font-landing text-xs text-[#9ca3af]">
                                  {pos.chain}
                                </span>
                              </div>
                            </div>
                            <span className="font-landing text-sm text-[#111827] dark:text-[#f9fafb]">
                              ${pos.valueUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </span>
                          </div>
                        ))
                      )}
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
          <div className="w-full max-w-md rounded-xl border border-[#e5e7eb] bg-white p-6 shadow-xl dark:border-[#2a2a2a] dark:bg-[#141414]">
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

            <div className="mb-4 rounded-lg bg-[#f9fafb] p-3 font-landing text-xs text-[#6b7280] dark:bg-[#1a1a1a] dark:text-[#9ca3af]">
              <p>
                <span className="font-medium text-[#111827] dark:text-[#f9fafb]">Wallet mode:</span>{" "}
                {connType === "circle"
                  ? "Circle MPC (PIN)"
                  : connType === "watch"
                    ? "Watch-only"
                    : "MetaMask / EIP-7702"}
              </p>
              {walletValid && (
                <p className="mt-1 font-mono">{truncateAddress(wallet)}</p>
              )}
              {getTaxeeUserId() && (
                <p className="mt-1 font-mono">User: {getTaxeeUserId()!.slice(0, 8)}…</p>
              )}
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => void handleResyncAgent()}
                className="flex w-full items-center gap-3 rounded-lg border border-[#e5e7eb] p-4 text-left transition-colors hover:bg-[#f9fafb] dark:border-[#2a2a2a] dark:hover:bg-[#1a1a1a]"
              >
                <div>
                  <p className="font-landing font-medium text-[#111827] dark:text-[#f9fafb]">
                    {connType === "circle"
                      ? "Sync Circle agent to server"
                      : "Sync MetaMask agent to server"}
                  </p>
                  <p className="font-landing text-xs text-[#9ca3af]">
                    {connType === "circle"
                      ? "Links your Circle MPC wallet for PIN approvals and scans"
                      : "Registers your connected wallet + EIP-7702 policy for opportunity scans"}
                  </p>
                </div>
              </button>

              <button type="button" className="flex w-full items-center gap-3 rounded-lg border border-[#e5e7eb] p-4 text-left transition-colors hover:bg-[#f9fafb] dark:border-[#2a2a2a] dark:hover:bg-[#1a1a1a]">
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

              <button className="flex w-full items-center gap-3 rounded-lg border border-[#e5e7eb] p-4 text-left transition-colors hover:bg-[#f9fafb] dark:border-[#2a2a2a] dark:hover:bg-[#1a1a1a]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#9ca3af]">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                <div>
                  <p className="font-landing font-medium text-[#111827] dark:text-[#f9fafb]">Edit policy</p>
                  <p className="font-landing text-xs text-[#9ca3af]">Change thresholds and preferences</p>
                </div>
              </button>

              <button className="flex w-full items-center gap-3 rounded-lg border border-[#e5e7eb] p-4 text-left transition-colors hover:bg-[#f9fafb] dark:border-[#2a2a2a] dark:hover:bg-[#1a1a1a]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#9ca3af]">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <div>
                  <p className="font-landing font-medium text-[#111827] dark:text-[#f9fafb]">Heartbeat timing</p>
                  <p className="font-landing text-xs text-[#9ca3af]">Currently every 60 minutes</p>
                </div>
              </button>

              <button className="flex w-full items-center gap-3 rounded-lg border border-[#e5e7eb] p-4 text-left transition-colors hover:bg-[#f9fafb] dark:border-[#2a2a2a] dark:hover:bg-[#1a1a1a]">
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

              <div className="my-4 border-t border-[#e5e7eb] dark:border-[#2a2a2a]" />

              <button
                type="button"
                onClick={() => void handleResetRegistration()}
                className="flex w-full items-center gap-3 rounded-lg border border-red-200 p-4 text-left transition-colors hover:bg-red-50 dark:border-red-900/30 dark:hover:bg-red-900/20"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-500">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                <div>
                  <p className="font-landing font-medium text-red-600 dark:text-red-400">Reset registration</p>
                  <p className="font-landing text-xs text-red-400/70">
                    Clear local app data and delete web agents on server (keeps Circle wallet)
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



const STATUS_LABELS: Record<Opportunity["status"], string> = {
  pending: "Pending",
  approved: "Approved",
  executed: "Executed",
  failed: "Failed",
  deferred: "Deferred",
  skipped: "Skipped",
  auto_executed: "Auto-executed",
};

function TransactionHistoryRow({ item }: { item: Opportunity }) {
  const typeLabels: Record<string, string> = {
    HARVEST: "Tax Loss Harvest",
    REBALANCE: "Rebalance",
    PARK: "Yield Park",
  };
  const when = new Date(item.resolvedAt ?? item.createdAt).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="landing-glass rounded-xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white/70 px-3 py-1 font-landing text-xs text-[#9ca3af] dark:bg-white/10">
              {typeLabels[item.type] ?? item.type}
            </span>
            <span className="rounded-full bg-[#f3f4f6] px-3 py-1 font-landing text-xs font-medium capitalize text-[#374151] dark:bg-[#2a2a2a] dark:text-[#d1d5db]">
              {STATUS_LABELS[item.status]}
            </span>
            {item.taxSavingEstimate > 0 && (
              <span className="font-landing text-xs text-[#6b7280] dark:text-[#9ca3af]">
                Est. tax impact ${item.taxSavingEstimate.toLocaleString()}
              </span>
            )}
          </div>
          <p className="font-landing text-sm text-[#6b7280] dark:text-[#9ca3af]">
            {opportunitySummary(item.headline, item.llmReasoning)}
          </p>
          {item.txHash && (
            <a
              href={`https://sepolia.basescan.org/tx/${item.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block font-mono text-xs text-blue-600 hover:underline dark:text-blue-400 break-all"
            >
              {truncateAddress(item.txHash)} ↗
            </a>
          )}
          {!item.txHash && (item.status === "executed" || item.status === "auto_executed") && (
            <p className="mt-1 font-landing text-xs text-[#9ca3af]">
              No tx hash yet — execution may still be processing.
            </p>
          )}
        </div>
        <p className="shrink-0 font-landing text-xs text-[#9ca3af]">{when}</p>
      </div>
    </div>
  );
}

// Opportunity Card Component
function OpportunityCard({
  opportunity,
  approvalMode,
  onApprove,
  onSkip,
  resolved = false,
}: {
  opportunity: Opportunity;
  approvalMode: string;
  onApprove: () => void;
  onSkip: () => void;
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
        <div className="flex-1 min-w-0">
          <p className="font-landing text-sm font-medium text-[#111827] dark:text-[#f9fafb]">
            {opportunitySummary(opportunity.headline, opportunity.llmReasoning)}
          </p>
          {opportunity.status === "approved" && (
            <p className="mt-1 font-landing text-xs text-amber-700 dark:text-amber-400/90">
              Approved — waiting for on-chain execution (tx hash will show in History)
            </p>
          )}
          {opportunity.status === "failed" && opportunity.executionError && (
            <p className="mt-1 font-landing text-xs text-red-600 dark:text-red-400">
              Execution failed: {opportunity.executionError}
            </p>
          )}
        </div>

        {/* Actions */}
        {!resolved && opportunity.status !== "approved" && approvalMode === "manual" && (
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => void onApprove()}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#111827] px-4 py-2 font-landing text-sm text-white transition-colors hover:bg-[#374151] dark:bg-[#f9fafb] dark:text-[#111827] dark:hover:bg-[#e5e7eb]"
            >
              Approve
            </button>
            <button
              type="button"
              onClick={() => void onSkip()}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#e5e7eb] px-4 py-2 font-landing text-sm text-[#6b7280] transition-colors hover:bg-white/50 dark:border-[#2a2a2a] dark:text-[#9ca3af] dark:hover:bg-white/10"
            >
              Skip
            </button>
          </div>
        )}
        {opportunity.status === "approved" && (
          <span className="shrink-0 font-landing text-xs text-[#9ca3af]">Executing…</span>
        )}
        {opportunity.status === "failed" && (
          <button
            type="button"
            onClick={() => void onApprove()}
            className="shrink-0 rounded-lg border border-[#e5e7eb] px-3 py-1.5 font-landing text-xs text-[#6b7280] hover:bg-white/50 dark:border-[#2a2a2a] dark:hover:bg-white/10"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}
