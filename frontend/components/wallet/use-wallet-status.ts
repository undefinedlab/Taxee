'use client';

import { useAccount } from 'wagmi';

export function useWalletStatus() {
  const { isConnected, chainId, address } = useAccount();

  const isCorrectNetwork = chainId === 11155111 || chainId === 84532 || chainId === 8453;

  return {
    isConnected,
    isCorrectNetwork,
    address,
    chainId,
    canProceed: isConnected && isCorrectNetwork,
  };
}
