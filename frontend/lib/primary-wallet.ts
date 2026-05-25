import type { WalletConnectionType } from '@/lib/types';

/** Circle MPC address from onboarding */
export function getStoredCircleAddress(): string | null {
  if (typeof window === 'undefined') return null;
  const a = localStorage.getItem('taxee_circle_wallet');
  return a && /^0x[a-fA-F0-9]{40}$/.test(a) ? a : null;
}

/**
 * Which address to scan / attach to the agent — never let MetaMask override Circle.
 */
export function resolvePrimaryWalletAddress(options: {
  connectionType: WalletConnectionType | null;
  storedWallet?: string;
  wagmiAddress?: string | null;
}): string {
  const stored = options.storedWallet?.trim() ?? '';
  const circle = getStoredCircleAddress();
  const wagmi = options.wagmiAddress ?? undefined;

  switch (options.connectionType) {
    case 'circle':
      return circle || stored || '';
    case 'watch':
      return stored || '';
    case 'external_eip7702':
      return wagmi || stored || '';
    default:
      return wagmi || circle || stored || '';
  }
}

export function walletModeLabel(connectionType: WalletConnectionType | null): string {
  switch (connectionType) {
    case 'circle':
      return 'Circle wallet';
    case 'watch':
      return 'Watch-only address';
    case 'external_eip7702':
      return 'Connected wallet (MetaMask)';
    default:
      return 'Wallet';
  }
}
