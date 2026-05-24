/**
 * Real on-chain lot importer — builds tax lots from actual wallet history.
 *
 * Supports:
 *   - Ethereum mainnet  (chainId 1)
 *   - Ethereum Sepolia  (chainId 11155111)
 *   - Base mainnet      (chainId 8453)
 *   - Base Sepolia      (chainId 84532)
 *   - Optimism          (chainId 10)
 *   - Arbitrum One      (chainId 42161)
 *
 * Flow per chain:
 *   1. Alchemy `alchemy_getAssetTransfers` → inbound transfers (acquisitions)
 *   2. Resolve token address → asset symbol
 *   3. Fetch historical price at acquisition date from CoinGecko
 *   4. Return ImportedLot[] — caller deduplicates against DB by txHash
 */
import axios from "axios";

// ─── Network config ───────────────────────────────────────────────────────────

const NETWORKS: Array<{ alchemyNetwork: string; chainId: number }> = [
  { alchemyNetwork: "eth-mainnet",  chainId: 1        },
  { alchemyNetwork: "eth-sepolia",  chainId: 11155111 },
  { alchemyNetwork: "base-mainnet", chainId: 8453     },
  { alchemyNetwork: "base-sepolia", chainId: 84532    },
  { alchemyNetwork: "opt-mainnet",  chainId: 10       },
  { alchemyNetwork: "arb-mainnet",  chainId: 42161    },
];

// ─── Token address → taxee asset symbol ──────────────────────────────────────

const TOKEN_MAP: Record<string, string> = {
  // Ethereum mainnet
  "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599": "wBTC",
  "0x514910771af9ca656af840dff83e8264ecf986ca": "LINK",
  "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984": "UNI",
  "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": "wETH",
  "0x4d224452801aced8b2f0aebe155379bb5d594381": "APE",
  "0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9": "AAVE",
  "0x6b175474e89094c44da98b954eedeac495271d0f": "DAI",
  // Base mainnet (wETH 0x4200… is shared with Optimism — both are OP-stack)
  "0x4200000000000000000000000000000000000006": "wETH",
  "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf": "wBTC",
  "0x50c5725949a6f0c72e6c4a641f24049a917db0cb": "DAI",
  "0x940181a94a35a4569e4529a3cdfb74e38fd98631": "AERO",
  // Optimism
  "0x68f180fcce6836688e9084f035309e29bf0a2095": "wBTC",
  "0x4200000000000000000000000000000000000042": "OP",
  // Arbitrum One
  "0x82af49447d8a07e3bd95bd0d56f35241523fbab1": "wETH",
  "0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f": "wBTC",
  "0x912ce59144191c1204e64559fe8253a0e49e6548": "ARB",
  // Stablecoins — will be skipped via SKIP_ASSETS
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": "USDC",
  "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": "USDC",
  "0xdac17f958d2ee523a2206206994597c13d831ec7": "USDT",
  "0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca": "USDbC",
  "0x0b2c639c533813f4aa9d7837caf62653d097ff85": "USDC",      // Optimism
  "0x7f5c764cbc14f9669b88837ca1490cca17c31607": "USDC.e",    // Optimism bridged
  "0x94b008aa00579c1307b0ef2c499ad98a8ce58e58": "USDT",      // Optimism
  "0xda10009cbd5d07dd0cecc66161fc93d7c9000da1": "DAI",       // Optimism (same addr on Arbitrum)
  "0xaf88d065e77c8cc2239327c5edb3a432268e5831": "USDC",      // Arbitrum
  "0xff970a61a04b1ca14834a43f5de4533ebddb5cc8": "USDC.e",    // Arbitrum bridged
  "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9": "USDT",      // Arbitrum
};

// Skip stablecoins — no capital gain/loss
const SKIP_ASSETS = new Set(["USDC", "USDT", "DAI", "USDbC", "USDC.e", "USYC"]);

// Minimum USD value to create a lot (skip dust)
const MIN_LOT_USD = 1;

