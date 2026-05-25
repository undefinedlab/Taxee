/**
 * Live wallet balance reader — fetches current token positions across chains.
 *
 * Uses Alchemy:
 *   - eth_getBalance        → native ETH
 *   - alchemy_getTokenBalances (DEFAULT_TOKENS) → top ERC-20 holdings
 *   - alchemy_getTokenMetadata → symbol + decimals for unknown tokens
 */
import axios from "axios";

// ─── Arc testnet — direct RPC (not Alchemy) ─────────────────────────────────

const ARC_CHAIN_ID   = 5042002;
const ARC_CHAIN_LABEL = "Arc Testnet";

async function fetchArcPositions(walletAddress: string): Promise<TokenPosition[]> {
  const rpcUrl = process.env["ARC_RPC_URL"];
  if (!rpcUrl) return [];

  try {
    const res = await axios.post(
      rpcUrl,
      { jsonrpc: "2.0", id: 1, method: "eth_getBalance", params: [walletAddress, "latest"] },
      { timeout: 8000 },
    );
    const hexBal = res.data?.result as string | undefined;
    if (!hexBal || hexBal === "0x0" || hexBal === "0x") return [];

    // USDC is the native gas token on Arc — denomination follows EVM convention (18 decimals)
    const balance = Number(BigInt(hexBal)) / 1e18;
    if (balance < 0.001) return [];

    return [{
      assetId:    "USDC",
      chainId:    ARC_CHAIN_ID,
      chainLabel: ARC_CHAIN_LABEL,
      balance,
      priceUsd:   1,
      valueUsd:   balance,
      isStable:   true,
    }];
  } catch (err) {
    console.warn(`[balanceReader] arc-testnet: ${(err as Error).message}`);
    return [];
  }
}

// ─── Networks ─────────────────────────────────────────────────────────────────

const NETWORKS: Array<{ alchemyNetwork: string; chainId: number; label: string }> = [
  { alchemyNetwork: "eth-mainnet",  chainId: 1,        label: "Ethereum"     },
  { alchemyNetwork: "eth-sepolia",  chainId: 11155111, label: "Sepolia"      },
  { alchemyNetwork: "base-mainnet", chainId: 8453,     label: "Base"         },
  { alchemyNetwork: "base-sepolia", chainId: 84532,    label: "Base Sepolia" },
  { alchemyNetwork: "opt-mainnet",  chainId: 10,       label: "Optimism"     },
  { alchemyNetwork: "arb-mainnet",  chainId: 42161,    label: "Arbitrum"     },
];

// ─── Known ERC-20 token address → symbol ─────────────────────────────────────

const KNOWN_TOKENS: Record<string, { symbol: string; decimals: number }> = {
  // Ethereum mainnet
  "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599": { symbol: "wBTC",  decimals: 8  },
  "0x514910771af9ca656af840dff83e8264ecf986ca": { symbol: "LINK",  decimals: 18 },
  "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984": { symbol: "UNI",   decimals: 18 },
  "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": { symbol: "wETH",  decimals: 18 },
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": { symbol: "USDC",  decimals: 6  },
  "0xdac17f958d2ee523a2206206994597c13d831ec7": { symbol: "USDT",  decimals: 6  },
  "0x6b175474e89094c44da98b954eedeac495271d0f": { symbol: "DAI",   decimals: 18 },
  "0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9": { symbol: "AAVE",  decimals: 18 },
  // Base mainnet — wETH shares 0x4200… with Optimism (same address, both OP-stack)
  "0x4200000000000000000000000000000000000006": { symbol: "wETH",  decimals: 18 },
  "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": { symbol: "USDC",  decimals: 6  },
  "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf": { symbol: "wBTC",  decimals: 8  },
  "0x940181a94a35a4569e4529a3cdfb74e38fd98631": { symbol: "AERO",  decimals: 18 },
  "0x50c5725949a6f0c72e6c4a641f24049a917db0cb": { symbol: "DAI",   decimals: 18 },
  // Optimism mainnet
  "0x0b2c639c533813f4aa9d7837caf62653d097ff85": { symbol: "USDC",   decimals: 6  },
  "0x7f5c764cbc14f9669b88837ca1490cca17c31607": { symbol: "USDC.e", decimals: 6  },
  "0x94b008aa00579c1307b0ef2c499ad98a8ce58e58": { symbol: "USDT",   decimals: 6  },
  "0xda10009cbd5d07dd0cecc66161fc93d7c9000da1": { symbol: "DAI",    decimals: 18 },
  "0x68f180fcce6836688e9084f035309e29bf0a2095": { symbol: "wBTC",   decimals: 8  },
  "0x4200000000000000000000000000000000000042": { symbol: "OP",     decimals: 18 },
  // Arbitrum One
  "0xaf88d065e77c8cc2239327c5edb3a432268e5831": { symbol: "USDC",   decimals: 6  },
  "0xff970a61a04b1ca14834a43f5de4533ebddb5cc8": { symbol: "USDC.e", decimals: 6  },
  "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9": { symbol: "USDT",   decimals: 6  },
  "0x82af49447d8a07e3bd95bd0d56f35241523fbab1": { symbol: "wETH",   decimals: 18 },
  "0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f": { symbol: "wBTC",   decimals: 8  },
  "0x912ce59144191c1204e64559fe8253a0e49e6548": { symbol: "ARB",    decimals: 18 },
};

