/**
 * Taxee EIP-7702 Integration Example
 * 
 * This file demonstrates how the Taxee frontend integrates with the
 * EIP-7702 delegation contracts for autonomous tax optimization.
 */

import { ethers } from 'ethers';

// Contract ABIs (simplified - import from generated files in production)
const DELEGATION_REGISTRY_ABI = [
  "function createDelegation(tuple(address delegate, bytes32 policyHash, uint256 expiration, uint256 maxPerTx, uint256 maxPerMonth, bool isActive, uint256 createdAt, bytes signature) delegation)",
  "function revokeDelegation()",
  "function hasActiveDelegation(address user) view returns (bool, uint256)",
  "function getRemainingMonthlyLimit(address user) view returns (uint256, uint256)",
  "function delegations(address) view returns (address delegate, bytes32 policyHash, uint256 expiration, uint256 maxPerTx, uint256 maxPerMonth, bool isActive, uint256 createdAt, bytes signature)",
  "event DelegationCreated(address indexed user, address indexed delegate, bytes32 indexed policyHash, uint256 expiration)",
  "event DelegationRevoked(address indexed user, address indexed delegate, uint256 timestamp)"
];

const TAXEE_MANAGER_ABI = [
  "function executeHarvest(address user, address asset, uint256 amount, uint256 estimatedProceeds, string lotId) returns (bytes32)",
  "function executeRebuy(address user, address asset, uint256 amount, uint256 estimatedCost, string originalLotId) returns (bytes32)",
  "function executeYieldMove(address user, address fromAsset, address toAsset, uint256 amount, uint256 estimatedValue) returns (bytes32)",
  "function canExecute(address user, uint8 action, address asset, uint256 value) view returns (bool, string)",
  "function confirmExecution(bytes32 requestId, bytes32 txHash, uint256 actualValue, bool success)",
  "function skipOpportunity(bytes32 requestId, string reason)",
  "function lastHarvestTime(address) view returns (uint256)",
  "event HarvestExecuted(address indexed user, address indexed asset, uint256 amount, uint256 proceeds, uint256 lossRealized, bytes32 txHash)",
  "event RebuyExecuted(address indexed user, address indexed asset, uint256 amount, uint256 newBasis, bytes32 txHash)"
];

// Contract addresses (update after deployment)
const CONTRACTS = {
  baseSepolia: {
    delegationRegistry: '0x...', // Update after deployment
    taxeeManager: '0x...'        // Update after deployment
  },
  baseMainnet: {
    delegationRegistry: '0x...',
    taxeeManager: '0x...'
  }
};

// EIP-712 Domain
const EIP712_DOMAIN = {
  name: 'Taxee',
  version: '1',
  chainId: 84532, // Base Sepolia
  verifyingContract: '0x...' // DelegationRegistry address
};

// EIP-712 Types
const DELEGATION_TYPES = {
  Delegation: [
    { name: 'delegate', type: 'address' },
    { name: 'policyHash', type: 'bytes32' },
    { name: 'expiration', type: 'uint256' },
    { name: 'maxPerTx', type: 'uint256' },
    { name: 'maxPerMonth', type: 'uint256' },
    { name: 'nonce', type: 'uint256' }
  ]
};

/**
 * Creates a policy hash from user policy settings
 */
export function createPolicyHash(policy: {
  actions: string[];
  maxPerTransaction: number;
  maxPerMonth: number;
  allowedAssets: string[];
  restrictions: string[];
}): string {
  return ethers.keccak256(
    ethers.toUtf8Bytes(JSON.stringify(policy))
  );
}

/**
 * Signs EIP-7702 delegation message
 */
export async function signDelegation(
  signer: ethers.Signer,
  params: {
    delegate: string;
    policyHash: string;
    expiration: number;
    maxPerTx: string;  // In wei (ether units)
    maxPerMonth: string;
    nonce: number;
  }
): Promise<string> {
  const domain = {
    ...EIP712_DOMAIN,
    chainId: await signer.provider?.getNetwork().then(n => Number(n.chainId)) || 84532
  };

  const signature = await signer.signTypedData(
    domain,
    DELEGATION_TYPES,
    params
  );

  return signature;
}

/**
 * Creates a new delegation on-chain
 */
export async function createDelegation(
  signer: ethers.Signer,
  registryAddress: string,
  policy: {
    maxPerTransaction: number;  // USD
    maxPerMonth: number;        // USD
    expirationDays: number;
  }
): Promise<ethers.TransactionResponse> {
  const registry = new ethers.Contract(
    registryAddress,
    DELEGATION_REGISTRY_ABI,
    signer
  );

  const policyHash = createPolicyHash({
    actions: ['HARVEST', 'REBUY', 'YIELD_MOVE'],
    maxPerTransaction: policy.maxPerTransaction,
    maxPerMonth: policy.maxPerMonth,
    allowedAssets: ['ETH', 'USDC', 'USYC'],
    restrictions: ['NO_EXTERNAL_TRANSFERS']
  });

  const expiration = Math.floor(Date.now() / 1000) + (policy.expirationDays * 24 * 60 * 60);
  const maxPerTx = ethers.parseUnits(policy.maxPerTransaction.toString(), 18);
  const maxPerMonth = ethers.parseUnits(policy.maxPerMonth.toString(), 18);

  // Get nonce
  const nonce = await registry.nonces(await signer.getAddress());

  // Sign delegation
  const signature = await signDelegation(signer, {
    delegate: CONTRACTS.baseSepolia.taxeeManager,
    policyHash,
    expiration,
    maxPerTx: maxPerTx.toString(),
    maxPerMonth: maxPerMonth.toString(),
    nonce: Number(nonce)
  });

  // Submit delegation
  const tx = await registry.createDelegation({
    delegate: CONTRACTS.baseSepolia.taxeeManager,
    policyHash,
    expiration,
    maxPerTx,
    maxPerMonth,
    isActive: true,
    createdAt: 0,
    signature
  });

  return tx;
}

