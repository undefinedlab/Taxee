import type { Agent, ApprovalSettings, Opportunity, UserPolicy } from "./types";
import { createDemoAgent, defaultApproval } from "./mock-data";
import { saveWalletConnectionType } from "./wallet-session";

const AGENT_KEY = "taxee_agent";
const OPPORTUNITIES_KEY = "taxee_opportunities";

export function saveAgent(agent: Agent): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(AGENT_KEY, JSON.stringify(agent));
}

export function loadAgent(): Agent | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(AGENT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Agent;
  } catch {
    return null;
  }
}

export function registerAgent(
  walletAddress: string,
  policy: UserPolicy,
  approval: ApprovalSettings = defaultApproval,
): Agent {
  if (policy.walletConnectionType) {
    saveWalletConnectionType(policy.walletConnectionType);
  }
  const agent = createDemoAgent(walletAddress, policy, approval);
  saveAgent(agent);
  saveOpportunities([]);
  return agent;
}

export function updateAgentApproval(approval: ApprovalSettings): Agent | null {
  const agent = loadAgent();
  if (!agent) return null;
  const updated = { ...agent, approval };
  saveAgent(updated);
  return updated;
}

export function saveOpportunities(opportunities: Opportunity[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(OPPORTUNITIES_KEY, JSON.stringify(opportunities));
}

export function loadOpportunities(): Opportunity[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(OPPORTUNITIES_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Opportunity[];
  } catch {
    return [];
  }
}

export function updateOpportunityStatus(
  opportunityId: string,
  status: Opportunity["status"],
  meta?: { txHash?: string },
): Opportunity[] {
  const list = loadOpportunities().map((o) =>
    o.id === opportunityId
      ? {
          ...o,
          status,
          resolvedAt: new Date().toISOString(),
          ...(meta?.txHash ? { txHash: meta.txHash } : {}),
        }
      : o,
  );
  saveOpportunities(list);
  return list;
}

/** Non-pending opportunities + actions, newest first */
export function loadTransactionHistory(agentId?: string): Opportunity[] {
  return loadOpportunities()
    .filter((o) => o.status !== "pending" && (!agentId || o.agentId === agentId))
    .sort(
      (a, b) =>
        new Date(b.resolvedAt ?? b.createdAt).getTime() -
        new Date(a.resolvedAt ?? a.createdAt).getTime(),
    );
}
