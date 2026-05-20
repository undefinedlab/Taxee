import axios from "axios";
import type { RegimeSignals } from "@taxee/shared";

/**
 * Collect onchain signals used by the LLM Regime Classifier.
 *
 * Sources:
 *   - BTC funding rate  → exchange APIs (Binance / Bybit, public endpoints)
 *   - Stablecoin supply → CoinGecko market cap delta
 *   - Realized vol      → price series from CoinGecko
 *   - Fear & Greed      → alternative.me public API
 *   - ETH/BTC ratio trend → derived from prices
 *
 * All calls are best-effort with fallbacks — a missing signal does not
 * block the heartbeat; the regime classifier handles partial inputs.
 */
export async function collectRegimeSignals(): Promise<RegimeSignals> {
  const [fundingRate, fearGreed, prices7d] = await Promise.allSettled([
    fetchBtcFundingRate(),
    fetchFearAndGreedIndex(),
    fetchPrices7dHistory(),
  ]);

  const btcFundingRatePct = fundingRate.status === "fulfilled" ? fundingRate.value : 0;
  const fearAndGreedIndex = fearGreed.status === "fulfilled"  ? fearGreed.value  : 50;
  const prices            = prices7d.status === "fulfilled"   ? prices7d.value   : null;

  const stablecoinDelta = prices ? computeStablecoinSupplyDelta(prices) : 0;
  const realizedVol     = prices ? computeRealizedVol(prices.btcPrices)  : 0;
  const ethBtcTrend     = prices ? computeEthBtcTrend(prices)            : "flat";

  return {
    btcFundingRatePct,
    stablecoinSupplyDelta7dPct: stablecoinDelta,
    realizedVol30d: realizedVol,
    fearAndGreedIndex,
    ethBtcRatioTrend: ethBtcTrend,
    capturedAt: new Date(),
  };
}

async function fetchBtcFundingRate(): Promise<number> {
  const res = await axios.get<{ data: Array<{ fundingRate: string }> }>(
    "https://api.binance.com/fapi/v1/fundingRate?symbol=BTCUSDT&limit=1"
  );
  const rate = parseFloat(res.data.data[0]?.fundingRate ?? "0");
  return rate * 100;
}

async function fetchFearAndGreedIndex(): Promise<number> {
  const res = await axios.get<{
    data: Array<{ value: string; value_classification: string }>;
  }>("https://api.alternative.me/fng/?limit=1");
  return parseInt(res.data.data[0]?.value ?? "50", 10);
}

interface PriceHistory {
  btcPrices: number[];
  ethPrices: number[];
  usdcMarketCap7dAgo: number;
  usdcMarketCapNow: number;
}

async function fetchPrices7dHistory(): Promise<PriceHistory> {
  const [btcRes, ethRes, usdcRes] = await Promise.all([
    axios.get<{ prices: [number, number][] }>(
      "https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=30"
    ),
    axios.get<{ prices: [number, number][] }>(
      "https://api.coingecko.com/api/v3/coins/ethereum/market_chart?vs_currency=usd&days=7"
    ),
    axios.get<{ market_caps: [number, number][] }>(
      "https://api.coingecko.com/api/v3/coins/usd-coin/market_chart?vs_currency=usd&days=7"
    ),
  ]);

  return {
    btcPrices: btcRes.data.prices.map(([, p]) => p),
    ethPrices: ethRes.data.prices.map(([, p]) => p),
    usdcMarketCap7dAgo: usdcRes.data.market_caps[0]?.[1] ?? 0,
    usdcMarketCapNow:   usdcRes.data.market_caps[usdcRes.data.market_caps.length - 1]?.[1] ?? 0,
  };
}

function computeStablecoinSupplyDelta(prices: PriceHistory): number {
  if (prices.usdcMarketCap7dAgo === 0) return 0;
  return ((prices.usdcMarketCapNow - prices.usdcMarketCap7dAgo) / prices.usdcMarketCap7dAgo) * 100;
}

function computeRealizedVol(prices: number[]): number {
  if (prices.length < 2) return 0;
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const p0 = prices[i - 1];
    const p1 = prices[i];
    if (p0 && p1 && p0 > 0) {
      returns.push(Math.log(p1 / p0));
    }
  }
  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + Math.pow(r - mean, 2), 0) / returns.length;
  return Math.sqrt(variance * 365) * 100;
}

function computeEthBtcTrend(prices: PriceHistory): "rising" | "declining" | "flat" {
  if (prices.ethPrices.length < 2 || prices.btcPrices.length < 2) return "flat";

  const ethStart = prices.ethPrices[0];
  const ethEnd   = prices.ethPrices[prices.ethPrices.length - 1];
  const btcStart = prices.btcPrices[0];
  const btcEnd   = prices.btcPrices[prices.btcPrices.length - 1];

  if (!ethStart || !ethEnd || !btcStart || !btcEnd) return "flat";

  const ratioStart = ethStart / btcStart;
  const ratioEnd   = ethEnd   / btcEnd;
  const delta      = (ratioEnd - ratioStart) / ratioStart;

  if (delta > 0.02)  return "rising";
  if (delta < -0.02) return "declining";
  return "flat";
}
