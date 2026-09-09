import { ACCR_TOKEN_LOGO, ROBINHOOD_ACCR } from "@/lib/chains/robinhood";
import { env } from "@/lib/env";

const DEXSCREENER_BASE = "https://api.dexscreener.com";
const ROBINHOOD_CHAIN_SLUG = "robinhood";
const CACHE_TTL_MS = 45_000;
const FETCH_TIMEOUT_MS = 12_000;
const MAX_FETCH_ATTEMPTS = 3;

/** Highest-liquidity ACCR/ETH v4 pool on Robinhood Chain (DexScreener). */
export const KNOWN_ACCR_PAIR =
  "0xa2d632f7fbdc12b11faa64a0c779f4aa11a5a46e2e21bab3ecb1ec8b73b6e9ed";

/** Last-resort spot when DexScreener and env are both unavailable. */
const DEFAULT_ACCR_PRICE_USD = 0.00009;

export type AccrPriceQuote = {
  priceUsd: number;
  logoURI: string;
  pairAddress: string | null;
  liquidityUsd: number;
  asOf: string;
  source: "dexscreener" | "env_fallback" | "stale_cache" | "default_fallback";
};

type DexPair = {
  chainId?: string;
  pairAddress?: string;
  priceUsd?: string;
  liquidity?: { usd?: number };
  baseToken?: { address?: string };
  quoteToken?: { address?: string };
  info?: { imageUrl?: string };
};

let cache: { value: AccrPriceQuote; expiresAt: number } | null = null;

function normalizeAddress(value: string) {
  return value.toLowerCase();
}

export function accrPriceFromPair(pair: DexPair, tokenAddress: string): number | null {
  const price = Number(pair.priceUsd);
  if (!Number.isFinite(price) || price <= 0) return null;

  const token = normalizeAddress(tokenAddress);
  const base = pair.baseToken?.address ? normalizeAddress(pair.baseToken.address) : "";
  const quote = pair.quoteToken?.address ? normalizeAddress(pair.quoteToken.address) : "";

  if (base === token) return price;
  if (quote === token) return 1 / price;
  return null;
}

export function pickBestPair(pairs: DexPair[], tokenAddress: string): DexPair | null {
  const onChain = pairs.filter(
    (pair) => (pair.chainId ?? "").toLowerCase() === ROBINHOOD_CHAIN_SLUG,
  );
  const candidates = onChain.length > 0 ? onChain : pairs;

  let best: DexPair | null = null;
  let bestLiquidity = -1;

  for (const pair of candidates) {
    const price = accrPriceFromPair(pair, tokenAddress);
    if (price == null || price <= 0) continue;
    const liquidity = Number(pair.liquidity?.usd ?? 0);
    if (liquidity > bestLiquidity) {
      best = pair;
      bestLiquidity = liquidity;
    }
  }

  return best;
}

function quoteFromPair(pair: DexPair, tokenAddress: string): AccrPriceQuote | null {
  const priceUsd = accrPriceFromPair(pair, tokenAddress);
  if (priceUsd == null || priceUsd <= 0) return null;
  return {
    priceUsd,
    logoURI: pair.info?.imageUrl ?? ACCR_TOKEN_LOGO,
    pairAddress: pair.pairAddress ?? null,
    liquidityUsd: Number(pair.liquidity?.usd ?? 0),
    asOf: new Date().toISOString(),
    source: "dexscreener",
  };
}

async function fetchDexscreener(url: string): Promise<DexPair[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "AccruedDesk/1.0 (+https://accrued.trade)",
      },
    });
    if (!response.ok) {
      console.warn("[dexscreener] non-200", url, response.status);
      return [];
    }
    const body = (await response.json()) as
      | DexPair[]
      | { pairs?: DexPair[] | null; pair?: DexPair | null };
    if (Array.isArray(body)) return body;
    if (body.pair && typeof body.pair === "object") return [body.pair];
    if (Array.isArray(body.pairs)) return body.pairs;
    return [];
  } catch (error) {
    console.error("[dexscreener] fetch failed", url, error);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

async function fetchWithRetries(url: string): Promise<DexPair[]> {
  for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt++) {
    const pairs = await fetchDexscreener(url);
    if (pairs.length > 0) return pairs;
    if (attempt < MAX_FETCH_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 250));
    }
  }
  return [];
}