// Stablecoins — tracked for balances but not for tax lots
const STABLES = new Set(["USDC", "USDT", "DAI", "USDbC", "USDC.e"]);

// ─── CoinGecko symbol → gecko id ─────────────────────────────────────────────

const GECKO_ID: Record<string, string> = {
  ETH:     "ethereum",
  wETH:    "weth",
  BTC:     "bitcoin",
  wBTC:    "wrapped-bitcoin",
  LINK:    "chainlink",
  UNI:     "uniswap",
  AAVE:    "aave",
  AERO:    "aerodrome-finance",
  OP:      "optimism",
  ARB:     "arbitrum",
  USDC:    "usd-coin",
  "USDC.e":"usd-coin",
  USDT:    "tether",
  DAI:     "dai",
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TokenPosition {
  assetId:   string;
  chainId:   number;
  chainLabel: string;
  balance:   number;
  priceUsd:  number;
  valueUsd:  number;
  isStable:  boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function alchemyCall(
  network: string,
  apiKey: string,
  method: string,
  params: unknown[],
): Promise<unknown> {
  const res = await axios.post(
    `https://${network}.g.alchemy.com/v2/${apiKey}`,
    { jsonrpc: "2.0", id: 1, method, params },
    { timeout: 10000 },
  );
  return res.data?.result;
}

async function fetchCurrentPrices(
  symbols: string[],
  geckoKey?: string,
): Promise<Record<string, number>> {
  const ids = [...new Set(symbols.map((s) => GECKO_ID[s]).filter(Boolean))];
  if (ids.length === 0) return {};

  const headers: Record<string, string> = {};
  if (geckoKey) {
    headers[geckoKey.startsWith("CG-") ? "x-cg-demo-api-key" : "x-cg-pro-api-key"] = geckoKey;
  }

  try {
    const res = await axios.get("https://api.coingecko.com/api/v3/simple/price", {
      params: { ids: ids.join(","), vs_currencies: "usd" },
      headers,
      timeout: 8000,
    });
    const prices: Record<string, number> = {};
    for (const [sym, geckoId] of Object.entries(GECKO_ID)) {
      if (res.data[geckoId]?.usd) prices[sym] = res.data[geckoId].usd;
    }
    return prices;
  } catch {
    return {};
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

/**
 * Fetch all current token positions for a wallet across supported chains.
 * Returns only non-zero balances above dust threshold.
 */
export async function fetchWalletPositions(
  walletAddress: string,
  alchemyKey:    string,
  geckoKey?:     string,
  networkFilter?: number[],
): Promise<TokenPosition[]> {
  const positions: TokenPosition[] = [];
  const networksToScan = networkFilter
    ? NETWORKS.filter((n) => networkFilter.includes(n.chainId))
    : NETWORKS;

  for (const { alchemyNetwork, chainId, label } of networksToScan) {
    try {
      // ── Native ETH balance ─────────────────────────────────────────────────
      const hexBalance = await alchemyCall(
        alchemyNetwork, alchemyKey,
        "eth_getBalance",
        [walletAddress, "latest"],
      ) as string;

      const ethBalance = parseInt(hexBalance, 16) / 1e18;
      if (ethBalance > 0.0001) {
        positions.push({
          assetId:    "ETH",
          chainId,
          chainLabel: label,
          balance:    ethBalance,
          priceUsd:   0,
          valueUsd:   0,
          isStable:   false,
        });
      }

      // ── ERC-20 token balances ──────────────────────────────────────────────
      const tokenData = await alchemyCall(
        alchemyNetwork, alchemyKey,
        "alchemy_getTokenBalances",
        [walletAddress, "DEFAULT_TOKENS"],
      ) as { tokenBalances: Array<{ contractAddress: string; tokenBalance: string | null }> };

      for (const tb of tokenData?.tokenBalances ?? []) {
        if (!tb.tokenBalance || tb.tokenBalance === "0x0") continue;

        const addr = tb.contractAddress.toLowerCase();
        const known = KNOWN_TOKENS[addr];
        if (!known) continue;

        const rawBal = BigInt(tb.tokenBalance);
        const balance = Number(rawBal) / Math.pow(10, known.decimals);
        if (balance < 0.0001) continue;

        positions.push({
          assetId:    known.symbol,
          chainId,
          chainLabel: label,
          balance,
          priceUsd:   0,
          valueUsd:   0,
          isStable:   STABLES.has(known.symbol),
        });
      }
    } catch (err) {
      console.warn(`[balanceReader] ${alchemyNetwork}: ${(err as Error).message}`);
    }
  }

  // ── Fetch current prices in one batch call ─────────────────────────────────
  const symbols = [...new Set(positions.map((p) => p.assetId))];
  const prices  = await fetchCurrentPrices(symbols, geckoKey);

  for (const pos of positions) {
    pos.priceUsd = prices[pos.assetId] ?? 0;
    pos.valueUsd = pos.balance * pos.priceUsd;
  }

  // ── Arc testnet — native USDC via direct RPC ─────────────────────────────
  const arcPositions = await fetchArcPositions(walletAddress);
  positions.push(...arcPositions);

  return positions.filter((p) => p.valueUsd > 0.01 || p.isStable || p.priceUsd === 0);
}
