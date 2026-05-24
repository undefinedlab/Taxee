'use client';

import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, formatUnits, keccak256, stringToBytes } from 'viem';
import { CONTRACTS, USDC_ADDRESSES } from '@/lib/wagmi';
import { useCallback } from 'react';

// Contract ABIs (simplified - import from full ABIs in production)
const DELEGATION_REGISTRY_ABI = [
  {
    inputs: [{ name: 'delegation', type: 'tuple', components: [
      { name: 'delegate', type: 'address' },
      { name: 'policyHash', type: 'bytes32' },
      { name: 'expiration', type: 'uint256' },
      { name: 'maxPerTx', type: 'uint256' },
      { name: 'maxPerMonth', type: 'uint256' },
      { name: 'isActive', type: 'bool' },
      { name: 'createdAt', type: 'uint256' },
      { name: 'signature', type: 'bytes' },
    ]}],
    name: 'createDelegation',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'revokeDelegation',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'hasActiveDelegation',
    outputs: [
      { name: 'hasDelegation', type: 'bool' },
      { name: 'expiration', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'getRemainingMonthlyLimit',
    outputs: [
      { name: 'remaining', type: 'uint256' },
      { name: 'monthStart', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: '', type: 'address' }],
    name: 'delegations',
    outputs: [
      { name: 'delegate', type: 'address' },
      { name: 'policyHash', type: 'bytes32' },
      { name: 'expiration', type: 'uint256' },
      { name: 'maxPerTx', type: 'uint256' },
      { name: 'maxPerMonth', type: 'uint256' },
      { name: 'isActive', type: 'bool' },
      { name: 'createdAt', type: 'uint256' },
      { name: 'signature', type: 'bytes' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

const TAXEE_MANAGER_ABI = [
  {
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'action', type: 'uint8' },
      { name: 'asset', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    name: 'canExecute',
    outputs: [
      { name: 'canExecute', type: 'bool' },
      { name: 'reason', type: 'string' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// Policy type
export interface UserPolicy {
  actions: string[];
  maxPerTransaction: number;
  maxPerMonth: number;
  allowedAssets: string[];
  restrictions: string[];
  expirationDays: number;
}

// Delegation type
export interface DelegationData {
  delegate: `0x${string}`;
  policyHash: `0x${string}`;
  expiration: bigint;
  maxPerTx: bigint;
  maxPerMonth: bigint;
  isActive: boolean;
  createdAt: bigint;
  signature: `0x${string}`;
}

// Hook to check delegation status
export function useDelegationStatus() {
  const { address, chainId } = useAccount();
  
  const registryAddress = chainId === 84532 
    ? CONTRACTS.baseSepolia.delegationRegistry 
    : CONTRACTS.base.delegationRegistry;

  const { data, isLoading, refetch } = useReadContract({
    address: registryAddress as `0x${string}`,
    abi: DELEGATION_REGISTRY_ABI,
    functionName: 'hasActiveDelegation',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!registryAddress,
    },
  });

  const [hasDelegation, expiration] = data || [false, 0n];

  return {
    hasDelegation,
    expiration: Number(expiration) * 1000, // Convert to milliseconds
    expirationDate: expiration ? new Date(Number(expiration) * 1000) : null,
    isLoading,
    refetch,
  };
}

// Hook to get monthly limits
export function useMonthlyLimits() {
  const { address, chainId } = useAccount();
  
  const registryAddress = chainId === 84532 
    ? CONTRACTS.baseSepolia.delegationRegistry 
    : CONTRACTS.base.delegationRegistry;

  const { data, isLoading, refetch } = useReadContract({
    address: registryAddress as `0x${string}`,
    abi: DELEGATION_REGISTRY_ABI,
    functionName: 'getRemainingMonthlyLimit',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!registryAddress,
    },
  });

  const [remaining, monthStart] = data || [0n, 0n];

  return {
    remaining: Number(formatUnits(remaining, 18)),
    monthStart: Number(monthStart) * 1000,
    isLoading,
    refetch,
  };
}

// Hook to get delegation details
export function useDelegationDetails() {
  const { address, chainId } = useAccount();
  
  const registryAddress = chainId === 84532 
    ? CONTRACTS.baseSepolia.delegationRegistry 
    : CONTRACTS.base.delegationRegistry;

  const { data, isLoading } = useReadContract({
    address: registryAddress as `0x${string}`,
    abi: DELEGATION_REGISTRY_ABI,
    functionName: 'delegations',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!registryAddress,
    },
  });

  if (!data) {
    return { delegation: null, isLoading };
  }

  const delegation: DelegationData = {
    delegate: data[0],
    policyHash: data[1],
    expiration: data[2],
    maxPerTx: data[3],
    maxPerMonth: data[4],
    isActive: data[5],
    createdAt: data[6],
    signature: data[7],
  };

  return {
    delegation,
    maxPerTxUsd: Number(formatUnits(delegation.maxPerTx, 18)),
    maxPerMonthUsd: Number(formatUnits(delegation.maxPerMonth, 18)),
    isLoading,
  };
}

// Hook to check if action can be executed
export function useCanExecute(
  action: 'HARVEST' | 'REBUY' | 'YIELD_MOVE',
  asset: string,
  value: string
) {
  const { address, chainId } = useAccount();
  
  const managerAddress = chainId === 84532 
    ? CONTRACTS.baseSepolia.taxeeManager 
    : CONTRACTS.base.taxeeManager;

  const actionType = action === 'HARVEST' ? 0 : action === 'REBUY' ? 1 : 2;
  const valueWei = parseUnits(value || '0', 18);

  const { data, isLoading } = useReadContract({
    address: managerAddress as `0x${string}`,
    abi: TAXEE_MANAGER_ABI,
    functionName: 'canExecute',
    args: address && asset ? [address, actionType, asset as `0x${string}`, valueWei] : undefined,
    query: {
      enabled: !!address && !!asset && !!value && !!managerAddress,
    },
  });

  const [canExecute, reason] = data || [false, ''];

  return {
    canExecute,
    reason,
    isLoading,
  };
}

// Hook to create delegation
export function useCreateDelegation() {
  const { chainId } = useAccount();
  const { writeContract, isPending, data: hash } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const registryAddress = chainId === 84532 
    ? CONTRACTS.baseSepolia.delegationRegistry 
    : CONTRACTS.base.delegationRegistry;

  const managerAddress = chainId === 84532 
    ? CONTRACTS.baseSepolia.taxeeManager 
    : CONTRACTS.base.taxeeManager;

  const createDelegation = useCallback((
    policy: UserPolicy,
    signature: `0x${string}`
  ) => {
    if (!registryAddress || !managerAddress) {
      throw new Error('Contracts not deployed on this network');
    }

    const policyHash = createPolicyHash(policy);
    const expiration = BigInt(Math.floor(Date.now() / 1000) + (policy.expirationDays * 24 * 60 * 60));
    const maxPerTx = parseUnits(policy.maxPerTransaction.toString(), 18);
    const maxPerMonth = parseUnits(policy.maxPerMonth.toString(), 18);

    writeContract({
      address: registryAddress as `0x${string}`,
      abi: DELEGATION_REGISTRY_ABI,
      functionName: 'createDelegation',
      args: [{
        delegate: managerAddress as `0x${string}`,
        policyHash,
        expiration,
        maxPerTx,
        maxPerMonth,
        isActive: true,
        createdAt: 0n,
        signature,
      }],
    });
  }, [registryAddress, managerAddress, writeContract]);

  return {
    createDelegation,
    isPending: isPending || isConfirming,
    isSuccess,
    hash,
  };
}

// Hook to revoke delegation
export function useRevokeDelegation() {
  const { chainId } = useAccount();
  const { writeContract, isPending, data: hash } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const registryAddress = chainId === 84532 
    ? CONTRACTS.baseSepolia.delegationRegistry 
    : CONTRACTS.base.delegationRegistry;

  const revokeDelegation = useCallback(() => {
    if (!registryAddress) {
      throw new Error('Contracts not deployed on this network');
    }

    writeContract({
      address: registryAddress as `0x${string}`,
      abi: DELEGATION_REGISTRY_ABI,
      functionName: 'revokeDelegation',
    });
  }, [registryAddress, writeContract]);

  return {
    revokeDelegation,
    isPending: isPending || isConfirming,
    isSuccess,
    hash,
  };
}

// Helper function to create policy hash (bytes32)
export function createPolicyHash(policy: UserPolicy): `0x${string}` {
  const policyString = JSON.stringify({
    actions: policy.actions,
    maxPerTransaction: policy.maxPerTransaction,
    maxPerMonth: policy.maxPerMonth,
    allowedAssets: policy.allowedAssets,
    restrictions: policy.restrictions,
  });
  
  // Create proper keccak256 hash (bytes32)
  return keccak256(stringToBytes(policyString));
}

// Get USDC address for current chain
export function useUsdcAddress() {
  const { chainId } = useAccount();
  return chainId ? USDC_ADDRESSES[chainId as keyof typeof USDC_ADDRESSES] : undefined;
}
