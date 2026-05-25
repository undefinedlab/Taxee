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

async function syncWalletReady(
  apiUrl: string,
  userId: string,
  walletAddr: string,
): Promise<string> {
  try {
    const { res, data } = await apiFetch(`${apiUrl}/circle/wallet-ready/${userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress: walletAddr }),
    });
    if (res.ok && data.walletAddress) return String(data.walletAddress);
  } catch {
    /* use local address */
  }
  return walletAddr;
}

export type CircleSetupStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'connect-ready'
  | 'done'
  | 'error';

export function useCircleWalletSetup() {
  const { address } = useAccount();
  const userId = useUserId();
  const [status, setStatus] = useState<CircleSetupStatus>('idle');
  const [message, setMessage] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [existingAddress, setExistingAddress] = useState('');

  const finishWithWallet = useCallback(
    async (resolvedUserId: string, addr: string, apiUrl: string) => {
      if (!/^0x[a-fA-F0-9]{40}$/i.test(addr)) {
        setStatus('error');
        setMessage('Invalid Circle wallet address from server.');
        return;
      }
      if (address && addr.toLowerCase() === address.toLowerCase()) {
        setStatus('error');
        setMessage(
          'Got MetaMask address instead of Circle wallet. Disconnect MetaMask and try again, or use Settings → Reset registration.',
        );
        return;
      }
      const synced = await syncWalletReady(apiUrl, resolvedUserId, addr);
      localStorage.setItem('taxee_circle_wallet', synced);
      setWalletAddress(synced);
      setStatus('done');
      setMessage('Using your Circle wallet — continuing…');
    },
    [address],
  );

  const setupWallet = useCallback(async () => {
    if (!userId) return;

    setStatus('loading');
    setMessage('Creating account…');

    try {
      const apiUrl = API_BASE_URL;
      const appId = process.env.NEXT_PUBLIC_CIRCLE_APP_ID ?? 'e88bd88e-6c02-5d2a-aa01-5e751f693e7f';

      // Do not send MetaMask address — it can collide with users.address unique index
      const { res: registerRes, data: registerData } = await apiFetch(
        `${apiUrl}/circle/register-web-user`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, source: 'web_onboarding' }),
        },
      );

      if (!registerRes.ok) {
        const msg = String(
          registerData.error ??
            registerData.message ??
            `Failed to register user (${registerRes.status})`,
        );
        if (msg.includes("Must start with 'web_'")) {
          throw new Error(
            'API is outdated — deploy latest backend to Railway (UUID user ids for Circle setup).',
          );
        }
        if (msg.includes('duplicate key') || msg.includes('users_address')) {
          throw new Error(
            'Account registration conflict (address already linked). Clear site data or use Settings → Reset registration, then try again.',
          );
        }
        throw new Error(msg);
      }

      const resolvedUserId = String(registerData.userId ?? userId);
      if (resolvedUserId !== userId) {
        localStorage.setItem('taxee_user_id', resolvedUserId);
      }

      setMessage('Checking Circle wallet…');
      const { res: setupRes, data } = await apiFetch(`${apiUrl}/circle/setup/${resolvedUserId}`);

      if (setupRes.ok && data.alreadySetup && data.walletAddress) {
        const addr = String(data.walletAddress);
        setExistingAddress(addr);
        setStatus('connect-ready');
        setMessage('Circle wallet found. Enter your PIN to connect.');
        return;
      }

      if (!setupRes.ok) {
        const errMsg = String(data.error ?? data.message ?? 'Failed to load Circle setup');
        const isConflict =
          setupRes.status === 409 ||
          errMsg.toLowerCase().includes('conflict');
        if (isConflict) {
          const cached = getCircleWalletAddress();
          if (cached) {
            await finishWithWallet(resolvedUserId, cached, apiUrl);
            return;
          }
          try {
            const { res: wr, data: wrData } = await apiFetch(
              `${apiUrl}/circle/wallet-ready/${resolvedUserId}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
              },
            );
            if (wr.ok && wrData.walletAddress) {
              await finishWithWallet(resolvedUserId, String(wrData.walletAddress), apiUrl);
              return;
            }
          } catch {
            /* fall through */
          }
        }
        throw new Error(errMsg);
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
        void (async () => {
          if (err) {
            console.error('[circle-sdk] error:', err);
            setStatus('error');
            const errorObj = err as { code?: string; message?: string };
            setMessage(`Circle setup failed: ${errorObj.message ?? JSON.stringify(err)}`);
            return;
          }

          console.log('[circle-sdk] wallet created:', result);
          const resultObj = result as {
            data?: { wallet?: { address?: string }; wallets?: Array<{ address?: string }> };
          };
          let createdAddress =
            resultObj?.data?.wallet?.address ??
            resultObj?.data?.wallets?.[0]?.address ??
            '';

          const finalAddr = createdAddress || getCircleWalletAddress() || '';
          if (finalAddr) {
            await finishWithWallet(resolvedUserId, finalAddr, apiUrl);
          } else {
            setStatus('error');
            setMessage('Wallet created but address was not returned. Try again.');
          }
        })();
      });
    } catch (err) {
      console.error('Setup failed:', err);
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Setup failed');
    }
  }, [userId, address, finishWithWallet]);

  const unlockWithPin = useCallback(async () => {
    if (!userId) return;
    const apiUrl = API_BASE_URL;
    const appId = process.env.NEXT_PUBLIC_CIRCLE_APP_ID ?? 'e88bd88e-6c02-5d2a-aa01-5e751f693e7f';
    const addr = existingAddress || getCircleWalletAddress() || '';

    setStatus('loading');
    setMessage('Opening Circle PIN…');

    try {
      const { res, data } = await apiFetch(`${apiUrl}/circle/session/${userId}`);
      if (!res.ok) {
        const errMsg = String(data.error ?? data.message ?? 'Could not start Circle session');
        if (res.status === 404 && addr) {
          await finishWithWallet(userId, addr, apiUrl);
          return;
        }
        throw new Error(errMsg);
      }

      const userToken = String(data.userToken ?? '');
      const encryptionKey = String(data.encryptionKey ?? '');
      const circleAddr = String(data.walletAddress ?? addr);
      if (!userToken || !encryptionKey || !circleAddr) {
        throw new Error('Circle session returned incomplete data');
      }

      const { W3SSdk } = await import('@circle-fin/w3s-pw-web-sdk');
      const sdk = new W3SSdk();
      sdk.setAppSettings({ appId });
      sdk.setAuthentication({ userToken, encryptionKey });

      setStatus('ready');
      setMessage('Confirm your PIN in the Circle window.');

      const sdkAny = sdk as { login?: (cb: (err: unknown) => void) => void };
      if (typeof sdkAny.login === 'function') {
        sdkAny.login((err: unknown) => {
          if (err) {
            setStatus('error');
            setMessage(`PIN failed: ${err instanceof Error ? err.message : String(err)}`);
            return;
          }
          void finishWithWallet(userId, circleAddr, apiUrl);
        });
        return;
      }

      await finishWithWallet(userId, circleAddr, apiUrl);
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'PIN connection failed');
    }
  }, [userId, existingAddress, finishWithWallet]);

  const probeExistingWallet = useCallback(async (): Promise<string | null> => {
    if (!userId) return getCircleWalletAddress();
    const cached = getCircleWalletAddress();
    if (cached && address && cached.toLowerCase() === address.toLowerCase()) {
      localStorage.removeItem('taxee_circle_wallet');
    } else if (cached) {
      return cached;
    }

    try {
      const { res, data } = await apiFetch(`${API_BASE_URL}/circle/setup/${userId}`);
      if (res.ok && data.alreadySetup && data.walletAddress) {
        return String(data.walletAddress);
      }
    } catch {
      /* ignore */
    }
    return null;
  }, [userId, address]);

  return {
    userId,
    status,
    message,
    walletAddress,
    existingAddress,
    setupWallet,
    unlockWithPin,
    probeExistingWallet,
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
