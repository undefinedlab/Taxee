'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { API_BASE_URL } from '@/lib/api';
import {
  finishTelegramWebApp,
  initTelegramWebApp,
  isTelegramWebApp,
} from '@/lib/telegram-webapp';

function TgCircleContent() {
  const params = useSearchParams();
  const userId = params.get('userId');
  const [status, setStatus] = useState<'loading' | 'ready' | 'done' | 'error'>(
    'loading',
  );
  const [message, setMessage] = useState('Initialising Circle SDK…');

  useEffect(() => {
    initTelegramWebApp();
    if (!userId) {
      setStatus('error');
      setMessage('Missing userId. Restart from Telegram.');
      return;
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('taxee_user_id', userId);
      localStorage.setItem('taxee_wallet_connection_type', 'circle');
    }

    const appId = process.env.NEXT_PUBLIC_CIRCLE_APP_ID ?? 'e88bd88e-6c02-5d2a-aa01-5e751f693e7f';

    async function notifyReady(): Promise<void> {
      // Tell the backend to find the wallet, link it to the user's agents, and
      // send the Telegram receipt with full wallet details. Safe to call
      // whether the wallet was just created or already existed.
      try {
        await fetch(`${API_BASE_URL}/circle/wallet-ready/${userId}`, {
          method: 'POST',
        });
      } catch {
        // Telegram receipt is best-effort; the wallet itself is fine.
      }
    }

    async function run() {
      try {
        const res = await fetch(`${API_BASE_URL}/circle/setup/${userId}`);
        const data = await res.json();
        if (data.error) {
          setStatus('error');
          setMessage(`API error: ${data.error}`);
          return;
        }

        // Existing-wallet path: backend signals it via alreadySetup. Skip the
        // PIN dance entirely, sync the wallet to agents + fire the Telegram
        // receipt, and close the web app.
        if (data.alreadySetup) {
          await notifyReady();
          setStatus('done');
          const short = data.walletAddress
            ? `${String(data.walletAddress).slice(0, 6)}…${String(data.walletAddress).slice(-4)}`
            : 'unknown';
          setMessage(`Already set up — wallet ${short}. Check Telegram for details.`);
          if (isTelegramWebApp()) {
            finishTelegramWebApp({
              type: 'circle_setup_already',
              userId,
              walletAddress: data.walletAddress,
            });
          }
          return;
        }

        const { userToken, encryptionKey, challengeId } = data;
        const { W3SSdk } = await import('@circle-fin/w3s-pw-web-sdk');
        const sdk = new W3SSdk();
        sdk.setAppSettings({ appId });
        sdk.setAuthentication({ userToken, encryptionKey });
        setStatus('ready');
        setMessage('Set your Circle PIN below.');

        sdk.execute(challengeId, async (err: unknown) => {
          if (err) {
            setStatus('error');
            setMessage(
              err instanceof Error ? err.message : 'Circle setup failed',
            );
            return;
          }
          await notifyReady();
          setStatus('done');
          setMessage('Wallet ready — check Telegram for the details.');
          if (isTelegramWebApp()) {
            finishTelegramWebApp({
              type: 'circle_setup_complete',
              userId,
            });
          }
        });
      } catch (e) {
        setStatus('error');
        setMessage(e instanceof Error ? e.message : 'Setup failed');
      }
    }

    void run();
  }, [userId]);

  return (
    <main className="min-h-screen bg-gray-950 px-4 py-6 text-white">
      <div className="mx-auto max-w-md space-y-4 text-center">
        <h1 className="text-xl font-bold">Circle wallet</h1>
        <p
          className={`rounded-xl border p-4 text-sm ${
            status === 'error'
              ? 'border-red-800 bg-red-950 text-red-300'
              : status === 'done'
                ? 'border-green-800 bg-green-950 text-green-300'
                : 'border-gray-800 bg-gray-900 text-gray-300'
          }`}
        >
          {status === 'loading' && <span className="animate-spin">⟳ </span>}
          {message}
        </p>
        {status === 'done' && !isTelegramWebApp() && (
          <p className="text-xs text-gray-500">Return to Telegram.</p>
        )}
      </div>
    </main>
  );
}

export default function TgCirclePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">
          Loading…
        </main>
      }
    >
      <TgCircleContent />
    </Suspense>
  );
}
