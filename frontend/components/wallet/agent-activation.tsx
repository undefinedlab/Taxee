'use client';

import { useState, useEffect, useRef } from 'react';
import { useAccount, useSignTypedData } from 'wagmi';
import {
  useCreateDelegation,
  createPolicyHash,
  normalizeDelegationPolicy,
} from '@/components/wallet/use-taxee-contracts';
import { CONTRACTS } from '@/lib/wagmi';
import type { UserPolicy } from '@/lib/types';
import { parseUnits } from 'viem';

interface AgentActivationProps {
  policy: UserPolicy;
  onSuccess: () => void;
  onBack: () => void;
}

// Contract addresses per chain
const REGISTRY_BY_CHAIN: Record<number, `0x${string}`> = {
  11155111: CONTRACTS.ethSepolia.delegationRegistry as `0x${string}`,
  84532:    CONTRACTS.baseSepolia.delegationRegistry as `0x${string}`,
};
const MANAGER_BY_CHAIN: Record<number, `0x${string}`> = {
  11155111: CONTRACTS.ethSepolia.taxeeManager as `0x${string}`,
  84532:    CONTRACTS.baseSepolia.taxeeManager as `0x${string}`,
};

// EIP-712 Types
const EIP712_TYPES = {
  Delegation: [
    { name: 'delegate', type: 'address' },
    { name: 'policyHash', type: 'bytes32' },
    { name: 'expiration', type: 'uint256' },
    { name: 'maxPerTx', type: 'uint256' },
    { name: 'maxPerMonth', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
  ],
} as const;

export function AgentActivation({ policy, onSuccess, onBack }: AgentActivationProps) {
  const { address, chainId } = useAccount();
  const [isSigning, setIsSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { createDelegation, isPending: isCreating, isSuccess } = useCreateDelegation();
  const { signTypedDataAsync } = useSignTypedData();
  const successHandled = useRef(false);

  useEffect(() => {
    if (!isSuccess || successHandled.current) return;
    successHandled.current = true;
    onSuccess();
  }, [isSuccess, onSuccess]);

  const handleActivate = async () => {
    if (!address) {
      setError('No wallet connected');
      return;
    }
    
    setIsSigning(true);
    setError(null);
    
    try {
      const delegation = normalizeDelegationPolicy(policy);
      const policyHash = createPolicyHash(delegation);
      const expiration = BigInt(
        Math.floor(Date.now() / 1000) + delegation.expirationDays * 24 * 60 * 60,
      );
      const maxPerTx = parseUnits(delegation.maxPerTransaction.toString(), 18);
      const maxPerMonth = parseUnits(delegation.maxPerMonth.toString(), 18);
      const nonce = BigInt(0);

      const registryAddr = chainId ? REGISTRY_BY_CHAIN[chainId] : undefined;
      const managerAddr  = chainId ? MANAGER_BY_CHAIN[chainId]  : undefined;
      if (!registryAddr || !managerAddr) {
        throw new Error(`Contracts not deployed on chain ${chainId ?? 'unknown'}. Switch to Ethereum Sepolia or Base Sepolia.`);
      }

      // Sign EIP-712 delegation message
      const signature = await signTypedDataAsync({
        domain: {
          name: 'Taxee',
          version: '1',
          chainId: chainId!,
          verifyingContract: registryAddr,
        },
        types: EIP712_TYPES,
        primaryType: 'Delegation',
        message: {
          delegate: managerAddr,
          policyHash,
          expiration,
          maxPerTx,
          maxPerMonth,
          nonce,
        },
      });

      await createDelegation(delegation, signature);
      
    } catch (err) {
      console.error('Failed to sign delegation:', err);
      setError(err instanceof Error ? err.message : 'Failed to sign delegation');
    } finally {
      setIsSigning(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="space-y-6 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
        <p className="font-landing text-sm text-white/60">Agent activated — continuing…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-center">
      <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center">
        <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
        </svg>
      </div>
      
      <div className="space-y-2">
        <h3 className="text-xl font-display text-white">Activate Your Agent</h3>
        <p className="text-white/60 text-sm max-w-sm mx-auto">
          Sign the EIP-7702 delegation to authorize Taxee to optimize your portfolio within your policy limits.
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      <div className="space-y-3">
        <button
          onClick={handleActivate}
          disabled={isSigning || isCreating}
          className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white text-slate-950 font-medium hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSigning || isCreating ? (
            <>
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              {isSigning ? 'Signing...' : 'Creating...'}
            </>
          ) : (
            <>
              Sign & Activate
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </>
          )}
        </button>

        <button
          onClick={onBack}
          disabled={isSigning || isCreating}
          className="text-white/50 hover:text-white/80 text-sm transition-colors disabled:opacity-50"
        >
          ← Back to Review
        </button>
      </div>

     
    </div>
  );
}
