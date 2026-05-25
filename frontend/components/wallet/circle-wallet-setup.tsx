'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { useCircleWalletSetup, getCircleWalletAddress } from '@/hooks/use-circle-wallet';
import { truncateAddress } from '@/lib/utils';

interface CircleWalletSetupProps {
  onComplete: (walletAddress: string) => void;
  onBack: () => void;
}

export function CircleWalletSetup({ onComplete, onBack }: CircleWalletSetupProps) {
  const { address } = useAccount();
  const { userId, status, message, walletAddress, setupWallet } = useCircleWalletSetup();
  const [showInfo, setShowInfo] = useState(true);
  
  // If wallet was just created, show success
  if (status === 'done' && walletAddress) {
    return (
      <div className="space-y-6 text-center">
        <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center">
          <svg className="w-10 h-10 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        
        <div className="space-y-2">
          <h3 className="text-2xl font-display text-white">Circle Wallet Created!</h3>
          <p className="text-white/60">
            Your MPC wallet is ready. Your key is split across secure enclaves.
          </p>
        </div>
        
        <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-left space-y-3">
          <div>
            <p className="text-white/50 text-xs uppercase tracking-wider mb-1">Wallet Address</p>
            <p className="text-white font-mono text-sm">{walletAddress}</p>
          </div>
          <div>
            <p className="text-white/50 text-xs uppercase tracking-wider mb-1">Protection</p>
            <p className="text-white text-sm">PIN + Biometric</p>
          </div>
          <div>
            <p className="text-white/50 text-xs uppercase tracking-wider mb-1">User ID</p>
            <p className="text-white/60 font-mono text-xs">{userId}</p>
          </div>
        </div>
        
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => onComplete(walletAddress)}
            className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-white text-slate-950 font-medium hover:bg-white/90 transition-colors"
          >
            Continue to Portfolio
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>
        </div>
      </div>
    );
  }
  
  // Show info screen first
  if (showInfo && status === 'idle') {
    return (
      <div className="space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-display text-white">Create Circle Wallet</h2>
          <p className="text-white/60">
            MPC-based wallet with institutional-grade security
          </p>
        </div>
        
        <div className="p-6 rounded-xl bg-blue-500/10 border border-blue-500/20">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h3 className="text-white font-medium mb-2">How it works</h3>
              <ul className="space-y-2 text-sm text-white/60">
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Your private key is split into 3 parts across secure servers
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Access with PIN or biometric (fingerprint/face)
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  No seed phrase to write down or lose
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Can recover wallet if you lose your device
                </li>
              </ul>
            </div>
          </div>
        </div>
        
        {address && (
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <p className="text-white/60 text-sm mb-2">Connected Wallet</p>
            <p className="text-white font-mono">{truncateAddress(address)}</p>
            <p className="text-white/40 text-xs mt-1">
              This address will be linked to your Circle account
            </p>
          </div>
        )}
        
        <div className="flex gap-3 justify-center">
          <button
            onClick={onBack}
            className="px-6 py-3 rounded-xl border border-white/20 text-white font-medium hover:bg-white/5 transition-colors"
          >
            Back
          </button>
          <button
            onClick={() => {
              setShowInfo(false);
              void setupWallet();
            }}
            className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-white text-slate-950 font-medium hover:bg-white/90 transition-colors"
          >
            Create Wallet
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>
        </div>
      </div>
    );
  }
  
  // Show setup UI
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-display text-white">Create Circle Wallet</h2>
        <p className="text-white/60">
          Set up your MPC-secured wallet
        </p>
      </div>
      
      {status === 'idle' && (
        <div className="text-center">
          <button
            onClick={setupWallet}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white font-medium hover:from-blue-600 hover:to-blue-700 transition-all"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Start Wallet Setup
          </button>
          <p className="text-white/40 text-sm mt-4">
            You&apos;ll set up a PIN and optional biometric
          </p>
        </div>
      )}
      
      {(status === 'loading' || status === 'ready') && (
        <div className="rounded-xl border border-[#e5e7eb] bg-white p-8 text-center dark:border-[#1f2937] dark:bg-[#111827]">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
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
          onClick={onBack}
          className="text-white/50 hover:text-white/80 text-sm transition-colors"
        >
          ← Back
        </button>
      </div>
    </div>
  );
}