// CoinGecko asset ID map
const GECKO_ID: Record<string, string> = {
  ETH:  "ethereum",
  wETH: "weth",
  BTC:  "bitcoin",
  wBTC: "wrapped-bitcoin",
  LINK: "chainlink",
  UNI:  "uniswap",
  ARB:  "arbitrum",
  OP:   "optimism",
  AAVE: "aave",
  AERO: "aerodrome-finance",
  APE:  "apecoin",
};

// ─── Types ────────────────────────────────────────────────────────────────────

export type CostBasisPriceSource = "acquisition_date" | "spot_fallback" | "none";

export interface ImportedLot {
  assetId:      string;
  chainId:      number;
  quantity:     string;
  costBasisUsd: string;
  acquiredAt:   Date;
  txHash:       string;
  /** How cost basis USD price was resolved */
  priceSource:  CostBasisPriceSource;
}

/**
 * Price for cost basis: acquisition-day USD from CoinGecko history first.
 * Spot price is only used when history is unavailable (rate limit, API miss).
 */
export async function resolveAcquisitionPrice(
  assetId: string,
  acquiredAt: Date,
  geckoKey?: string,
): Promise<{ price: number; source: CostBasisPriceSource }> {
  const historical = await getHistoricalPrice(assetId, acquiredAt, geckoKey);
  if (historical > 0) {
    return { price: historical, source: "acquisition_date" };
  }
  const spot = await getCurrentPrice(assetId, geckoKey);
  if (spot > 0) {
    console.warn(
      `[lotImporter] Using spot fallback for ${assetId} on ${acquiredAt.toISOString().slice(0, 10)} (history unavailable)`,
    );
    return { price: spot, source: "spot_fallback" };
  }
  return { price: 0, source: "none" };
}

// ─── CoinGecko historical price ───────────────────────────────────────────────

async function getHistoricalPrice(
  assetId:    string,
  date:       Date,
  geckoKey?:  string,
): Promise<number> {
  const geckoId = GECKO_ID[assetId];
  if (!geckoId) return 0;

  const dd   = String(date.getDate()).padStart(2, "0");
  const mm   = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  const dateStr = `${dd}-${mm}-${yyyy}`;

  const headers: Record<string, string> = {};
  if (geckoKey) {
    headers[geckoKey.startsWith("CG-") ? "x-cg-demo-api-key" : "x-cg-pro-api-key"] = geckoKey;
  }

  try {
    const res = await axios.get(
      `https://api.coingecko.com/api/v3/coins/${geckoId}/history`,
      { params: { date: dateStr, localization: false }, headers, timeout: 8000 },
    );
    return (res.data as any)?.market_data?.current_price?.usd ?? 0;
  } catch {
    return 0;
  }
}

async function getCurrentPrice(assetId: string, geckoKey?: string): Promise<number> {
  const geckoId = GECKO_ID[assetId];
  if (!geckoId) return 0;

  const headers: Record<string, string> = {};
  if (geckoKey) {
    headers[geckoKey.startsWith("CG-") ? "x-cg-demo-api-key" : "x-cg-pro-api-key"] = geckoKey;
  }

  try {
    const res = await axios.get<Record<string, { usd: number }>>(
      "https://api.coingecko.com/api/v3/simple/price",
      { params: { ids: geckoId, vs_currencies: "usd" }, headers, timeout: 8000 },
    );
    return res.data[geckoId]?.usd ?? 0;
  } catch {
    return 0;
  }
}

// ─── Alchemy transfers ────────────────────────────────────────────────────────

interface AlchemyTransfer {
  blockNum:    string;
  hash:        string;
  from:        string;
  to:          string;
  value:       number | null;
  asset:       string | null;
  category:    "external" | "erc20" | "erc721" | "erc1155";
  rawContract: { address: string | null; decimal: string | null; value: string | null };
  metadata:    { blockTimestamp: string };
}