/**
 * Revokes an active delegation
 */
export async function revokeDelegation(
  signer: ethers.Signer,
  registryAddress: string
): Promise<ethers.TransactionResponse> {
  const registry = new ethers.Contract(
    registryAddress,
    DELEGATION_REGISTRY_ABI,
    signer
  );

  return await registry.revokeDelegation();
}

/**
 * Checks if user has an active delegation
 */
export async function hasActiveDelegation(
  provider: ethers.Provider,
  registryAddress: string,
  userAddress: string
): Promise<{ hasDelegation: boolean; expiration: number }> {
  const registry = new ethers.Contract(
    registryAddress,
    DELEGATION_REGISTRY_ABI,
    provider
  );

  const [hasDelegation, expiration] = await registry.hasActiveDelegation(userAddress);
  return { hasDelegation, expiration: Number(expiration) };
}

/**
 * Gets remaining monthly limit
 */
export async function getRemainingMonthlyLimit(
  provider: ethers.Provider,
  registryAddress: string,
  userAddress: string
): Promise<{ remaining: string; monthStart: number }> {
  const registry = new ethers.Contract(
    registryAddress,
    DELEGATION_REGISTRY_ABI,
    provider
  );

  const [remaining, monthStart] = await registry.getRemainingMonthlyLimit(userAddress);
  return {
    remaining: ethers.formatUnits(remaining, 18),
    monthStart: Number(monthStart)
  };
}

/**
 * Checks if an action can be executed
 */
export async function canExecute(
  provider: ethers.Provider,
  managerAddress: string,
  userAddress: string,
  action: 'HARVEST' | 'REBUY' | 'YIELD_MOVE',
  asset: string,
  value: string
): Promise<{ canExecute: boolean; reason?: string }> {
  const manager = new ethers.Contract(
    managerAddress,
    TAXEE_MANAGER_ABI,
    provider
  );

  const actionType = action === 'HARVEST' ? 0 : action === 'REBUY' ? 1 : 2;
  const valueWei = ethers.parseUnits(value, 18);

  const [canExec, reason] = await manager.canExecute(
    userAddress,
    actionType,
    asset,
    valueWei
  );

  return { canExecute: canExec, reason };
}

/**
 * Example: Full harvest flow
 */
export async function executeHarvestFlow(
  executorSigner: ethers.Signer,  // Taxee backend executor
  managerAddress: string,
  params: {
    user: string;
    asset: string;
    amount: string;
    estimatedProceeds: string;
    lotId: string;
  }
): Promise<string> {
  const manager = new ethers.Contract(
    managerAddress,
    TAXEE_MANAGER_ABI,
    executorSigner
  );

  const amountWei = ethers.parseUnits(params.amount, 18);
  const proceedsWei = ethers.parseUnits(params.estimatedProceeds, 18);

  const tx = await manager.executeHarvest(
    params.user,
    params.asset,
    amountWei,
    proceedsWei,
    params.lotId
  );

  const receipt = await tx.wait();
  
  // Parse requestId from event
  const event = receipt?.logs.find(
    (log: any) => log.topics[0] === manager.interface.getEvent('ExecutionRequested').topicHash
  );
  
  if (event) {
    const parsed = manager.interface.parseLog(event);
    return parsed?.args.requestId;
  }

  throw new Error('Failed to get requestId');
}

/**
 * Example: Wait for execution confirmation
 */
export function onExecutionConfirmed(
  provider: ethers.Provider,
  managerAddress: string,
  callback: (event: {
    user: string;
    requestId: string;
    txHash: string;
    actualValue: string;
  }) => void
): void {
  const manager = new ethers.Contract(
    managerAddress,
    TAXEE_MANAGER_ABI,
    provider
  );

  manager.on('ExecutionConfirmed', (
    user: string,
    requestId: string,
    txHash: string,
    actualValue: bigint
  ) => {
    callback({
      user,
      requestId,
      txHash,
      actualValue: ethers.formatUnits(actualValue, 18)
    });
  });
}

/**
 * Example usage in a React component
 */
export async function exampleUsage() {
  // Connect to provider
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  
  const userAddress = await signer.getAddress();
  const registryAddress = CONTRACTS.baseSepolia.delegationRegistry;
  const managerAddress = CONTRACTS.baseSepolia.taxeeManager;

  // 1. Check if user has delegation
  const delegationStatus = await hasActiveDelegation(
    provider,
    registryAddress,
    userAddress
  );

  if (!delegationStatus.hasDelegation) {
    // 2. Create delegation during onboarding
    const tx = await createDelegation(signer, registryAddress, {
      maxPerTransaction: 5000,
      maxPerMonth: 20000,
      expirationDays: 90
    });
    await tx.wait();
    console.log('Delegation created!');
  }

  // 3. Check limits
  const limits = await getRemainingMonthlyLimit(
    provider,
    registryAddress,
    userAddress
  );
  console.log(`Remaining this month: $${limits.remaining}`);

  // 4. User can revoke at any time
  // await revokeDelegation(signer, registryAddress);
}
