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

// Custom RainbowKit theme to match Taxee design
const customTheme = {
  ...darkTheme({
    accentColor: '#7c7c7c', // Neutral gray to match Taxee theme
    accentColorForeground: '#ffffff',
    borderRadius: 'medium',
    fontStack: 'system',
  }),
  colors: {
    ...darkTheme().colors,
    modalBackground: 'rgba(20, 20, 20, 0.95)',
    modalBackdrop: 'rgba(0, 0, 0, 0.8)',
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
