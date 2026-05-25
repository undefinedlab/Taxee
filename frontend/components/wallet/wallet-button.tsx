'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useWalletStatus } from '@/components/wallet/use-wallet-status';

interface WalletButtonProps {
  className?: string;
  variant?: 'default' | 'onboarding' | 'dashboard' | 'topbar';
}

export function WalletButton({ className = '', variant = 'default' }: WalletButtonProps) {

  if (variant === 'onboarding') {
    return (
      <ConnectButton.Custom>
        {({
          account,
          chain,
          openAccountModal,
          openChainModal,
          openConnectModal,
          authenticationStatus,
          mounted,
        }) => {
          const ready = mounted && authenticationStatus !== 'loading';
          const connected =
            ready &&
            account &&
            chain &&
            (!authenticationStatus || authenticationStatus === 'authenticated');

          return (
            <div
              {...(!ready && {
                'aria-hidden': true,
                style: {
                  opacity: 0,
                  pointerEvents: 'none',
                  userSelect: 'none',
                },
              })}
            >
              {(() => {
                if (!connected) {
                  return (
                    <button
                      onClick={openConnectModal}
                      className={`
                        inline-flex items-center justify-center gap-2 
                        px-6 py-3 rounded-xl
                        bg-white/10 hover:bg-white/20 
                        border border-white/20
                        text-white font-medium
                        transition-all duration-200
                        hover:scale-[1.02] active:scale-[0.98]
                        ${className}
                      `}
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      Connect Wallet
                    </button>
                  );
                }

                if (chain.unsupported) {
                  return (
                    <button
                      onClick={openChainModal}
                      className={`
                        inline-flex items-center justify-center gap-2
                        px-6 py-3 rounded-xl
                        bg-red-500/20 hover:bg-red-500/30
                        border border-red-500/30
                        text-red-200 font-medium
                        transition-all duration-200
                        ${className}
                      `}
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      Wrong Network
                    </button>
                  );
                }

                return (
                  <button
                    onClick={openAccountModal}
                    className={`
                      inline-flex items-center justify-center gap-2
                      px-4 py-3 rounded-xl
                      bg-white/10 hover:bg-white/20
                      border border-white/20
                      text-white font-medium
                      transition-all duration-200
                      ${className}
                    `}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span className="font-mono text-sm">
                        {account.displayName}
                      </span>
                      <span className="text-white/50 text-sm">
                        {account.displayBalance ? `(${account.displayBalance})` : ''}
                      </span>
                    </div>
                  </button>
                );
              })()}
            </div>
          );
        }}
      </ConnectButton.Custom>
    );
  }

  if (variant === 'topbar' || variant === 'dashboard') {
    const btnBase =
      'inline-flex items-center gap-2 rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 font-landing text-sm font-medium text-[#111827] transition-colors hover:bg-[#f9fafb] dark:border-[#374151] dark:bg-[#111827] dark:text-[#f9fafb] dark:hover:bg-[#1f2937]';

    return (
      <ConnectButton.Custom>
        {({
          account,
          chain,
          openAccountModal,
          openChainModal,
          openConnectModal,
          mounted,
        }) => {
          const ready = mounted;
          const connected = ready && account && chain;

          return (
            <div
              {...(!ready && {
                'aria-hidden': true,
                style: {
                  opacity: 0,
                  pointerEvents: 'none',
                  userSelect: 'none',
                },
              })}
            >
              {(() => {
                if (!connected) {
                  return (
                    <button
                      type="button"
                      onClick={openConnectModal}
                      className={`${btnBase} ${className}`}
                    >
                      Connect wallet
                    </button>
                  );
                }

                if (chain.unsupported) {
                  return (
                    <button
                      type="button"
                      onClick={openChainModal}
                      className={`${btnBase} border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400 ${className}`}
                    >
                      Wrong network
                    </button>
                  );
                }

                return (
                  <button
                    type="button"
                    onClick={openAccountModal}
                    className={`${btnBase} ${className}`}
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                    <span className="max-w-[8rem] truncate font-mono text-xs sm:max-w-[10rem]">
                      {account.displayName}
                    </span>
                  </button>
                );
              })()}
            </div>
          );
        }}
      </ConnectButton.Custom>
    );
  }

  // Default variant - use RainbowKit's built-in ConnectButton
  return <ConnectButton />;
}

// Wallet connection prompt component for onboarding
export function WalletConnectionPrompt() {
  const { isConnected, isCorrectNetwork, address } = useWalletStatus();

  if (isConnected && isCorrectNetwork) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-medium">Wallet Connected</p>
            <p className="text-emerald-400/80 text-sm font-mono truncate">{address}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-emerald-400/60">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span>Self-custody via EIP-7702 delegation</span>
        </div>
      </div>
    );
  }

  if (isConnected && !isCorrectNetwork) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <p className="text-white font-medium">Wrong Network</p>
            <p className="text-white/50 text-sm">Please switch to Base Sepolia or Base Mainnet</p>
          </div>
        </div>
        <WalletButton variant="onboarding" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center space-y-2">
        <h3 className="text-xl font-medium text-white">Connect Your Wallet</h3>
        <p className="text-white/60 text-sm max-w-xs mx-auto">
          Connect your wallet to enable autonomous tax optimization. We support MetaMask and 50+ wallets.
        </p>
      </div>
      <WalletButton variant="onboarding" />
      <p className="text-center text-white/40 text-xs">
            By connecting, you agree to Taxee&apos;s Terms of Service
      </p>
    </div>
  );
}
