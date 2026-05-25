'use client';

import Link from 'next/link';
import { TaxeeLogo } from '@/components/landing/logo';
import { WalletButton } from '@/components/wallet/wallet-button';
import { CircleWalletChip } from '@/components/wallet/circle-wallet-chip';
import type { WalletConnectionType } from '@/lib/types';

interface DashboardHeaderProps {
  onOpenSettings?: () => void;
  walletConnectionType?: WalletConnectionType | null;
}

export function DashboardHeader({ onOpenSettings, walletConnectionType }: DashboardHeaderProps) {
  return (
    <header className="landing-area-hero-topbar landing-grid-line flex items-center justify-between gap-3 border-b border-[#e5e7eb] px-4 py-3 dark:border-[#262626] sm:gap-4 sm:px-5 lg:px-6">
      <Link href="/" className="shrink-0" aria-label="taxee home">
        <TaxeeLogo showWordmark />
      </Link>

      <div className="flex shrink-0 items-center gap-2">
        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#e5e7eb] text-[#6b7280] transition-colors hover:bg-[#f9fafb] hover:text-[#111827] dark:border-[#2a2a2a] dark:text-[#9ca3af] dark:hover:bg-[#1a1a1a] dark:hover:text-[#f9fafb]"
            title="Agent settings"
            aria-label="Agent settings"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
          </button>
        )}
        {walletConnectionType === 'circle' ? (
          <CircleWalletChip />
        ) : (
          <WalletButton variant="topbar" />
        )}
      </div>
    </header>
  );
}
