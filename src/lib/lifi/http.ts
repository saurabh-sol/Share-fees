import { env } from "@/lib/env";
import { NATIVE_TOKEN, ROBINHOOD_CHAIN_ID, robinhoodChain } from "@/lib/chains/robinhood";
import { LIFI_INTEGRATOR, isAllowedChainId, type AllowedChainId } from "./constants";

const LIFI_BASE = "https://li.quest/v1";

export { LIFI_INTEGRATOR, isAllowedChainId, type AllowedChainId };

type CacheEntry<T> = { value: T; expiresAt: number };
const cache = new Map<string, CacheEntry<unknown>>();

function readCache<T>(key: string): T | null {
  const hit = cache.get(key);
  if (!hit || hit.expiresAt <= Date.now()) return null;
  return hit.value as T;
}

function writeCache<T>(key: string, value: T, ttlMs: number) {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

async function lifiGet<T>(path: string, params: Record<string, string>, ttlMs = 0): Promise<T> {
  const url = new URL(`${LIFI_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  const cacheKey = url.toString();
  if (ttlMs > 0) {
    const cached = readCache<T>(cacheKey);
    if (cached) return cached;
  }

  const headers: Record<string, string> = { accept: "application/json" };
  if (env.lifiApiKey) {
    headers["x-lifi-api-key"] = env.lifiApiKey;
  }

  const response = await fetch(url, {
    headers,
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`lifi_${response.status}:${body.slice(0, 180)}`);
  }
  const data = (await response.json()) as T;
  if (ttlMs > 0) writeCache(cacheKey, data, ttlMs);
  return data;
}

export type LifiChain = {
  id: number;
  name: string;
  key: string;
  nativeToken?: { symbol: string; decimals: number; address: string };
};

export type LifiToken = {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  chainId: number;
  priceUSD?: string;
  logoURI?: string;
};

function normalizeToken(token: LifiToken & { logo?: string; logoUri?: string }): LifiToken {
  return {
    address: token.address,
    symbol: token.symbol,
    name: token.name,
    decimals: token.decimals,
    chainId: token.chainId,
    priceUSD: token.priceUSD,
    logoURI: token.logoURI ?? token.logoUri ?? token.logo,
  };
}

export type LifiQuote = {
  id?: string;
  tool?: string;
  action: {
    fromChainId: number;
    toChainId: number;
    fromToken: LifiToken;
    toToken: LifiToken;
    fromAmount: string;
    fromAddress?: string;
    toAddress?: string;
  };
  estimate: {
    fromAmount: string;
    toAmount: string;
    toAmountMin?: string;
    fromAmountUSD?: string;
    toAmountUSD?: string;
  };
  transactionRequest?: unknown;
};

export type LifiStatus = {
  status: "NOT_FOUND" | "PENDING" | "DONE" | "FAILED" | string;
  substatus?: string;
  fromAddress?: string;
  toAddress?: string;
  tool?: string;
  sending?: {
    txHash?: string;
    amount?: string;
    amountUSD?: string;
    token?: { symbol?: string; address?: string; chainId?: number };
  };
  receiving?: {
    txHash?: string;
    amount?: string;
    amountUSD?: string;
    token?: { symbol?: string; address?: string; chainId?: number };
  };
};

export async function fetchLifiChains() {
  const data = await lifiGet<{ chains: LifiChain[] }>(
    "/chains",
    { chainTypes: "EVM" },
    10 * 60 * 1000,
  );
  const listed = data.chains.filter((chain) => isAllowedChainId(chain.id));
  return [
    ...listed,
    {
      id: ROBINHOOD_CHAIN_ID,
      name: robinhoodChain.name,
      key: "hood",
      nativeToken: { symbol: "ETH", decimals: 18, address: NATIVE_TOKEN },
    },
  ];
}

export async function fetchLifiTokens(chainId: AllowedChainId) {
  const data = await lifiGet<{ tokens: Record<string, LifiToken[]> }>(
    "/tokens",
    { chains: String(chainId) },
    10 * 60 * 1000,
  );
  return (data.tokens[String(chainId)] ?? []).map(normalizeToken);
}

export async function fetchLifiQuote(input: {
  fromChainId: number;
  toChainId: number;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  fromAddress: string;
}): Promise<LifiQuote> {
  return lifiGet<LifiQuote>("/quote", {
    fromChain: String(input.fromChainId),
    toChain: String(input.toChainId),
    fromToken: input.fromToken,
    toToken: input.toToken,
    fromAmount: input.fromAmount,
    fromAddress: input.fromAddress,
    integrator: LIFI_INTEGRATOR,
  });
}

export async function fetchLifiStatus(input: {
  txHash: string;
  fromChain?: string;
  toChain?: string;
}): Promise<LifiStatus> {
  return lifiGet<LifiStatus>("/status", {
    txHash: input.txHash,
    fromChain: input.fromChain ?? "",
    toChain: input.toChain ?? "",
  });
}
