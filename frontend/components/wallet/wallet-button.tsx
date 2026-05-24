'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';

interface WalletButtonProps {
  className?: string;
  variant?: 'default' | 'onboarding' | 'dashboard';
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

  if (variant === 'dashboard') {
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
                      onClick={openConnectModal}
                      className={`
                        inline-flex items-center gap-2
                        px-4 py-2 rounded-lg
                        bg-slate-800 hover:bg-slate-700
                        border border-slate-700
                        text-white text-sm font-medium
                        transition-colors
                        ${className}
                      `}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      Connect
                    </button>
                  );
                }

                if (chain.unsupported) {
                  return (
                    <button
                      onClick={openChainModal}
                      className={`
                        inline-flex items-center gap-2
                        px-4 py-2 rounded-lg
                        bg-red-500/10 hover:bg-red-500/20
                        border border-red-500/30
                        text-red-400 text-sm
                        transition-colors
                        ${className}
                      `}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      Network
                    </button>
                  );
                }

                return (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={openChainModal}
                      className={`
                        hidden sm:inline-flex items-center gap-2
                        px-3 py-2 rounded-lg
                        bg-slate-800 hover:bg-slate-700
                        border border-slate-700
                        text-slate-300 text-sm
                        transition-colors
                        ${className}
                      `}
                    >
                      {chain.hasIcon && (
                        <div
                          style={{
                            background: chain.iconBackground,
                            width: 16,
                            height: 16,
                            borderRadius: 999,
                            overflow: 'hidden',
                          }}
                        >
                          {chain.iconUrl && (
                            <img
                              alt={chain.name ?? 'Chain icon'}
                              src={chain.iconUrl}
                              style={{ width: 16, height: 16 }}
                            />
                          )}
                        </div>
                      )}
                      <span className="hidden md:inline">{chain.name}</span>
                    </button>

                    <button
                      onClick={openAccountModal}
                      className={`
                        inline-flex items-center gap-2
                        px-4 py-2 rounded-lg
                        bg-slate-800 hover:bg-slate-700
                        border border-slate-700
                        text-white text-sm font-medium
                        transition-colors
                        ${className}
                      `}
                    >
                      <div className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span className="font-mono">
                        {account.displayName}
                      </span>
                    </button>
                  </div>
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

// Hook to check if wallet is connected and on correct network
export function useWalletStatus() {
  const { isConnected, chainId, address } = useAccount();
  
  const isCorrectNetwork = chainId === 84532 || chainId === 8453; // Base Sepolia or Base Mainnet
  
  return {
    isConnected,
    isCorrectNetwork,
    address,
    chainId,
    canProceed: isConnected && isCorrectNetwork,
  };
}

// Wallet connection prompt component for onboarding
export function WalletConnectionPrompt() {
  const { isConnected, isCorrectNetwork } = useWalletStatus();

  if (isConnected && isCorrectNetwork) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
        <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
          <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <p className="text-white font-medium">Wallet Connected</p>
          <p className="text-white/50 text-sm">You&apos;re ready to continue</p>
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