async function fetchInboundTransfers(
  walletAddress: string,
  alchemyNetwork: string,
  alchemyKey: string,
): Promise<AlchemyTransfer[]> {
  const url = `https://${alchemyNetwork}.g.alchemy.com/v2/${alchemyKey}`;

  const res = await axios.post(
    url,
    {
      jsonrpc: "2.0",
      id:      1,
      method:  "alchemy_getAssetTransfers",
      params:  [{
        toAddress:       walletAddress,
        category:        ["external", "erc20"],
        withMetadata:    true,
        excludeZeroValue: true,
        maxCount:        "0x3e8",
        order:           "desc",
      }],
    },
    { timeout: 15000 },
  );

  return (res.data?.result?.transfers ?? []) as AlchemyTransfer[];
}

// ─── Main importer ────────────────────────────────────────────────────────────

/**
 * Import all real inbound token transfers for a wallet across supported chains.
 *
 * @param walletAddress  - The 0x wallet to scan
 * @param alchemyKey     - Alchemy API key
 * @param geckoKey       - CoinGecko API key (optional but improves cost basis accuracy)
 * @param existingHashes - Set of txHashes already in DB (to skip duplicates)
 * @param networks       - Optional subset of chainIds to scan (default: all)
 */
export async function importLotsForWallet(
  walletAddress:   string,
  alchemyKey:      string,
  geckoKey?:       string,
  existingHashes?: Set<string>,
  networks?:       number[],
): Promise<ImportedLot[]> {
  const lots: ImportedLot[] = [];
  const priceCache = new Map<string, number>();

  const networksToScan = networks
    ? NETWORKS.filter((n) => networks.includes(n.chainId))
    : NETWORKS;

  for (const { alchemyNetwork, chainId } of networksToScan) {
    console.log(`[lotImporter] Scanning ${alchemyNetwork} for ${walletAddress}`);

    let transfers: AlchemyTransfer[];
    try {
      transfers = await fetchInboundTransfers(walletAddress, alchemyNetwork, alchemyKey);
    } catch (err) {
      console.warn(`[lotImporter] Alchemy error on ${alchemyNetwork}: ${(err as Error).message}`);
      continue;
    }

    console.log(`[lotImporter] ${transfers.length} inbound transfers on ${alchemyNetwork}`);

    for (const tx of transfers) {
      if (existingHashes?.has(tx.hash)) continue;

      let assetId: string | undefined;
      if (tx.category === "external") {
        assetId = "ETH";
      } else if (tx.rawContract?.address) {
        assetId = TOKEN_MAP[tx.rawContract.address.toLowerCase()];
      } else if (tx.asset) {
        assetId = tx.asset;
      }

      if (!assetId || SKIP_ASSETS.has(assetId)) continue;

      const quantity = tx.value ?? 0;
      if (quantity <= 0) continue;

      const acquiredAt = tx.metadata?.blockTimestamp
        ? new Date(tx.metadata.blockTimestamp)
        : new Date();

      const dateKey = `${assetId}:${acquiredAt.toISOString().slice(0, 10)}`;
      let price = priceCache.get(dateKey);
      let priceSource: CostBasisPriceSource = "acquisition_date";
      if (price === undefined) {
        const resolved = await resolveAcquisitionPrice(assetId, acquiredAt, geckoKey);
        price = resolved.price;
        priceSource = resolved.source;
        priceCache.set(dateKey, price);
        await new Promise((r) => setTimeout(r, 250));
      }

      const costBasisUsd = quantity * price;
      if (costBasisUsd < MIN_LOT_USD && price > 0) continue;

      if (priceSource === "acquisition_date") {
        console.log(
          `[lotImporter] ${assetId} ${acquiredAt.toISOString().slice(0, 10)} @ $${price.toFixed(2)} → basis $${costBasisUsd.toFixed(4)}`,
        );
      }

      lots.push({
        assetId,
        chainId,
        quantity:     String(quantity),
        costBasisUsd: price > 0 ? String(costBasisUsd.toFixed(4)) : "0",
        acquiredAt,
        txHash:       tx.hash,
        priceSource,
      });
    }
  }

  console.log(`[lotImporter] Imported ${lots.length} new lots for ${walletAddress}`);
  return lots;
}
