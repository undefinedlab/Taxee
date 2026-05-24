'use client';

import { useState } from 'react';
import { useAccount, useSignTypedData } from 'wagmi';
import { useCreateDelegation, createPolicyHash, UserPolicy } from '@/components/wallet/use-taxee-contracts';
import { baseSepolia } from 'wagmi/chains';

interface AgentActivationProps {
  policy: UserPolicy;
  onSuccess: () => void;
  onBack: () => void;
}

// EIP-712 Domain for Taxee
const EIP712_DOMAIN = {
  name: 'Taxee',
  version: '1',
  chainId: baseSepolia.id,
  verifyingContract: '0x403Fe0408976b518b2952BdF590135Ec6ba12ebc', // DelegationRegistry
} as const;

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
  const { address } = useAccount();
  const [isSigning, setIsSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { createDelegation, isPending: isCreating, isSuccess } = useCreateDelegation();
  const { signTypedDataAsync } = useSignTypedData();

  // If successfully created, trigger success callback
  if (isSuccess) {
    onSuccess();
    return null;
  }

  const handleActivate = async () => {
    if (!address) {
      setError('No wallet connected');
      return;
    }
    
    setIsSigning(true);
    setError(null);
    
    try {
      const policyHash = createPolicyHash(policy);
      const expiration = BigInt(Math.floor(Date.now() / 1000) + (policy.expirationDays * 24 * 60 * 60));
      const maxPerTx = BigInt(policy.maxPerTransaction * 10**18);
      const maxPerMonth = BigInt(policy.maxPerMonth * 10**18);
      const nonce = BigInt(0);

      // Sign EIP-712 delegation message
      const signature = await signTypedDataAsync({
        domain: EIP712_DOMAIN,
        types: EIP712_TYPES,
        primaryType: 'Delegation',
        message: {
          delegate: '0xEE8DAE2D3f142052bDb704Ba0D94e04eC1680193', // TaxeeManager
          policyHash,
          expiration,
          maxPerTx,
          maxPerMonth,
          nonce,
        },
      });

      // Create delegation on-chain
      createDelegation(policy, signature);
      
    } catch (err) {
      console.error('Failed to sign delegation:', err);
      setError(err instanceof Error ? err.message : 'Failed to sign delegation');
    } finally {
      setIsSigning(false);
    }
  };

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

      <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-left">
        <p className="text-white/60 text-xs">
          <span className="text-blue-400 font-medium">Security:</span> Your private key stays in MetaMask. 
          You&apos;re only signing a message that grants limited authority. You can revoke this anytime.
        </p>
      </div>
    </div>
  );
}
