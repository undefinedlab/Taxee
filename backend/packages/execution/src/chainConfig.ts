import type { CircleBlockchain } from "@taxee/aggregator";

export interface ChainConfig {
  chainId:                    number;
  name:                       string;
  circleBlockchain:           CircleBlockchain;
  isTestnet:                  boolean;
  usdcAddress:                string;
  cctpTokenMessenger?:        string;
  cctpMessageTransmitter?:    string;
  cctpDomain:                 number;
  rpcEnvVar:                  string;     // env var holding the JSON-RPC URL for viem reads
  explorerTxUrl:              string;     // full prefix incl. trailing slash; append the hex hash
}

const CHAINS: Record<number, ChainConfig> = {
  1: {
    chainId:                 1,
    name:                    "Ethereum",
    circleBlockchain:        "ETH",
    isTestnet:               false,
    usdcAddress:             "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    cctpTokenMessenger:      "0xbd3fa81b58ba92a82136038b25adec7066af3155",
    cctpMessageTransmitter:  "0x0a992d191deec32afe36203ad87d7d289a738f81",
    cctpDomain:              0,
    rpcEnvVar:               "ETH_RPC_URL",
    explorerTxUrl:           "https://etherscan.io/tx/",
  },
  11155111: {
    chainId:                 11155111,
    name:                    "Ethereum Sepolia",
    circleBlockchain:        "ETH-SEPOLIA",
    isTestnet:               true,
    usdcAddress:             "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238",
    cctpTokenMessenger:      "0x9f3b8679c73c2fef8b59b4f3444d4e156fb70aa5",
    cctpMessageTransmitter:  "0x7865fafc2db2093669d92c0f33aeef291086befd",
    cctpDomain:              0,
    rpcEnvVar:               "ETH_SEPOLIA_RPC_URL",
    explorerTxUrl:           "https://sepolia.etherscan.io/tx/",
  },
  8453: {
    chainId:                 8453,
    name:                    "Base",
    circleBlockchain:        "BASE",
    isTestnet:               false,
    usdcAddress:             "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    cctpTokenMessenger:      "0x1682ae6375c4e4a97e4b583bc394c861a46d8962",
    cctpMessageTransmitter:  "0xad09780d193884d503182ad4588450c416d6f9d4",
    cctpDomain:              6,
    rpcEnvVar:               "BASE_RPC_URL",
    explorerTxUrl:           "https://basescan.org/tx/",
  },
  84532: {
    chainId:                 84532,
    name:                    "Base Sepolia",
    circleBlockchain:        "BASE-SEPOLIA",
    isTestnet:               true,
    usdcAddress:             "0x036cbd53842c5426634e7929541ec2318f3dcf7e",
    cctpTokenMessenger:      "0x9f3b8679c73c2fef8b59b4f3444d4e156fb70aa5",
    cctpMessageTransmitter:  "0x7865fafc2db2093669d92c0f33aeef291086befd",
    cctpDomain:              6,
    rpcEnvVar:               "BASE_SEPOLIA_RPC_URL",
    explorerTxUrl:           "https://sepolia.basescan.org/tx/",
  },
  42161: {
    chainId:                 42161,
    name:                    "Arbitrum One",
    circleBlockchain:        "ARB",
    isTestnet:               false,
    usdcAddress:             "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
    cctpTokenMessenger:      "0x19330d10d9cc8751218eaf51e8885d058642e08a",
    cctpMessageTransmitter:  "0xc30362313fbba5cf9163f0bb16a0e01f01a896ca",
    cctpDomain:              3,
    rpcEnvVar:               "ARB_RPC_URL",
    explorerTxUrl:           "https://arbiscan.io/tx/",
  },
  // Arc Testnet — Circle's own L1, USDC is native gas token (chainId 5042002)
  5042002: {
    chainId:                 5042002,
    name:                    "Arc Testnet",
    circleBlockchain:        "ARC-TESTNET",
    isTestnet:               true,
    usdcAddress:             "0x0000000000000000000000000000000000000000", // USDC is native gas
    cctpDomain:              7,  // Arc testnet CCTP domain (TBC)
    rpcEnvVar:               "ARC_RPC_URL",
    explorerTxUrl:           "https://explorer.testnet.arc-node.thecanteenapp.com/tx/",
  },
};

export function getChainConfig(chainId: number): ChainConfig {
  const cfg = CHAINS[chainId];
  if (!cfg) throw new Error(`Unsupported chainId: ${chainId}`);
  return cfg;
}

export function isSupportedChain(chainId: number): boolean {
  return chainId in CHAINS;
}

/**
 * Chains users can pick from at policy-creation time. Limited to two for now
 * so we can be sure delegation + funding flows actually work on each.
 */
export const SUPPORTED_EXECUTION_CHAINS = [
  { chainId: 84532,    name: "Base Sepolia",     short: "base"    },
  { chainId: 11155111, name: "Ethereum Sepolia", short: "sepolia" },
] as const;

export type ExecutionChainShortName = (typeof SUPPORTED_EXECUTION_CHAINS)[number]["short"];

export function isSupportedExecutionChain(chainId: number): boolean {
  return SUPPORTED_EXECUTION_CHAINS.some((c) => c.chainId === chainId);
}

/**
 * Resolve the chain to execute on. Per-agent policy override wins; otherwise
 * fall back to the env default.
 */
export function resolveExecutionChainId(policyChainId?: number | null): number {
  if (policyChainId && isSupportedExecutionChain(policyChainId)) return policyChainId;
  return getExecutionChainId();
}

/**
 * Default chain where TaxeeLotRegistry + TaxeeExecutor + USYC are deployed.
 * Arc Testnet for testnet flows, Base mainnet for production.
 */
export function getExecutionChainId(): number {
  const explicit = process.env["EXECUTION_CHAIN_ID"];
  if (explicit) return parseInt(explicit, 10);
  const env = (process.env["CIRCLE_ENVIRONMENT"] ?? "sandbox").toLowerCase();
  return env === "production" ? 8453 : 5042002;
}
