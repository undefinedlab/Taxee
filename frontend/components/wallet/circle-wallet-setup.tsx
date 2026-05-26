'use client';

import { useState, useEffect, useRef } from 'react';
import { useAccount } from 'wagmi';
import { useCircleWalletSetup, getCircleWalletAddress } from '@/hooks/use-circle-wallet';
interface CircleWalletSetupProps {
  onComplete: (walletAddress: string) => void;
  onBack: () => void;
}

export function CircleWalletSetup({ onComplete, onBack }: CircleWalletSetupProps) {
  const { address } = useAccount();
  const {
    userId,
    status,
    message,
    walletAddress,
    existingAddress,
    setupWallet,
    unlockWithPin,
    probeExistingWallet,
  } = useCircleWalletSetup();
  const [showInfo, setShowInfo] = useState(true);
  const advancedRef = useRef(false);

  // Drop cache if MetaMask address was wrongly stored as "Circle wallet"
  useEffect(() => {
    const cached = getCircleWalletAddress();
    if (cached && address && cached.toLowerCase() === address.toLowerCase()) {
      localStorage.removeItem('taxee_circle_wallet');
    }
  }, [address]);

  const [hasExisting, setHasExisting] = useState(false);

  useEffect(() => {
    if (!userId) return;
    void probeExistingWallet().then((addr) => {
      if (addr) setHasExisting(true);
    });
  }, [userId, probeExistingWallet]);

  // After PIN setup succeeds, go straight to portfolio import (Circle address only)
  useEffect(() => {
    if (status !== 'done' || advancedRef.current) return;
    const resolved = walletAddress || getCircleWalletAddress() || '';
    if (!resolved || !/^0x[a-fA-F0-9]{40}$/i.test(resolved)) return;
    if (address && resolved.toLowerCase() === address.toLowerCase()) return;
    advancedRef.current = true;
    onComplete(resolved);
  }, [status, walletAddress, address, onComplete]);

  if (status === 'done') {
    return (
      <div className="space-y-6 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#111827] border-t-transparent dark:border-[#f9fafb]" />
        <p className="font-landing text-sm text-[#6b7280] dark:text-[#9ca3af]">
          Wallet created — importing portfolio…
        </p>
      </div>
    );
  }

  const howItWorksItems = [
    'Your private key is split into 3 parts across secure servers',
    'Access with PIN or biometric (fingerprint/face)',
    'No seed phrase to write down or lose',
    'Can recover wallet if you lose your device',
  ];
  
  // Show info screen first
  if (showInfo && status === 'idle') {
    return (
      <div className="space-y-8">
        <div className="space-y-2">
          <h2 className="font-serif text-2xl font-bold text-black dark:text-[#f9fafb]">
            Connect Circle Wallet
          </h2>
          <p className="font-landing text-sm leading-relaxed text-[#6b7280] dark:text-[#9ca3af]">
            MPC-based wallet with institutional-grade security
          </p>
        </div>
        
        <div className="rounded-xl border border-[#e5e7eb] bg-white p-6 dark:border-[#2a2a2a] dark:bg-[#141414]">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#f3f4f6] dark:bg-[#2a2a2a]">
              <svg className="h-6 w-6 text-[#111827] dark:text-[#f9fafb]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h3 className="mb-2 font-landing font-medium text-[#111827] dark:text-[#f9fafb]">How it works</h3>
              <ul className="space-y-2 font-landing text-sm text-[#6b7280] dark:text-[#9ca3af]">
                {howItWorksItems.map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <svg className="h-4 w-4 shrink-0 text-[#111827] dark:text-[#f9fafb]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        
        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="rounded-xl border border-[#e5e7eb] px-6 py-3 font-landing text-sm font-medium text-[#111827] transition-colors hover:bg-[#f3f4f6] dark:border-[#2a2a2a] dark:text-[#f9fafb] dark:hover:bg-[#1f1f1f]"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => {
              setShowInfo(false);
              void setupWallet();
            }}
            className="rounded-lg bg-black px-6 py-3 font-landing text-[14px] font-medium text-white shadow-[0_4px_16px_rgba(0,0,0,0.12)] transition-colors hover:bg-[#1f2937] dark:bg-[#f9fafb] dark:text-[#111827] dark:shadow-none dark:hover:bg-[#e5e7eb]"
          >
            {hasExisting ? 'Connect Circle wallet' : 'Create wallet'}
          </button>
        </div>
      </div>
    );
  }
  
  // Show setup UI
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="font-serif text-2xl font-bold text-black dark:text-[#f9fafb]">
          Create Circle Wallet
        </h2>
        <p className="font-landing text-sm leading-relaxed text-[#6b7280] dark:text-[#9ca3af]">
          Set up your MPC-secured wallet
        </p>
      </div>
      
      {status === 'idle' && (
        <div className="text-center">
          <button
            type="button"
            onClick={setupWallet}
            className="group inline-flex items-stretch overflow-hidden rounded-lg bg-black shadow-[0_4px_16px_rgba(0,0,0,0.12)] dark:bg-[#f9fafb] dark:shadow-none"
          >
            <span className="flex items-center gap-2 px-6 py-3.5 font-landing text-[14px] font-medium text-white dark:text-[#111827]">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Start Wallet Setup
            </span>
            <span className="flex w-[52px] items-center justify-center bg-[#374151] transition-colors group-hover:bg-[#4b5563] dark:bg-[#4b5563] dark:group-hover:bg-[#6b7280]">
              <svg
                className="landing-cta-arrow"
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                stroke="#111827"
                strokeWidth="2.2"
                aria-hidden
              >
                <path d="M5 10h10M11 6l4 4-4 4" />
              </svg>
            </span>
          </button>
          <p className="mt-4 font-landing text-sm text-[#9ca3af]">
            You&apos;ll set up a PIN and optional biometric
          </p>
        </div>
      )}
      
      {status === 'connect-ready' && (
        <div className="space-y-4 rounded-xl border border-[#e5e7eb] bg-white p-6 text-center dark:border-[#2a2a2a] dark:bg-[#141414]">
          <p className="font-landing text-sm text-[#374151] dark:text-[#d1d5db]">{message}</p>
          {existingAddress && (
            <p className="font-mono text-xs text-[#6b7280] dark:text-[#9ca3af]">
              {existingAddress.slice(0, 6)}…{existingAddress.slice(-4)}
            </p>
          )}
          <button
            type="button"
            onClick={() => void unlockWithPin()}
            className="inline-flex items-center gap-2 rounded-lg bg-black px-6 py-3 font-landing text-sm font-medium text-white transition-colors hover:bg-[#1f2937] dark:bg-[#f9fafb] dark:text-[#111827] dark:hover:bg-[#e5e7eb]"
          >
            Enter PIN to connect
          </button>
        </div>
      )}

      {(status === 'loading' || status === 'ready') && (
        <div className="rounded-xl border border-[#e5e7eb] bg-white p-8 text-center dark:border-[#262626] dark:bg-[#141414]">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-[#111827] border-t-transparent dark:border-[#f9fafb]" />
          <p className="font-landing text-sm text-[#6b7280] dark:text-[#9ca3af]">
            {message}
          </p>
          {userId && (
            <p className="text-xs text-[#9ca3af] mt-2">
              User ID: {userId.slice(0, 20)}...
            </p>
          )}
        </div>
      )}
      
      {status === 'error' && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900/30 dark:bg-red-900/20">
          <p className="text-red-600 dark:text-red-400">
            {message}
          </p>
          <button
            onClick={() => {
              setShowInfo(true);
              setupWallet();
            }}
            className="mt-4 text-sm text-red-600 underline dark:text-red-400"
          >
            Try again
          </button>
        </div>
      )}
      
      <div className="flex justify-center">
        <button
          type="button"
          onClick={onBack}
          className="font-landing text-sm text-[#6b7280] transition-colors hover:text-[#111827] dark:text-[#9ca3af] dark:hover:text-[#f9fafb]"
        >
          ← Back
        </button>
      </div>
    </div>
  );
}
