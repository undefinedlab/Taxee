import type { WalletConnectionType } from '@/lib/types';
import { getStoredCircleAddress } from '@/lib/primary-wallet';

const CONN_KEY = 'taxee_wallet_connection_type';

export function saveWalletConnectionType(type: WalletConnectionType): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CONN_KEY, type);
}

export function getWalletConnectionType(): WalletConnectionType | null {
  if (typeof window === 'undefined') return null;
  const v = localStorage.getItem(CONN_KEY);
  if (v === 'circle' || v === 'watch' || v === 'external_eip7702') return v;
  return null;
}

/** Primary on-chain address for the wallet mode the user chose */
export function getActiveWalletAddress(
  connectionType: WalletConnectionType | null,
  agentWallet?: string,
): string {
  const circle = getStoredCircleAddress();
  const stored = agentWallet?.trim() ?? '';
  switch (connectionType) {
    case 'circle':
      return circle || stored || '';
    case 'watch':
      return stored || '';
    case 'external_eip7702':
      return stored || '';
    default:
      return stored || '';
  }
}
