'use client';

import { useState } from 'react';
import { truncateAddress } from '@/lib/utils';
import { getStoredCircleAddress } from '@/lib/primary-wallet';

interface CircleWalletChipProps {
  className?: string;
}

/** Dashboard header control for Circle users.
 *  - Click chip → copy address (with brief "Copied" feedback)
 *  - Faucet button → opens https://faucet.circle.com in a new tab for testnet USDC
 */
export function CircleWalletChip({ className = '' }: CircleWalletChipProps) {
  const addr = getStoredCircleAddress();
  const [copied, setCopied] = useState(false);

  if (!addr) return null;

  async function copyAddress() {
    if (!addr) return;
    try {
      await navigator.clipboard.writeText(addr);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this address:', addr);
    }
  }

  return (
    <div className={`inline-flex items-center gap-1 ${className}`}>
      <button
        type="button"
        onClick={() => void copyAddress()}
        title={copied ? 'Copied!' : `Click to copy ${addr}`}
        className="inline-flex items-center gap-2 rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 font-landing text-sm transition-colors hover:bg-[#f9fafb] dark:border-[#2a2a2a] dark:bg-[#141414] dark:hover:bg-[#1f1f1f]"
      >
        <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400">
          Circle
        </span>
        <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
        <span className="max-w-[8rem] truncate font-mono text-xs text-[#111827] dark:text-[#f9fafb] sm:max-w-[10rem]">
          {truncateAddress(addr)}
        </span>
        {copied ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-500" aria-hidden>
            <path d="M20 6L9 17l-5-5" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#6b7280] dark:text-[#9ca3af]" aria-hidden>
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          </svg>
        )}
      </button>

      <a
        href="https://faucet.circle.com/"
        target="_blank"
        rel="noopener noreferrer"
        title="Get testnet USDC from Circle's faucet (opens in new tab)"
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#e5e7eb] bg-white px-2.5 font-landing text-xs font-medium text-[#6b7280] transition-colors hover:bg-[#f9fafb] hover:text-[#111827] dark:border-[#2a2a2a] dark:bg-[#141414] dark:text-[#9ca3af] dark:hover:bg-[#1f1f1f] dark:hover:text-[#f9fafb]"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z" />
        </svg>
        Faucet
      </a>
    </div>
  );
}
