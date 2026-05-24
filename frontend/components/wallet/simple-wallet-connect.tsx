'use client';

import { useAccount } from 'wagmi';
import { WalletConnectionPrompt } from '@/components/wallet/wallet-button';
import { useWalletStatus } from '@/components/wallet/use-wallet-status';

interface SimpleWalletConnectProps {
  onComplete: () => void;
  onBack: () => void;
}

export function SimpleWalletConnect({ onComplete, onBack }: SimpleWalletConnectProps) {
  const { isConnected, address } = useAccount();
  const { canProceed } = useWalletStatus();

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
                  Ready to scan portfolio
                </p>
              </div>
            </div>
          ) : (
            <WalletConnectionPrompt />
          )}
        </div>
      </div>

      {/* Continue Button */}
      {canProceed && (
        <div className="flex gap-3 justify-center">
          <button
            onClick={onComplete}
            className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-white text-slate-950 font-medium hover:bg-white/90 transition-colors"
          >
            Continue to Portfolio Import
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>
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
              <p className="text-white/90 font-medium">What happens next?</p>
              <p className="text-white/60 text-sm">
                We&apos;ll scan your wallet for token balances, then you&apos;ll configure your tax optimization policy. 
                The EIP-7702 delegation will be created at the final step when you activate your agent.
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
