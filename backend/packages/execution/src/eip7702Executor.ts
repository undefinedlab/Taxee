import type { ApprovedAction } from "@taxee/shared";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base, baseSepolia, mainnet, sepolia } from "viem/chains";
import { getChainConfig, getExecutionChainId } from "./chainConfig.js";
import { NATIVE_ETH, resolveTokenAddress, tokenDecimals } from "./assetAddresses.js";

const arcTestnet = {
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
  rpcUrls: { default: { http: [process.env["ARC_RPC_URL"] ?? "https://rpc.testnet.arc.io"] } },
  blockExplorers: { default: { name: "Arc Explorer", url: "https://explorer.testnet.arc.io" } },
  testnet: true,
} as const;

// Deployed contract addresses by chainId
const DEPLOYED_CONTRACTS: Record<number, { taxeeManager: Address; delegationRegistry: Address }> = {
  84532: {
    taxeeManager:       "0xEE8DAE2D3f142052bDb704Ba0D94e04eC1680193",
    delegationRegistry: "0x403Fe0408976b518b2952BdF590135Ec6ba12ebc",
  },
  11155111: {
    taxeeManager:       "0x919B8F07Ec889922AE08BA8CC64C43aaA9a34A37",
    delegationRegistry: "0x786D17590AF61F06d6BBc2B77621a72a25F4A527",
  },
};

