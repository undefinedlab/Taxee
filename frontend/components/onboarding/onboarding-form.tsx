"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ApprovalSettings, UserPolicy } from "@/lib/types";
import { defaultApproval, defaultPolicy, DEMO_WALLET } from "@/lib/mock-data";
import { ApprovalModePicker } from "@/components/onboarding/approval-mode-picker";
import { registerAgent } from "@/lib/agent-store";
import { Button } from "@/components/ui/button";
import { truncateAddress } from "@/lib/utils";

type Step = "wallet" | "import" | "policy" | "done";

export function OnboardingForm() {
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
    <div className="mx-auto max-w-lg">
      <ol className="mb-8 flex gap-2 text-xs text-zinc-500">
        {(["wallet", "import", "policy", "done"] as Step[]).map((s, i) => (
          <li
            key={s}
            className={
              step === s
                ? "text-accent"
                : ["wallet", "import", "policy", "done"].indexOf(step) > i
                  ? "text-zinc-400"
                  : ""
            }
          >
            {i + 1}. {s}
          </li>
        ))}
      </ol>

      {step === "wallet" && (
        <div className="space-y-4">
          <h2 className="text-xl font-medium text-zinc-100">Connect wallet</h2>
          <p className="text-sm text-zinc-400">
            Watch tier only — paste a public address. We never ask for a seed
            phrase or private key.
          </p>
          <input
            type="text"
            placeholder="0x…"
            value={wallet}
            onChange={(e) => setWallet(e.target.value)}
            className="w-full rounded-lg border border-surface-border bg-surface px-4 py-3 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/30"
          />
          <button
            type="button"
            onClick={() => setWallet(DEMO_WALLET)}
            className="text-xs text-zinc-500 underline hover:text-zinc-300"
          >
            Use demo wallet ({truncateAddress(DEMO_WALLET)})
          </button>
          <Button
            className="w-full"
            disabled={!walletValid}
            onClick={() => setStep("import")}
          >
            Continue
          </Button>
        </div>
      )}

      {step === "import" && (
        <div className="space-y-4">
          <h2 className="text-xl font-medium text-zinc-100">Import history</h2>
          <p className="text-sm text-zinc-400">
            Read-only scan on Base, Ethereum, and Arbitrum — no keys required.
          </p>
          {importing ? (
            <div className="rounded-lg border border-surface-border bg-surface-raised p-6 text-center text-sm text-zinc-400">
              Importing transfers and reconstructing lots…
            </div>
          ) : (
            <Button className="w-full" onClick={runImport}>
              Run onchain import
            </Button>
          )}
          {!importing && (
            <p className="text-center text-xs text-zinc-600">
              Expect ~4 positions and 12 provisional lots for demo wallets
            </p>
          )}
        </div>
      )}

      {step === "policy" && (
        <div className="space-y-4">
          <div className="rounded-lg border border-surface-border bg-surface-raised p-4 text-sm text-zinc-300">
            <p>Found 4 positions, 12 lots (provisional)</p>
            <p className="mt-2 text-accent">Est. YTD realized gains: $8,400</p>
          </div>
          <h2 className="text-xl font-medium text-zinc-100">Preferences</h2>
          <label className="block text-sm text-zinc-400">
            Jurisdiction
            <select
              value={policy.jurisdiction}
              onChange={(e) =>
                setPolicy({
                  ...policy,
                  jurisdiction: e.target.value as UserPolicy["jurisdiction"],
                })
              }
              className="mt-1 w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-zinc-100"
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
          <label className="block text-sm text-zinc-400">
            Harvest when loss exceeds
            <select
              value={policy.harvestThresholdPct}
              onChange={(e) =>
                setPolicy({
                  ...policy,
                  harvestThresholdPct: Number(e.target.value),
                })
              }
              className="mt-1 w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-zinc-100"
            >
              <option value={-5}>5%</option>
              <option value={-8}>8%</option>
              <option value={-10}>10%</option>
            </select>
          </label>
          <label className="block text-sm text-zinc-400">
            Min harvest loss (USD)
            <select
              value={policy.minHarvestLossUsd ?? 0}
              onChange={(e) =>
                setPolicy({
                  ...policy,
                  minHarvestLossUsd: Number(e.target.value),
                })
              }
              className="mt-1 w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-zinc-100"
            >
              <option value={0}>Any</option>
              <option value={100}>$100+</option>
              <option value={500}>$500+</option>
            </select>
          </label>
          <label className="block text-sm text-zinc-400">
            Scan every
            <select
              value={policy.heartbeatIntervalMinutes ?? 30}
              onChange={(e) =>
                setPolicy({
                  ...policy,
                  heartbeatIntervalMinutes: Number(e.target.value),
                })
              }
              className="mt-1 w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-zinc-100"
            >
              <option value={15}>15 min</option>
              <option value={30}>30 min</option>
              <option value={60}>60 min</option>
            </select>
          </label>
          <ApprovalModePicker value={approval} onChange={setApproval} />
          <label className="block text-sm text-zinc-400">
            Goal (natural language → policy)
            <textarea
              defaultValue="Minimize taxes this year. Don't sell lots within 30 days of long-term threshold."
              rows={3}
              className="mt-1 w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-zinc-100"
              readOnly
            />
            <span className="mt-1 block text-xs text-zinc-600">
              LLM Goal Parser will map this on backend (demo: static policy)
            </span>
          </label>
          <Button className="w-full" onClick={finishOnboarding}>
            Activate agent
          </Button>
        </div>
      )}

      {step === "done" && agentId && (
        <div className="space-y-4 text-center">
          <div className="rounded-xl border border-accent/30 bg-emerald-950/20 p-6">
            <p className="text-lg font-medium text-accent">Agent active</p>
            <p className="mt-2 text-sm text-zinc-400">
              Heartbeat every 60 minutes ·{" "}
              {approval.mode === "delegated"
                ? "delegated (autonomous within policy)"
                : "manual (you approve each action)"}
            </p>
            <p className="mt-4 font-mono text-xs text-zinc-500">{agentId}</p>
          </div>
          <Button
            className="w-full"
            onClick={() => router.push(`/dashboard/${agentId}`)}
          >
            Open dashboard
          </Button>
        </div>
      )}
    </div>
  );
}
