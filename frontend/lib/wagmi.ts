import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import {
  base,
  baseSepolia,
  sepolia,
} from 'wagmi/chains';
import { http } from 'wagmi';

// Contract addresses - update these after deployment
export const CONTRACTS = {
  ethSepolia: {
    delegationRegistry: '0x786D17590AF61F06d6BBc2B77621a72a25F4A527',
    taxeeManager: '0x919B8F07Ec889922AE08BA8CC64C43aaA9a34A37',
  },
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
  [sepolia.id]: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  [baseSepolia.id]: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  [base.id]: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
} as const;

// Supported chains
export const supportedChains = [sepolia, baseSepolia, base] as const;

// Create wagmi config with RainbowKit
export const config = getDefaultConfig({
  appName: 'Taxee',
  appDescription: 'After-tax DeFi portfolio agent',
  appUrl: 'https://taxee.io',
  appIcon: '/logo-mark.png',
  projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || 'YOUR_PROJECT_ID',
  chains: supportedChains,
  transports: {
    [sepolia.id]: http('https://eth-sepolia.g.alchemy.com/v2/QKpJJ0vfOqVsi5962oHUd'),
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
