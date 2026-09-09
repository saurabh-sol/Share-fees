import { ACCR_TOKEN_LOGO, ROBINHOOD_ACCR } from "@/lib/chains/robinhood";

const DEXSCREENER_BASE = "https://api.dexscreener.com";
const ROBINHOOD_CHAIN_SLUG = "robinhood";
const CACHE_TTL_MS = 45_000;

export type AccrPriceQuote = {
  priceUsd: number;
  logoURI: string;
  pairAddress: string | null;
  liquidityUsd: number;
  asOf: string;
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

function accrPriceFromPair(pair: DexPair, tokenAddress: string): number | null {
  const price = Number(pair.priceUsd);
  if (!Number.isFinite(price) || price <= 0) return null;

  const token = normalizeAddress(tokenAddress);
  const base = pair.baseToken?.address ? normalizeAddress(pair.baseToken.address) : "";
  const quote = pair.quoteToken?.address ? normalizeAddress(pair.quoteToken.address) : "";

  if (base === token) return price;
  if (quote === token) return 1 / price;
  return null;
}

function pickBestPair(pairs: DexPair[], tokenAddress: string): DexPair | null {
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

async function fetchPairs(tokenAddress: string): Promise<DexPair[]> {
  const primaryUrl = `${DEXSCREENER_BASE}/token-pairs/v1/${ROBINHOOD_CHAIN_SLUG}/${tokenAddress}`;
  const primary = await fetch(primaryUrl, { next: { revalidate: 0 } });
  if (primary.ok) {
    const body = (await primary.json()) as DexPair[] | { pairs?: DexPair[] };
    if (Array.isArray(body)) return body;
    if (Array.isArray(body.pairs)) return body.pairs;
  }

  const fallbackUrl = `${DEXSCREENER_BASE}/latest/dex/tokens/${tokenAddress}`;
  const fallback = await fetch(fallbackUrl, { next: { revalidate: 0 } });
  if (!fallback.ok) return [];
  const body = (await fallback.json()) as { pairs?: DexPair[] };
  return body.pairs ?? [];
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
  if (!best) {
    throw new AccrPriceUnavailableError();
  }

  const priceUsd = accrPriceFromPair(best, tokenAddress);
  if (priceUsd == null || priceUsd <= 0) {
    throw new AccrPriceUnavailableError();
  }

  const quote: AccrPriceQuote = {
    priceUsd,
    logoURI: best.info?.imageUrl ?? ACCR_TOKEN_LOGO,
    pairAddress: best.pairAddress ?? null,
    liquidityUsd: Number(best.liquidity?.usd ?? 0),
    asOf: new Date().toISOString(),
  };

  cache = { value: quote, expiresAt: Date.now() + CACHE_TTL_MS };
  return quote;
}