async function fetchPairs(tokenAddress: string): Promise<DexPair[]> {
  const normalized = normalizeAddress(tokenAddress);
  const urls = [
    `${DEXSCREENER_BASE}/token-pairs/v1/${ROBINHOOD_CHAIN_SLUG}/${normalized}`,
    `${DEXSCREENER_BASE}/latest/dex/tokens/${normalized}`,
    `${DEXSCREENER_BASE}/latest/dex/pairs/${ROBINHOOD_CHAIN_SLUG}/${KNOWN_ACCR_PAIR}`,
  ];

  const merged = new Map<string, DexPair>();
  for (const url of urls) {
    const pairs = await fetchWithRetries(url);
    for (const pair of pairs) {
      const key = pair.pairAddress ?? JSON.stringify(pair);
      merged.set(key, pair);
    }
    if (merged.size > 0) break;
  }
  return [...merged.values()];
}

function envFallbackQuote(): AccrPriceQuote | null {
  const price = env.accrPriceUsd;
  if (price == null || !Number.isFinite(price) || price <= 0) return null;
  return {
    priceUsd: price,
    logoURI: ACCR_TOKEN_LOGO,
    pairAddress: KNOWN_ACCR_PAIR,
    liquidityUsd: 0,
    asOf: new Date().toISOString(),
    source: "env_fallback",
  };
}

function defaultFallbackQuote(): AccrPriceQuote {
  return {
    priceUsd: DEFAULT_ACCR_PRICE_USD,
    logoURI: ACCR_TOKEN_LOGO,
    pairAddress: KNOWN_ACCR_PAIR,
    liquidityUsd: 0,
    asOf: new Date().toISOString(),
    source: "default_fallback",
  };
}

function staleCacheQuote(): AccrPriceQuote | null {
  if (!cache) return null;
  return { ...cache.value, source: "stale_cache", asOf: new Date().toISOString() };
}

export class AccrPriceUnavailableError extends Error {
  readonly status = 503;
  constructor(message = "ACCR price unavailable — trading pair not listed yet.") {
    super(message);
    this.name = "AccrPriceUnavailableError";
  }
}

export function clearAccrPriceCacheForTest() {
  cache = null;
}

export async function getAccrPriceQuote(options?: {
  fresh?: boolean;
  tokenAddress?: string;
}): Promise<AccrPriceQuote> {
  const tokenAddress = options?.tokenAddress ?? ROBINHOOD_ACCR;

  if (!options?.fresh && cache && cache.expiresAt > Date.now()) {
    return cache.value;
  }

  const pairs = await fetchPairs(tokenAddress);
  const best = pickBestPair(pairs, tokenAddress);
  if (best) {
    const quote = quoteFromPair(best, tokenAddress);
    if (quote) {
      cache = { value: quote, expiresAt: Date.now() + CACHE_TTL_MS };
      return quote;
    }
  }

  const stale = staleCacheQuote();
  if (stale) {
    console.warn("[dexscreener] using stale cached ACCR price");
    return stale;
  }

  const envFallback = envFallbackQuote();
  if (envFallback) {
    cache = { value: envFallback, expiresAt: Date.now() + CACHE_TTL_MS };
    return envFallback;
  }

  const fallback = defaultFallbackQuote();
  console.warn("[dexscreener] using default ACCR price fallback", fallback.priceUsd);
  cache = { value: fallback, expiresAt: Date.now() + CACHE_TTL_MS };
  return fallback;
}