const DELEGATION_REGISTRY_ABI = [
  {
    inputs: [{ name: "user", type: "address" }],
    name: "hasActiveDelegation",
    outputs: [
      { name: "hasDelegation", type: "bool" },
      { name: "expiration", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

const TAXEE_MANAGER_ABI = [
  {
    inputs: [
      { name: "user", type: "address" },
      { name: "asset", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "estimatedProceeds", type: "uint256" },
      { name: "lotId", type: "string" },
    ],
    name: "executeHarvest",
    outputs: [{ name: "requestId", type: "bytes32" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "user", type: "address" },
      { name: "asset", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "estimatedCost", type: "uint256" },
      { name: "originalLotId", type: "string" },
    ],
    name: "executeRebuy",
    outputs: [{ name: "requestId", type: "bytes32" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "user", type: "address" },
      { name: "fromAsset", type: "address" },
      { name: "toAsset", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "estimatedValue", type: "uint256" },
    ],
    name: "executeYieldMove",
    outputs: [{ name: "requestId", type: "bytes32" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

export interface Eip7702ExecutionReceipt {
  txHash: string;
  requestId?: Hex;
}

function taxeeManagerAddress(chainId: number): Address {
  const env = process.env["TAXEE_MANAGER_ADDRESS"];
  if (env?.startsWith("0x")) return env as Address;
  const contracts = DEPLOYED_CONTRACTS[chainId];
  if (contracts) return contracts.taxeeManager;
  throw new Error(`No TaxeeManager deployed on chain ${chainId}`);
}

function delegationRegistryAddress(chainId: number): Address {
  const env = process.env["DELEGATION_REGISTRY_ADDRESS"];
  if (env?.startsWith("0x")) return env as Address;
  const contracts = DEPLOYED_CONTRACTS[chainId];
  if (contracts) return contracts.delegationRegistry;
  throw new Error(`No DelegationRegistry deployed on chain ${chainId}`);
}

function viemChain(chainId: number) {
  if (chainId === 1)       return mainnet;
  if (chainId === 11155111) return sepolia;
  if (chainId === 8453)    return base;
  if (chainId === 84532)   return baseSepolia;
  if (chainId === 5042002) return arcTestnet;
  throw new Error(`EIP-7702 execution unsupported chain ${chainId}`);
}

function rpcUrl(chainId: number): string {
  const cfg = getChainConfig(chainId);
  const url = process.env[cfg.rpcEnvVar];
  if (!url) {
    throw new Error(`${cfg.rpcEnvVar} is required for EIP-7702 execution`);
  }
  return url;
}

export async function checkActiveDelegation(userAddress: Address, chainId?: number): Promise<boolean> {
  const effectiveChainId = chainId ?? getExecutionChainId();
  const publicClient = createPublicClient({
    chain: viemChain(effectiveChainId),
    transport: http(rpcUrl(effectiveChainId)),
  });
  const [hasDelegation] = await publicClient.readContract({
    address: delegationRegistryAddress(effectiveChainId),
    abi: DELEGATION_REGISTRY_ABI,
    functionName: "hasActiveDelegation",
    args: [userAddress],
  });
  return hasDelegation;
}

/**
 * Record an approved action on TaxeeManager for a MetaMask / EIP-7702 user.
 * Requires EIP7702_EXECUTOR_PRIVATE_KEY to be setAuthorizedExecutor on the manager.
 */
export async function executeApprovedActionEip7702(
  action: ApprovedAction,
  userWalletAddress: string,
): Promise<Eip7702ExecutionReceipt> {
  const pk = process.env["EIP7702_EXECUTOR_PRIVATE_KEY"];
  if (!pk?.startsWith("0x")) {
    throw new Error(
      "EIP7702_EXECUTOR_PRIVATE_KEY not configured — set the deployer/executor key authorized on TaxeeManager",
    );
  }

  const user = userWalletAddress as Address;
  const { candidateAction, lotManifest } = action;
  const firstLot = lotManifest.lots[0] ?? candidateAction.lots[0];
  if (!firstLot) {
    throw new Error("No lots in approved action");
  }

  // Use the lot's chain for EIP-7702 — execution happens wherever the lots live
  const chainId = firstLot.chainId;

  const hasDelegation = await checkActiveDelegation(user, chainId);
  if (!hasDelegation) {
    throw new Error(
      "No active EIP-7702 delegation on-chain. Complete Agent Activation in onboarding first.",
    );
  }

  const assetAddr = resolveTokenAddress(firstLot.assetId, chainId);
  if (!assetAddr) {
    throw new Error(`Unsupported asset ${firstLot.assetId} on chain ${chainId}`);
  }

  const decimals = tokenDecimals(firstLot.assetId);
  const quantity = lotManifest.lots.reduce((s, l) => s + parseFloat(l.quantity), 0);
  const amount = parseUnits(quantity.toFixed(decimals > 8 ? 8 : decimals), decimals);
  const estimatedUsd = BigInt(Math.round(lotManifest.estimatedProceedsUsd * 1e6));
  const lotId = firstLot.id;

  const account = privateKeyToAccount(pk as Hex);
  const chain = viemChain(chainId);
  const transport = http(rpcUrl(chainId));
  const publicClient = createPublicClient({ chain, transport });
  const walletClient = createWalletClient({ account, chain, transport });

  const manager = taxeeManagerAddress(chainId);
  let functionName: "executeHarvest" | "executeRebuy" | "executeYieldMove";
  let args: readonly unknown[];

  switch (candidateAction.type) {
    case "HARVEST":
    case "REBALANCE":
      functionName = "executeHarvest";
      args = [user, assetAddr, amount, estimatedUsd, lotId];
      break;
    case "PARK": {
      const usyc = process.env["USYC_TOKEN_ADDRESS"] as Address | undefined;
      if (!usyc?.startsWith("0x")) {
        throw new Error("USYC_TOKEN_ADDRESS not set — required for PARK / yield moves");
      }
      functionName = "executeYieldMove";
      args = [user, assetAddr, usyc, amount, estimatedUsd];
      break;
    }
    default:
      throw new Error(`Action type ${candidateAction.type} is not executable via EIP-7702`);
  }

  const { request } = await publicClient.simulateContract({
    address: manager,
    abi: TAXEE_MANAGER_ABI,
    functionName,
    args: args as never,
    account,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status !== "success") {
    throw new Error(`TaxeeManager.${functionName} reverted (tx ${hash})`);
  }

  return { txHash: hash };
}
