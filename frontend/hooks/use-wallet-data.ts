'use client';

import { useState, useEffect } from 'react';
import { useAccount, useBalance } from 'wagmi';
import { createPublicClient, http, formatUnits } from 'viem';
import { baseSepolia, base } from 'wagmi/chains';

// ERC20 ABI for balance checking
const ERC20_ABI = [
  {
    constant: true,
    inputs: [{ name: '_owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: 'balance', type: 'uint256' }],
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    type: 'function',
  },
] as const;

// Common tokens on Base
const BASE_TOKENS = {
  [baseSepolia.id]: [
    { address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', symbol: 'USDC', decimals: 6 },
    { address: '0x4200000000000000000000000000000000000006', symbol: 'WETH', decimals: 18 },
  ],
  [base.id]: [
    { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', symbol: 'USDC', decimals: 6 },
    { address: '0x4200000000000000000000000000000000000006', symbol: 'WETH', decimals: 18 },
    { address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', symbol: 'DAI', decimals: 18 },
  ],
};

export interface WalletPosition {
  asset: string;
  symbol: string;
  quantity: string;
  valueUsd: number;
  chain: string;
  address: string;
  decimals: number;
}

export interface WalletData {
  address: string;
  totalValueUsd: number;
  positions: WalletPosition[];
  ethBalance: string;
  isLoading: boolean;
  error: string | null;
}

// Helper to create public client
function createClient(chainId: number) {
  const chain = chainId === 8453 ? base : baseSepolia;
  return createPublicClient({
    chain,
    transport: http(),
  });
}

// Helper to get ETH price (mock for now - should use price oracle)
async function getEthPriceUsd(): Promise<number> {
  // In production, fetch from CoinGecko, Chainlink, or similar
  // For now, return a reasonable estimate
  return 3500;
}

export function useWalletData(customAddress?: string): WalletData {
  const { address: connectedAddress, chainId } = useAccount();
  const address = customAddress || connectedAddress;
  
  const [data, setData] = useState<WalletData>({
    address: address || '',
    totalValueUsd: 0,
    positions: [],
    ethBalance: '0',
    isLoading: true,
    error: null,
  });

  const { data: ethBalanceData } = useBalance({
    address: address as `0x${string}` | undefined,
    query: {
      enabled: !!address,
    },
  });

  useEffect(() => {
    async function fetchWalletData() {
      if (!address || !chainId) {
        setData(prev => ({ ...prev, isLoading: false }));
        return;
      }

      try {
        setData(prev => ({ ...prev, isLoading: true, error: null }));

        const client = createClient(chainId);
        const tokens = BASE_TOKENS[chainId as keyof typeof BASE_TOKENS] || [];
        const ethPrice = await getEthPriceUsd();
        
        const positions: WalletPosition[] = [];
        let totalValueUsd = 0;

        // Get ETH balance
        const ethBalance = ethBalanceData?.value || BigInt(0);
        const ethBalanceFormatted = formatUnits(ethBalance, 18);
        const ethValueUsd = parseFloat(ethBalanceFormatted) * ethPrice;

        if (ethBalance > BigInt(0)) {
          positions.push({
            asset: 'ETH',
            symbol: 'ETH',
            quantity: ethBalanceFormatted,
            valueUsd: ethValueUsd,
            chain: chainId === 8453 ? 'Base' : 'Base Sepolia',
            address: '0x0000000000000000000000000000000000000000',
            decimals: 18,
          });
          totalValueUsd += ethValueUsd;
        }

        // Get token balances
        for (const token of tokens) {
          try {
            const balance = await client.readContract({
              address: token.address as `0x${string}`,
              abi: ERC20_ABI,
              functionName: 'balanceOf',
              args: [address as `0x${string}`],
            });

            if (balance > BigInt(0)) {
              const formatted = formatUnits(balance, token.decimals);
              
              // Mock price lookup - in production use real price feed
              let priceUsd = 1; // Default for stablecoins
              if (token.symbol === 'WETH' || token.symbol === 'ETH') {
                priceUsd = ethPrice;
              }
              
              const valueUsd = parseFloat(formatted) * priceUsd;

              positions.push({
                asset: token.symbol,
                symbol: token.symbol,
                quantity: formatted,
                valueUsd,
                chain: chainId === 8453 ? 'Base' : 'Base Sepolia',
                address: token.address,
                decimals: token.decimals,
              });
              
              totalValueUsd += valueUsd;
            }
          } catch (err) {
            console.warn(`Failed to fetch balance for ${token.symbol}:`, err);
          }
        }

        setData({
          address,
          totalValueUsd,
          positions,
          ethBalance: ethBalanceFormatted,
          isLoading: false,
          error: null,
        });
      } catch (err) {
        console.error('Failed to fetch wallet data:', err);
        setData(prev => ({
          ...prev,
          isLoading: false,
          error: err instanceof Error ? err.message : 'Failed to fetch wallet data',
        }));
      }
    }

    fetchWalletData();
  }, [address, chainId, ethBalanceData]);

  return data;
}

// Hook to check if wallet has any value
export function useHasWalletValue(address?: string): boolean {
  const { data } = useWalletData(address);
  return data.totalValueUsd > 0;
}
