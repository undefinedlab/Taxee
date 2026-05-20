"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Agent, Opportunity } from "@/lib/types";
import {
  demoAgent,
  demoMetrics,
  demoOpportunity,
  demoPositions,
  demoRegime,
} from "@/lib/mock-data";
import { loadAgent, loadOpportunities } from "@/lib/agent-store";
import { Header } from "@/components/layout/header";
import { MetricsGrid } from "@/components/dashboard/metrics-grid";
import { OpportunityCard } from "@/components/dashboard/opportunity-card";
import { PositionsTable } from "@/components/dashboard/positions-table";
import { RegimePanel } from "@/components/dashboard/regime-panel";
import { Badge } from "@/components/ui/badge";
import { truncateAddress } from "@/lib/utils";

interface DashboardClientProps {
  agentId: string;
}

export function DashboardClient({ agentId }: DashboardClientProps) {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);

  useEffect(() => {
    const stored = loadAgent();
    if (stored && (stored.id === agentId || agentId === "demo")) {
      setAgent(stored);
      setOpportunities(loadOpportunities());
    } else if (agentId === "demo") {
      setAgent(demoAgent);
      setOpportunities([demoOpportunity]);
    } else {
      setAgent(demoAgent);
      setOpportunities([{ ...demoOpportunity, agentId }]);
    }
  }, [agentId]);

  const displayAgent = agent ?? demoAgent;
  const wallet = displayAgent.wallets[0]?.address ?? "—";
  const pending = opportunities.filter((o) => o.status === "pending");

  return (
    <div className="min-h-screen bg-surface">
      <Header agentActive={displayAgent.status === "active"} />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              After-tax alpha dashboard
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-zinc-50">
              Portfolio · {truncateAddress(wallet)}
            </h1>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="success">Heartbeat · hourly</Badge>
              <Badge variant="muted">
                {displayAgent.executionTier} tier
              </Badge>
              <Badge variant="muted">
                Harvest −{displayAgent.policy.harvestThresholdPct}%
              </Badge>
            </div>
          </div>
          {agentId !== "demo" && (
            <Link
              href="/onboarding"
              className="text-sm text-zinc-500 hover:text-zinc-300"
            >
              Register another
            </Link>
          )}
        </div>

        <section className="mt-8">
          <MetricsGrid metrics={demoMetrics} />
        </section>

        <section className="mt-10">
          <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500">
            Pending opportunities
          </h2>
          {pending.length === 0 ? (
            <p className="mt-4 rounded-xl border border-surface-border bg-surface-raised p-6 text-sm text-zinc-500">
              Nothing flagged — agent will rescan on next heartbeat.
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              {pending.map((o) => (
                <OpportunityCard
                  key={o.id}
                  opportunity={o}
                  onUpdate={setOpportunities}
                />
              ))}
            </div>
          )}
          {opportunities.filter((o) => o.status !== "pending").length > 0 && (
            <div className="mt-6 space-y-4">
              <h3 className="text-xs text-zinc-600">Resolved</h3>
              {opportunities
                .filter((o) => o.status !== "pending")
                .map((o) => (
                  <OpportunityCard key={o.id} opportunity={o} />
                ))}
            </div>
          )}
        </section>

        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-zinc-500">
              Positions
            </h2>
            <PositionsTable positions={demoPositions} />
          </div>
          <RegimePanel regime={demoRegime} />
        </div>

        <section className="mt-10 rounded-xl border border-surface-border bg-surface-raised p-4">
          <h2 className="text-sm font-medium text-zinc-300">Agent lifecycle</h2>
          <ul className="mt-3 space-y-2 text-sm text-zinc-500">
            <li>
              <span className="text-zinc-400">Phase 2</span> — Hourly scan:
              prices, lots, regime → reason
            </li>
            <li>
              <span className="text-zinc-400">Phase 3</span> — You approve:
              Execute / Defer / Skip above
            </li>
            <li>
              <span className="text-zinc-400">Execute tier</span> — Connect Circle
              wallet when ready to sign txs from dashboard
            </li>
          </ul>
        </section>
      </main>
    </div>
  );
}
