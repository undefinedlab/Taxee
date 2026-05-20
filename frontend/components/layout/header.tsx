import Link from "next/link";
import { Badge } from "@/components/ui/badge";

interface HeaderProps {
  agentActive?: boolean;
}

export function Header({ agentActive }: HeaderProps) {
  return (
    <header className="border-b border-surface-border bg-surface/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-lg font-semibold tracking-tight text-zinc-50">
            taxee
          </span>
          <Badge variant="muted">alpha</Badge>
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          {agentActive ? (
            <Badge variant="success">Agent active · hourly scan</Badge>
          ) : (
            <Link
              href="/onboarding"
              className="text-zinc-400 transition-colors hover:text-zinc-100"
            >
              Register agent
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
