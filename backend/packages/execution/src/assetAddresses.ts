import { getChainConfig, isSupportedChain } from "./chainConfig.js";

/** Native ETH sentinel used by TaxeeManager */
export const NATIVE_ETH = "0x0000000000000000000000000000000000000000" as const;

const ASSET_TOKEN: Record<string, Partial<Record<number, `0x${string}`>>> = {
  ETH: {
    1: NATIVE_ETH,
    11155111: NATIVE_ETH,
    8453: NATIVE_ETH,
    84532: NATIVE_ETH,
    42161: NATIVE_ETH,
    // Arc: USDC is native gas, ETH is a bridged ERC-20 (no canonical address yet)
  },
  USDC: {
    1: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    11155111: "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238",
    8453: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    84532: "0x036cbd53842c5426634e7929541ec2318f3dcf7e",
    42161: "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
    5042002: NATIVE_ETH, // USDC is native gas on Arc (address 0x0)
  },
  WETH: {
    8453: "0x4200000000000000000000000000000000000006",
    84532: "0x4200000000000000000000000000000000000006",
  },
};

const DECIMALS: Record<string, number> = {
  ETH: 18,
  WETH: 18,
  USDC: 6,
  BTC: 8,
  WBTC: 8,
};

export function resolveTokenAddress(assetId: string, chainId: number): `0x${string}` | null {
  const sym = assetId.toUpperCase();
  const mapped = ASSET_TOKEN[sym]?.[chainId];
  if (mapped) return mapped;
  if (sym === "ETH") return NATIVE_ETH;
  if (isSupportedChain(chainId)) {
    const usdc = getChainConfig(chainId).usdcAddress;
    if (sym === "USDC") return usdc as `0x${string}`;
  }
  return null;
}

export function tokenDecimals(assetId: string): number {
  return DECIMALS[assetId.toUpperCase()] ?? 18;
}
