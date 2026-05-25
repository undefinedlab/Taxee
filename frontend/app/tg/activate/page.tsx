'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAccount } from 'wagmi';
import { SimpleWalletConnect } from '@/components/wallet/simple-wallet-connect';
import { AgentActivation } from '@/components/wallet/agent-activation';
import { defaultPolicy } from '@/lib/mock-data';
import type { UserPolicy } from '@/lib/types';
import {
  ensureWebUserRegistered,
  syncWebAgentToBackend,
} from '@/lib/web-agent-api';
import {
  finishTelegramWebApp,
  initTelegramWebApp,
  isTelegramWebApp,
} from '@/lib/telegram-webapp';
import { truncateAddress } from '@/lib/utils';

function TgActivateContent() {
  const params = useSearchParams();
  const userId = params.get('userId');
  const { address, isConnected } = useAccount();
  const [step, setStep] = useState<'connect' | 'sign' | 'done'>('connect');
  const [policy] = useState<UserPolicy>({
    ...defaultPolicy,
    walletConnectionType: 'external_eip7702',
  });

  useEffect(() => {
    initTelegramWebApp();
    if (userId && typeof window !== 'undefined') {
      localStorage.setItem('taxee_user_id', userId);
      localStorage.setItem('taxee_wallet_connection_type', 'external_eip7702');
    }
  }, [userId]);

  useEffect(() => {
    if (isConnected && address && step === 'connect') {
      setStep('sign');
    }
  }, [isConnected, address, step]);

  const onDelegationSuccess = useCallback(async () => {
    if (address) {
      await ensureWebUserRegistered();
      await syncWebAgentToBackend(address, policy, {
        mode: 'manual',
        notifyOnExecute: true,
      });
    }
    setStep('done');
    if (isTelegramWebApp()) {
      finishTelegramWebApp({
        type: 'delegation_complete',
        ...(userId ? { userId } : {}),
      });
    }
  }, [address, policy, userId]);

  const inTg = isTelegramWebApp();

  return (
    <main className="min-h-screen bg-[#0a0a0a] px-4 py-6 text-white">
      <div className="mx-auto max-w-md space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="font-serif text-xl font-bold">Activate agent</h1>
          <p className="font-landing text-sm text-white/60">
            Connect the same wallet you sent in Telegram, then sign EIP-7702
            delegation.
          </p>
          {!inTg && (
            <p className="font-landing text-xs text-amber-400/90">
              Open this page from the Telegram bot button to return to chat
              automatically.
            </p>
          )}
        </div>

        {step === 'connect' && (
          <div className="space-y-4">
            <SimpleWalletConnect />
            {address && (
              <p className="text-center font-mono text-xs text-white/50">
                {truncateAddress(address)}
              </p>
            )}
          </div>
        )}

        {step === 'sign' && address && (
          <AgentActivation
            policy={policy}
            onSuccess={() => void onDelegationSuccess()}
            onBack={() => setStep('connect')}
          />
        )}

        {step === 'done' && !inTg && (
          <p className="text-center font-landing text-sm text-emerald-400">
            Delegation complete. Return to Telegram.
          </p>
        )}
      </div>
    </main>
  );
}

export default function TgActivatePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-white/60">
          Loading…
        </main>
      }
    >
      <TgActivateContent />
    </Suspense>
  );
}
