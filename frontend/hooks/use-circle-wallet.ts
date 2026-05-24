'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';

// Generate a unique user ID
function generateUserId(): string {
  return `web_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Get or create user ID from localStorage
export function useUserId(): string {
  const [userId, setUserId] = useState<string>('');
  
  useEffect(() => {
    const stored = localStorage.getItem('taxee_user_id');
    if (stored) {
      setUserId(stored);
    } else {
      const newId = generateUserId();
      localStorage.setItem('taxee_user_id', newId);
      setUserId(newId);
    }
  }, []);
  
  return userId;
}

// Hook to set up Circle wallet
export function useCircleWalletSetup() {
  const { address } = useAccount();
  const userId = useUserId();
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [walletAddress, setWalletAddress] = useState<string>('');
  
  const setupWallet = async () => {
    if (!userId) return;
    
    setStatus('loading');
    setMessage('Initializing Circle SDK...');
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
      const appId = 'e88bd88e-6c02-5d2a-aa01-5e751f693e7f';
      
      // First, register this user with the backend
      setMessage('Creating user account...');
      const registerRes = await fetch(`${apiUrl}/circle/register-web-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          walletAddress: address,
          source: 'web_onboarding',
        }),
      });
      
      if (!registerRes.ok) {
        throw new Error('Failed to register user');
      }
      
      // Now get credentials for wallet setup
      setMessage('Fetching credentials...');
      const res = await fetch(`${apiUrl}/circle/setup/${userId}`);
      const data = await res.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      const { userToken, encryptionKey, challengeId } = data;
      
      // Load Circle SDK
      const { W3SSdk } = await import('@circle-fin/w3s-pw-web-sdk');
      const sdk = new W3SSdk();
      sdk.setAppSettings({ appId });
      sdk.setAuthentication({ userToken, encryptionKey });
      
      setStatus('ready');
      setMessage('Complete wallet setup below.');
      
      // Execute challenge
      sdk.execute(challengeId, (err: unknown, result: unknown) => {
        if (err) {
          console.error('[circle-sdk] error:', err);
          setStatus('error');
          const errorObj = err as { code?: string; message?: string };
          setMessage(`Setup failed: ${errorObj.message ?? 'Unknown error'}`);
          return;
        }
        
        console.log('[circle-sdk] wallet created:', result);
        const resultObj = result as { data?: { wallet?: { address?: string } } };
        const createdAddress = resultObj?.data?.wallet?.address || '';
        
        // Store wallet info
        localStorage.setItem('taxee_circle_wallet', createdAddress);
        setWalletAddress(createdAddress);
        
        // Notify backend
        fetch(`${apiUrl}/circle/wallet-ready/${userId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ walletAddress: createdAddress }),
        }).catch(console.error);
        
        setStatus('done');
        setMessage('Wallet created successfully!');
      });
      
    } catch (err) {
      console.error('Setup failed:', err);
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Setup failed');
    }
  };
  
  return {
    userId,
    status,
    message,
    walletAddress,
    setupWallet,
  };
}

// Hook to check if user has Circle wallet
export function useHasCircleWallet(): boolean {
  const [hasWallet, setHasWallet] = useState(false);
  
  useEffect(() => {
    const wallet = localStorage.getItem('taxee_circle_wallet');
    setHasWallet(!!wallet);
  }, []);
  
  return hasWallet;
}

// Get stored Circle wallet address
export function getCircleWalletAddress(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('taxee_circle_wallet');
}
