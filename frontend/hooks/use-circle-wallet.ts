'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { API_BASE_URL } from '@/lib/api';

function newUserId(): string {
  return crypto.randomUUID();
}

/** Persisted taxee user id (UUID) for Circle + API */
export function useUserId(): string {
  const [userId, setUserId] = useState('');

  useEffect(() => {
    let stored = localStorage.getItem('taxee_user_id');
    if (!stored || !/^[0-9a-f-]{36}$/i.test(stored)) {
      stored = newUserId();
      localStorage.setItem('taxee_user_id', stored);
    }
    setUserId(stored);
  }, []);

  return userId;
}

async function apiFetch(
  url: string,
  init?: RequestInit,
): Promise<{ res: Response; data: Record<string, unknown> }> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (err) {
    const hint =
      ' Check that the Railway API is up and CORS_ORIGINS includes your frontend URL (e.g. http://localhost:3000).';
    throw new Error(`Cannot reach API at ${url}.${hint}`);
  }
  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    data = {};
  }
  return { res, data };
}

export function useCircleWalletSetup() {
  const { address } = useAccount();
  const userId = useUserId();
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [walletAddress, setWalletAddress] = useState('');

  const setupWallet = useCallback(async () => {
    if (!userId) return;

    setStatus('loading');
    setMessage('Creating account…');

    try {
      const apiUrl = API_BASE_URL;
      const appId = process.env.NEXT_PUBLIC_CIRCLE_APP_ID ?? 'e88bd88e-6c02-5d2a-aa01-5e751f693e7f';

      const { res: registerRes, data: registerData } = await apiFetch(
        `${apiUrl}/circle/register-web-user`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            walletAddress: address,
            source: 'web_onboarding',
          }),
        },
      );

      if (!registerRes.ok) {
        const msg = String(registerData.error ?? registerData.message ?? 'Failed to register user');
        if (msg.includes("Must start with 'web_'")) {
          throw new Error(
            'API is outdated — deploy latest backend to Railway (UUID user ids for Circle setup).',
          );
        }
        throw new Error(msg);
      }

      const resolvedUserId = String(registerData.userId ?? userId);
      if (resolvedUserId !== userId) {
        localStorage.setItem('taxee_user_id', resolvedUserId);
      }

      setMessage('Starting Circle PIN setup…');
      const { res: setupRes, data } = await apiFetch(`${apiUrl}/circle/setup/${resolvedUserId}`);

      if (!setupRes.ok) {
        throw new Error(String(data.error ?? 'Failed to load Circle setup'));
      }

      const userToken = String(data.userToken ?? '');
      const encryptionKey = String(data.encryptionKey ?? '');
      const challengeId = String(data.challengeId ?? '');
      if (!userToken || !encryptionKey || !challengeId) {
        throw new Error('Circle setup returned incomplete credentials');
      }

      const { W3SSdk } = await import('@circle-fin/w3s-pw-web-sdk');
      const sdk = new W3SSdk();
      sdk.setAppSettings({ appId });
      sdk.setAuthentication({ userToken, encryptionKey });

      setStatus('ready');
      setMessage('Set your PIN in the Circle window below.');

      sdk.execute(challengeId, (err: unknown, result: unknown) => {
        if (err) {
          console.error('[circle-sdk] error:', err);
          setStatus('error');
          const errorObj = err as { code?: string; message?: string };
          setMessage(`Circle setup failed: ${errorObj.message ?? JSON.stringify(err)}`);
          return;
        }

        console.log('[circle-sdk] wallet created:', result);
        const resultObj = result as { data?: { wallet?: { address?: string } } };
        const createdAddress = resultObj?.data?.wallet?.address ?? '';

        if (createdAddress) {
          localStorage.setItem('taxee_circle_wallet', createdAddress);
          setWalletAddress(createdAddress);
        }

        void apiFetch(`${apiUrl}/circle/wallet-ready/${resolvedUserId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletAddress: createdAddress || address,
          }),
        }).catch(console.error);

        setStatus('done');
        setMessage('Circle wallet ready — PIN secured.');
      });
    } catch (err) {
      console.error('Setup failed:', err);
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Setup failed');
    }
  }, [userId, address]);

  return {
    userId,
    status,
    message,
    walletAddress,
    setupWallet,
  };
}

export function useHasCircleWallet(): boolean {
  const [hasWallet, setHasWallet] = useState(false);

  useEffect(() => {
    setHasWallet(!!localStorage.getItem('taxee_circle_wallet'));
  }, []);

  return hasWallet;
}

export function getCircleWalletAddress(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('taxee_circle_wallet');
}
