'use client';

import { truncateAddress } from '@/lib/utils';
import { getStoredCircleAddress } from '@/lib/primary-wallet';

interface CircleWalletChipProps {
  className?: string;
}

/** Dashboard header control for Circle users (not MetaMask connect) */
export function CircleWalletChip({ className = '' }: CircleWalletChipProps) {
  const addr = getStoredCircleAddress();

  if (!addr) return null;

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 font-landing text-sm dark:border-[#374151] dark:bg-[#111827] ${className}`}
      title={addr}
    >
      <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400">
        Circle
      </span>
      <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
      <span className="max-w-[8rem] truncate font-mono text-xs text-[#111827] dark:text-[#f9fafb] sm:max-w-[10rem]">
        {truncateAddress(addr)}
      </span>
    </div>
  );
}
