/**
 * Real on-chain lot importer — builds tax lots from actual wallet history.
 *
 * Supports:
 *   - Ethereum mainnet  (chainId 1)
 *   - Base mainnet      (chainId 8453)
 *   - Base Sepolia      (chainId 84532)
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
  // Base mainnet
  "0x4200000000000000000000000000000000000006": "wETH",
  "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf": "wBTC",
  "0x50c5725949a6f0c72e6c4a641f24049a917db0cb": "DAI",
  "0x940181a94a35a4569e4529a3cdfb74e38fd98631": "AERO",
  // Stablecoins — will be skipped
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": "USDC",
  "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": "USDC",
  "0xdac17f958d2ee523a2206206994597c13d831ec7": "USDT",
  "0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca": "USDbC",
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

export interface ImportedLot {
  assetId:      string;
  chainId:      number;
  quantity:     string;
  costBasisUsd: string;
  acquiredAt:   Date;
  txHash:       string;
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
      if (price === undefined) {
        price = await getHistoricalPrice(assetId, acquiredAt, geckoKey);
        priceCache.set(dateKey, price);
        await new Promise((r) => setTimeout(r, 250));
      }

      const costBasisUsd = quantity * price;
      if (costBasisUsd < MIN_LOT_USD && price > 0) continue;

      lots.push({
        assetId,
        chainId,
        quantity:     String(quantity),
        costBasisUsd: price > 0 ? String(costBasisUsd) : "0",
        acquiredAt,
        txHash: tx.hash,
      });
    }
  }

  console.log(`[lotImporter] Imported ${lots.length} new lots for ${walletAddress}`);
  return lots;
}
