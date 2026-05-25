'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { createPublicClient, http, formatUnits } from 'viem';
import { baseSepolia, base, sepolia } from 'wagmi/chains';

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

// Chains to always scan (multi-chain)
const SCAN_CHAINS = [
  { chain: sepolia,     label: 'Sepolia',      tokens: [
    { address: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14', symbol: 'WETH', decimals: 18 },
    { address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', symbol: 'USDC', decimals: 6 },
  ]},
  { chain: baseSepolia, label: 'Base Sepolia', tokens: [
    { address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', symbol: 'USDC', decimals: 6 },
    { address: '0x4200000000000000000000000000000000000006', symbol: 'WETH', decimals: 18 },
  ]},
  { chain: base,        label: 'Base',         tokens: [
    { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', symbol: 'USDC', decimals: 6 },
    { address: '0x4200000000000000000000000000000000000006', symbol: 'WETH', decimals: 18 },
    { address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', symbol: 'DAI', decimals: 18 },
  ]},
];

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

interface ArcBalanceResponse {
  balance:  number;
  usd:      number;
  totalUsd: number;
  tokens:   Array<{ symbol: string; balance: number; usd: number; contractAddress: string }>;
}

async function fetchArcBalances(address: string): Promise<ArcBalanceResponse> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'https://taxee-production.up.railway.app';
  try {
    const res = await fetch(`${apiBase}/circle/arc-balance/${address}`);
    if (!res.ok) return { balance: 0, usd: 0, totalUsd: 0, tokens: [] };
    return await res.json() as ArcBalanceResponse;
  } catch {
    return { balance: 0, usd: 0, totalUsd: 0, tokens: [] };
  }
}

async function getEthPriceUsd(): Promise<number> {
  return 3500;
}

export type UseWalletDataOptions = {
  /** When false, never substitute the connected MetaMask/Rainbow address */
  fallbackToConnected?: boolean;
};

export function useWalletData(
  customAddress?: string,
  options: UseWalletDataOptions = {},
): WalletData {
  const { address: connectedAddress } = useAccount();
  const customValid =
    customAddress && /^0x[a-fA-F0-9]{40}$/i.test(customAddress)
      ? customAddress
      : undefined;
  const allowFallback = options.fallbackToConnected !== false;
  const address = customValid ?? (allowFallback ? connectedAddress : undefined);

  const [data, setData] = useState<WalletData>({
    address: address || '',
    totalValueUsd: 0,
    positions: [],
    ethBalance: '0',
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    async function fetchWalletData() {
      if (!address) {
        setData(prev => ({ ...prev, isLoading: false }));
        return;
      }

      try {
        setData(prev => ({ ...prev, isLoading: true, error: null }));

        const ethPrice = await getEthPriceUsd();
        const positions: WalletPosition[] = [];
        let totalValueUsd = 0;
        let primaryEthBalance = '0';

        // ── Scan all chains in parallel ────────────────────────────────────────
        await Promise.allSettled(
          SCAN_CHAINS.map(async ({ chain, label, tokens }) => {
            const client = createPublicClient({ chain, transport: http() });

            // Native ETH
            try {
              const ethBalance = await client.getBalance({ address: address as `0x${string}` });
              if (ethBalance > BigInt(0)) {
                const formatted = formatUnits(ethBalance, 18);
                const valueUsd = parseFloat(formatted) * ethPrice;
                positions.push({
                  asset: 'ETH', symbol: 'ETH',
                  quantity: formatted, valueUsd,
                  chain: label,
                  address: '0x0000000000000000000000000000000000000000',
                  decimals: 18,
                });
                totalValueUsd += valueUsd;
                if (chain.id === baseSepolia.id || chain.id === sepolia.id) {
                  primaryEthBalance = formatted;
                }
              }
            } catch { /* chain unavailable — skip */ }

            // ERC-20 tokens
            for (const token of tokens) {
              try {
                const balance = await client.readContract({
                  address: token.address as `0x${string}`,
                  abi: ERC20_ABI,
                  functionName: 'balanceOf',
                  args: [address as `0x${string}`],
                }) as bigint;
                if (balance > BigInt(0)) {
                  const formatted = formatUnits(balance, token.decimals);
                  const priceUsd = token.symbol === 'WETH' ? ethPrice : 1;
                  const valueUsd = parseFloat(formatted) * priceUsd;
                  positions.push({
                    asset: token.symbol, symbol: token.symbol,
                    quantity: formatted, valueUsd,
                    chain: label,
                    address: token.address,
                    decimals: token.decimals,
                  });
                  totalValueUsd += valueUsd;
                }
              } catch { /* token not deployed on this chain — skip */ }
            }
          }),
        );

        // ── Arc testnet: native USDC ───────────────────────────────────────────
        const arcData = await fetchArcBalances(address);
        if (arcData.balance > 0.001) {
          positions.push({
            asset: 'USDC', symbol: 'USDC',
            quantity: arcData.balance.toFixed(6), valueUsd: arcData.usd,
            chain: 'Arc Testnet',
            address: '0x0000000000000000000000000000000000000000',
            decimals: 18,
          });
          totalValueUsd += arcData.usd;
        }
        for (const tok of arcData.tokens) {
          positions.push({
            asset: tok.symbol, symbol: tok.symbol,
            quantity: tok.balance.toFixed(6), valueUsd: tok.usd,
            chain: 'Arc Testnet',
            address: tok.contractAddress,
            decimals: 18,
          });
          totalValueUsd += tok.usd;
        }

        setData({
          address,
          totalValueUsd,
          positions,
          ethBalance: primaryEthBalance,
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

    void fetchWalletData();
  }, [address]);

  return data;
}

// Hook to check if wallet has any value
export function useHasWalletValue(address?: string): boolean {
  const walletData = useWalletData(address);
  return walletData.totalValueUsd > 0;
}
