import { API_BASE_URL } from '@/lib/api';
import type { Agent, ApprovalSettings, Opportunity, UserPolicy } from '@/lib/types';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function getTaxeeUserId(): string | null {
  if (typeof window === 'undefined') return null;
  const id = localStorage.getItem('taxee_user_id');
  return id && UUID_RE.test(id) ? id : null;
}

function mapDbOpportunity(row: Record<string, unknown>): Opportunity {
  const executedAt = row.executedAt as string | undefined;
  const approvedAt = row.approvedAt as string | undefined;
  const deferredUntil = row.deferredUntil as string | undefined;
  const llmDecision = String(row.llmDecision ?? '');

  let status: Opportunity['status'] = 'pending';
  if (executedAt) status = 'executed';
  else if (deferredUntil) status = 'deferred';
  else if (llmDecision === 'SKIP') status = 'skipped';
  else if (approvedAt) status = 'pending';

  return {
    id: String(row.id),
    agentId: String(row.agentId),
    type: row.type as Opportunity['type'],
    status,
    headline: String(row.headline ?? ''),
    taxSavingEstimate: Number(row.taxSavingEstimate ?? 0),
    llmReasoning: String(row.llmReasoning ?? row.body ?? ''),
    createdAt: String(row.createdAt ?? new Date().toISOString()),
    resolvedAt: executedAt ?? approvedAt,
    txHash: row.txHash as string | undefined,
  };
}

export async function syncWebAgentToBackend(
  walletAddress: string,
  policy: UserPolicy,
  approval: ApprovalSettings,
): Promise<{ agentId: string; circleWalletId?: string } | null> {
  const userId = getTaxeeUserId();
  if (!userId || !walletAddress) return null;

  try {
    const res = await fetch(`${API_BASE_URL}/circle/sync-web-agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        walletAddress,
        policy,
        approvalMode: approval.mode,
      }),
    });
    let data: Record<string, unknown> = {};
    try {
      data = (await res.json()) as Record<string, unknown>;
    } catch {
      data = {};
    }
    if (!res.ok) {
      const errMsg = String(
        data.error ?? data.message ?? `HTTP ${res.status}`,
      );
      if (res.status === 404) {
        console.warn(
          '[sync-web-agent] API route not deployed yet — redeploy Railway API. Agent works locally until then.',
        );
      } else {
        console.warn('[sync-web-agent]', errMsg);
      }
      return null;
    }
    if (data.agentId) {
      localStorage.setItem('taxee_backend_agent_id', String(data.agentId));
    }
    return {
      agentId: String(data.agentId),
      circleWalletId: data.circleWalletId as string | undefined,
    };
  } catch (e) {
    console.error('[sync-web-agent]', e);
    return null;
  }
}

export type FetchOpportunitiesResult = {
  opportunities: Opportunity[];
  error?: string;
  /** Production Railway still on old build without circle routes */
  apiRouteMissing?: boolean;
};

export async function fetchWebOpportunities(): Promise<FetchOpportunitiesResult> {
  const userId = getTaxeeUserId();
  if (!userId) {
    return { opportunities: [], error: 'Missing taxee_user_id — complete Circle onboarding again.' };
  }

  try {
    const res = await fetch(`${API_BASE_URL}/circle/opportunities/${userId}`);
    let data: unknown;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    if (res.status === 404) {
      return {
        opportunities: [],
        apiRouteMissing: true,
        error:
          'Opportunities API not on production yet. Redeploy the Railway API service from latest main.',
      };
    }

    if (!res.ok || !Array.isArray(data)) {
      const errObj = data as Record<string, unknown> | null;
      return {
        opportunities: [],
        error: String(errObj?.error ?? errObj?.message ?? `HTTP ${res.status}`),
      };
    }

    return {
      opportunities: data.map((row) =>
        mapDbOpportunity(row as Record<string, unknown>),
      ),
    };
  } catch (e) {
    return {
      opportunities: [],
      error: e instanceof Error ? e.message : 'Could not reach API',
    };
  }
}

/** Trigger tax-engine heartbeat for this web user’s server agent(s) */
export async function runWebOpportunityScan(): Promise<{
  ok: boolean;
  totalSaved?: number;
  error?: string;
  apiRouteMissing?: boolean;
}> {
  const userId = getTaxeeUserId();
  if (!userId) return { ok: false, error: 'Missing taxee_user_id' };

  try {
    const res = await fetch(`${API_BASE_URL}/circle/run-scan/${userId}`, {
      method: 'POST',
    });
    const data = (await res.json()) as Record<string, unknown>;
    if (res.status === 404) {
      return {
        ok: false,
        apiRouteMissing: true,
        error:
          'Scan API not deployed yet. Redeploy Railway API, then use Refresh again.',
      };
    }
    if (!res.ok) {
      return { ok: false, error: String(data.error ?? data.message ?? `HTTP ${res.status}`) };
    }
    return {
      ok: true,
      totalSaved: Number(data.totalSaved ?? 0),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Scan request failed' };
  }
}

export async function resetWebRegistration(): Promise<boolean> {
  const userId = getTaxeeUserId();
  if (!userId) return true;

  try {
    const res = await fetch(`${API_BASE_URL}/circle/web-reset/${userId}`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function clearLocalRegistration(): void {
  if (typeof window === 'undefined') return;
  const keys = [
    'taxee_agent',
    'taxee_opportunities',
    'taxee_user_id',
    'taxee_circle_wallet',
    'taxee_primary_wallet',
    'taxee_backend_agent_id',
    'taxee_wallet_connection_type',
  ];
  for (const k of keys) localStorage.removeItem(k);
}

/** Full local + server reset for Circle onboarding mix-ups */
export async function fullWebReset(): Promise<void> {
  await resetWebRegistration();
  clearLocalRegistration();
}

export function getBackendAgentId(): string | null {
  if (typeof window === 'undefined') return null;
  const id = localStorage.getItem('taxee_backend_agent_id');
  return id && UUID_RE.test(id) ? id : null;
}

/** True if this opportunity can use Circle execute flow on Railway */
export function isServerExecutableOpportunity(opp: Opportunity): boolean {
  return UUID_RE.test(opp.id) && !opp.id.startsWith('opp-demo');
}
