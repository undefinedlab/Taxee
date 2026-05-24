'use client';

import Link from 'next/link';
import { WalletButton } from '@/components/wallet/wallet-button';
import { useDelegationStatus, useMonthlyLimits } from '@/components/wallet/use-taxee-contracts';
import { useAccount } from 'wagmi';

export function DashboardHeader() {
  const { address } = useAccount();
  const { hasDelegation, isLoading: delegationLoading } = useDelegationStatus();
  const { remaining, isLoading: limitsLoading } = useMonthlyLimits();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center border border-slate-600">
              <span className="text-white font-bold text-sm">T</span>
            </div>
            <span className="text-white font-display text-lg hidden sm:inline">taxee</span>
          </Link>

          {/* Center - Stats (if wallet connected) */}
          {address && (
            <div className="hidden md:flex items-center gap-6">
              {/* Monthly Limit */}
              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-sm">Monthly:</span>
                <span className="text-white font-mono text-sm">
                  {limitsLoading ? (
                    <span className="animate-pulse">...</span>
                  ) : (
                    `$${remaining.toLocaleString()} left`
                  )}
                </span>
              </div>

              {/* Delegation Status */}
              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-sm">Status:</span>
                {delegationLoading ? (
                  <span className="animate-pulse text-slate-400 text-sm">...</span>
                ) : hasDelegation ? (
                  <span className="flex items-center gap-1.5 text-emerald-400 text-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Active
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-amber-400 text-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    No Delegation
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Right side - Wallet */}
          <div className="flex items-center gap-4">
            <WalletButton variant="dashboard" />
          </div>
        </div>
      </div>
    </header>
  );
}
