import type { Agent, Opportunity, UserPolicy } from "./types";
import { createDemoAgent, demoOpportunity } from "./mock-data";

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

export function registerAgent(walletAddress: string, policy: UserPolicy): Agent {
  const agent = createDemoAgent(walletAddress, policy);
  saveAgent(agent);
  saveOpportunities([{ ...demoOpportunity, agentId: agent.id }]);
  return agent;
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
): Opportunity[] {
  const list = loadOpportunities().map((o) =>
    o.id === opportunityId ? { ...o, status } : o,
  );
  saveOpportunities(list);
  return list;
}
