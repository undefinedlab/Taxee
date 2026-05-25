'use client';

import { useState } from 'react';

interface DepositFundsButtonProps {
  address: string;
  className?: string;
}

export function DepositFundsButton({ address, className = '' }: DepositFundsButtonProps) {
  const [copied, setCopied] = useState(false);

  async function copyAddress() {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this EVM address:', address);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copyAddress()}
      className={`inline-flex items-center gap-2 rounded-lg bg-[#111827] px-4 py-2.5 font-landing text-sm font-medium text-white transition-colors hover:bg-[#374151] dark:bg-[#f9fafb] dark:text-[#111827] dark:hover:bg-[#e5e7eb] ${className}`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <rect x="9" y="9" width="13" height="13" rx="2" />
        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
      </svg>
      {copied ? 'Address copied' : 'Deposit funds — copy address'}
    </button>
  );
}
