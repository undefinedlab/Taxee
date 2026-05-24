'use client';

import { useState } from 'react';
import { useAccount, useSignTypedData } from 'wagmi';
import { WalletConnectionPrompt } from '@/components/wallet/wallet-button';
import { useWalletStatus } from '@/components/wallet/use-wallet-status';
import { useCreateDelegation, createPolicyHash, UserPolicy } from '@/components/wallet/use-taxee-contracts';
import { baseSepolia } from 'wagmi/chains';

interface WalletOnboardingStepProps {
  onComplete: () => void;
  onBack: () => void;
}

// EIP-712 Domain for Taxee
const EIP712_DOMAIN = {
  name: 'Taxee',
  version: '1',
  chainId: baseSepolia.id,
  verifyingContract: '0x0000000000000000000000000000000000000000', // Will be set after deployment
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

export function WalletOnboardingStep({ onComplete, onBack }: WalletOnboardingStepProps) {
  const { isConnected, address } = useAccount();
  const { canProceed } = useWalletStatus();
  const [isSigning, setIsSigning] = useState(false);
  const [delegationSigned, setDelegationSigned] = useState(false);
  
  const { createDelegation, isPending: isCreating, isSuccess } = useCreateDelegation();
  
  const { signTypedDataAsync } = useSignTypedData();

  const handleSignDelegation = async () => {
    if (!address) return;
    
    setIsSigning(true);
    
    try {
      // Default policy for new users
      const policy: UserPolicy = {
        actions: ['HARVEST', 'REBUY', 'YIELD_MOVE'],
        maxPerTransaction: 5000,
        maxPerMonth: 20000,
        allowedAssets: ['ETH', 'USDC', 'USYC'],
        restrictions: ['NO_EXTERNAL_TRANSFERS'],
        expirationDays: 90,
      };

      const policyHash = createPolicyHash(policy);
      const expiration = BigInt(Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60));
      const maxPerTx = BigInt(5000 * 10**18); // $5,000 in wei units
      const maxPerMonth = BigInt(20000 * 10**18); // $20,000 in wei units
      const nonce = BigInt(0);

      // Sign EIP-712 delegation message
      const signature = await signTypedDataAsync({
        domain: EIP712_DOMAIN,
        types: EIP712_TYPES,
        primaryType: 'Delegation',
        message: {
          delegate: '0x0000000000000000000000000000000000000000', // TaxeeManager address
          policyHash,
          expiration,
          maxPerTx,
          maxPerMonth,
          nonce,
        },
      });

      // Create delegation on-chain
      createDelegation(policy, signature);
      setDelegationSigned(true);
      
    } catch (error) {
      console.error('Failed to sign delegation:', error);
    } finally {
      setIsSigning(false);
    }
  };

  // If delegation created successfully, show success and complete
  if (isSuccess) {
    return (
      <div className="space-y-8 text-center">
        <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center">
          <svg className="w-10 h-10 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        
        <div className="space-y-2">
          <h3 className="text-2xl font-display text-white">Delegation Created!</h3>
          <p className="text-white/60 max-w-sm mx-auto">
            Your MetaMask wallet is now connected and authorized via EIP-7702. Taxee can autonomously optimize your portfolio within your set limits.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-left space-y-4">
          <div>
            <p className="text-white/50 text-xs uppercase tracking-wider mb-1">Connected Wallet</p>
            <p className="text-white font-mono">{address ? `${address.slice(0, 8)}...${address.slice(-6)}` : '—'}</p>
          </div>
          <div>
            <h4 className="text-white font-medium mb-3">Your Policy</h4>
            <ul className="space-y-2 text-sm text-white/60">
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Max $5,000 per transaction
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Max $20,000 per month
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Valid for 90 days
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Revocable anytime
              </li>
            </ul>
          </div>
        </div>

        <div className="flex gap-3 justify-center">
          <button
            onClick={onComplete}
            className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-white text-slate-950 font-medium hover:bg-white/90 transition-colors"
          >
            Continue to Dashboard
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-display text-white">Connect Self-Custody Wallet</h2>
        <p className="text-white/60">
          MetaMask, Rainbow, or any EIP-7702-compatible wallet. Your keys, your control.
        </p>
      </div>

      {/* Step 1: Connect Wallet */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-medium ${
            canProceed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/10 text-white/60'
          }`}>
            {canProceed ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              '1'
            )}
          </div>
          <span className={`font-medium ${canProceed ? 'text-white' : 'text-white/60'}`}>
            Connect your wallet
          </span>
        </div>
        
        <div className="ml-11">
          {canProceed && address ? (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-white font-medium">Wallet Connected</p>
                  <p className="text-emerald-400/80 text-sm font-mono">{address.slice(0, 6)}...{address.slice(-4)}</p>
                </div>
              </div>
              <div className="text-xs text-emerald-400/60 space-y-1">
                <p className="flex items-center gap-2">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  Self-custody wallet via EIP-7702 delegation
                </p>
              </div>
            </div>
          ) : (
            <WalletConnectionPrompt />
          )}
        </div>
      </div>

      {/* Step 2: Sign Delegation */}
      {canProceed && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-medium ${
              delegationSigned ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/10 text-white/60'
            }`}>
              {delegationSigned ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                '2'
              )}
            </div>
            <span className={`font-medium ${delegationSigned ? 'text-white' : 'text-white/60'}`}>
              Authorize Taxee
            </span>
          </div>

          <div className="ml-11 space-y-4">
            <p className="text-white/60 text-sm">
              Sign a one-time authorization to let Taxee execute tax optimization transactions on your behalf.
              You keep full control and can revoke this anytime.
            </p>

            {!delegationSigned && (
              <button
                onClick={handleSignDelegation}
                disabled={isSigning || isCreating}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    Sign Authorization
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="space-y-2">
            <div>
              <p className="text-white/90 font-medium">How does this work with MetaMask?</p>
              <p className="text-white/60 text-sm">
                You&apos;re using EIP-7702 delegation — a new Ethereum standard that lets you authorize Taxee 
                to execute transactions on your behalf within strict limits. Your private key stays in MetaMask; 
                Taxee gets a scoped session key that can only do what your policy allows.
              </p>
            </div>
            <div className="pt-2 border-t border-blue-500/20">
              <p className="text-white/50 text-xs">
                <span className="text-blue-400">Alternative:</span> Prefer a custodial solution? 
                You can also use a <a href="/setup-wallet" className="text-blue-400 hover:text-blue-300 underline">Circle MPC wallet</a> — 
                your key is split across multiple secure enclaves and transactions are co-signed by Circle.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Back Button */}
      <div className="flex justify-center">
        <button
          onClick={onBack}
          className="text-white/50 hover:text-white/80 text-sm transition-colors"
        >
          ← Back
        </button>
      </div>
    </div>
  );
}
