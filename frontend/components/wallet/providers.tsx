'use client';

import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { config } from '@/lib/wagmi';

// Import RainbowKit styles
import '@rainbow-me/rainbowkit/styles.css';

// Create a client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
      refetchOnWindowFocus: false,
    },
  },
});

// Custom RainbowKit theme — neutral black (no default blue tint)
const customTheme = {
  ...darkTheme({
    accentColor: '#4a9eed',
    accentColorForeground: '#ffffff',
    borderRadius: 'medium',
    fontStack: 'system',
  }),
  colors: {
    ...darkTheme().colors,
    accentColor: '#4a9eed',
    accentColorForeground: '#ffffff',
    connectButtonBackground: '#141414',
    connectButtonInnerBackground: '#0a0a0a',
    connectButtonText: '#f4f4f5',
    modalBackground: 'rgba(10, 10, 10, 0.98)',
    modalBackdrop: 'rgba(0, 0, 0, 0.85)',
    modalBorder: 'rgba(255, 255, 255, 0.1)',
    profileForeground: '#141414',
    profileAction: '#1a1a1a',
    profileActionHover: '#262626',
    menuItemBackground: '#141414',
    generalBorder: 'rgba(255, 255, 255, 0.1)',
    generalBorderDim: 'rgba(255, 255, 255, 0.06)',
  },
};

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider 
          theme={customTheme}
          modalSize="compact"
          showRecentTransactions={true}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
