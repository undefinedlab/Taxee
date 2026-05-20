import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-surface">
      <Header />
      <main>
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <Badge variant="success" className="mb-6">
            Circle stack · Arc ledger · LLM judgment
          </Badge>
          <h1 className="max-w-3xl text-balance text-4xl font-semibold tracking-tight text-zinc-50 sm:text-5xl">
            After-tax return is the optimization target — not gross performance.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-zinc-400">
            taxee runs continuously across your cross-chain portfolio. It scans
            hourly, reasons about tax cost vs benefit, and notifies you when
            there&apos;s something to do. You approve every move.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/onboarding">
              <Button className="min-w-[160px]">Register agent</Button>
            </Link>
            <Link href="/dashboard/demo">
              <Button variant="secondary">View demo dashboard</Button>
            </Link>
          </div>
        </section>

        <section className="border-t border-surface-border bg-surface-raised/30">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 sm:grid-cols-3 sm:px-6">
            <PhaseCard
              phase="1 — Once"
              title="Onboarding"
              description="Connect wallet, import history, set jurisdiction and harvest threshold. Done — never again."
            />
            <PhaseCard
              phase="2 — Always on"
              title="Heartbeat"
              description="Hourly scan of prices, lots, and regime. Agent reasons; you only hear when there's an opportunity."
            />
            <PhaseCard
              phase="3 — Your call"
              title="Action loop"
              description="Execute, Defer, or Skip every proposal. Circle executes only after you approve."
            />
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
          <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500">
            Also reachable via
          </h2>
          <ul className="mt-4 flex flex-wrap gap-4 text-sm text-zinc-400">
            <li className="rounded-lg border border-surface-border px-4 py-2">
              Telegram bot — register & notify
            </li>
            <li className="rounded-lg border border-surface-border px-4 py-2">
              MCP — OpenClaw / custom agents
            </li>
            <li className="rounded-lg border border-surface-border px-4 py-2">
              Watch tier — address only, no keys
            </li>
          </ul>
        </section>
      </main>
    </div>
  );
}

function PhaseCard({
  phase,
  title,
  description,
}: {
  phase: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-surface-border bg-surface-raised p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-accent">
        {phase}
      </p>
      <h3 className="mt-2 text-lg font-medium text-zinc-100">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">{description}</p>
    </div>
  );
}
