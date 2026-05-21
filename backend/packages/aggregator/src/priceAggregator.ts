import axios from "axios";

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

const ASSET_ID_MAP: Record<string, string> = {
  ETH:   "ethereum",
  wETH:  "weth",
  BTC:   "bitcoin",
  wBTC:  "wrapped-bitcoin",
  SOL:   "solana",
  MATIC: "matic-network",
  AVAX:  "avalanche-2",
  LINK:  "chainlink",
  UNI:   "uniswap",
  ARB:   "arbitrum",
  OP:    "optimism",
  USDC:  "usd-coin",
  USYC:  "hashnote-us-yield-coin",
};

/**
 * Fetch current USD prices for a set of asset symbols.
 *
 * Returns a map of assetId → USD price.
 * Falls back to 0 for unknown assets (caller should handle missing prices).
 */
export async function fetchPrices(
  assetIds: string[],
  apiKey?: string
): Promise<Record<string, number>> {
  const geckoIds = assetIds
    .map((id) => ASSET_ID_MAP[id])
    .filter(Boolean) as string[];

  if (geckoIds.length === 0) return {};

  const params: Record<string, string> = {
    ids:             geckoIds.join(","),
    vs_currencies:   "usd",
    precision:       "8",
  };

  const headers: Record<string, string> = {};
  if (apiKey) {
    const headerName = apiKey.startsWith("CG-") ? "x-cg-demo-api-key" : "x-cg-pro-api-key";
    headers[headerName] = apiKey;
  }

  const res = await axios.get<Record<string, { usd: number }>>(
    `${COINGECKO_BASE}/simple/price`,
    { params, headers }
  );

  const result: Record<string, number> = {};

  for (const assetId of assetIds) {
    const geckoId = ASSET_ID_MAP[assetId];
    if (geckoId && res.data[geckoId]?.usd) {
      result[assetId] = res.data[geckoId].usd;
    }
  }

  return result;
}

/**
 * Map a CoinGecko coin ID back to a taxee asset symbol.
 * Used when building portfolio snapshots from raw chain data.
 */
export function geckoIdToAssetId(geckoId: string): string | undefined {
  for (const [assetId, gId] of Object.entries(ASSET_ID_MAP)) {
    if (gId === geckoId) return assetId;
  }
  return undefined;
}
