import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import {
  base,
  baseSepolia,
} from 'wagmi/chains';
import { http } from 'wagmi';

// Contract addresses - update these after deployment
export const CONTRACTS = {
  baseSepolia: {
    delegationRegistry: '0x403Fe0408976b518b2952BdF590135Ec6ba12ebc',
    taxeeManager: '0xEE8DAE2D3f142052bDb704Ba0D94e04eC1680193',
  },
  base: {
    delegationRegistry: process.env.NEXT_PUBLIC_DELEGATION_REGISTRY || '',
    taxeeManager: process.env.NEXT_PUBLIC_TAXEE_MANAGER || '',
  },
} as const;

// USDC addresses
export const USDC_ADDRESSES = {
  [baseSepolia.id]: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  [base.id]: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
} as const;

// Supported chains
export const supportedChains = [baseSepolia, base] as const;

// Create wagmi config with RainbowKit
export const config = getDefaultConfig({
  appName: 'Taxee',
  appDescription: 'After-tax DeFi portfolio agent',
  appUrl: 'https://taxee.io',
  appIcon: '/logo-mark.png',
  projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || 'YOUR_PROJECT_ID',
  chains: supportedChains,
  transports: {
    [baseSepolia.id]: http(),
    [base.id]: http(),
  },
  ssr: true, // Enable server-side rendering support
});

// Type exports
declare module 'wagmi' {
  interface Register {
    config: typeof config;
  }
}
