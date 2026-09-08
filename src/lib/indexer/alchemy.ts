import { env } from "@/lib/env";
import { usdToCents } from "@/lib/lifi/notional";
import type { ActivityKind, HistoricalCandidate, TradeSource } from "./types";

/**
 * Alchemy chain-slug mapping for the Transfers API.
 * Only chains with `alchemy_getAssetTransfers` support are listed.
 */
const ALCHEMY_CHAINS: Record<number, string> = {
  1: "eth-mainnet",
  10: "opt-mainnet",
  137: "polygon-mainnet",
  42161: "arb-mainnet",
  8453: "base-mainnet",
  4663: "robinhood-mainnet",
};

/** Reverse map: Alchemy slug → chainId */
const SLUG_TO_CHAIN_ID: Record<string, number> = Object.fromEntries(
  Object.entries(ALCHEMY_CHAINS).map(([id, slug]) => [slug, Number(id)]),
);

/** Canonical chain name strings used elsewhere in the codebase */
const CHAIN_ID_TO_NAME: Record<number, string> = {
  1: "ethereum",
  10: "optimism",
  137: "polygon",
  42161: "arbitrum",
  8453: "base",
  4663: "robinhood",
};

/** Rough USD price for native/major tokens (used to estimate notional) */
const ROUGH_PRICES: Record<string, number> = {
  ETH: 2500,
  WETH: 2500,
  USDC: 1,
  "USDC.e": 1,
  USDT: 1,
  DAI: 1,
  USDG: 1,
  WBTC: 65000,
  MATIC: 0.5,
  POL: 0.5,
  OP: 1.5,
};

const CATEGORIES = ["external", "erc20"] as const;

type AlchemyTransfer = {
  blockNum: string;
  uniqueId: string;
  hash: string;
  from: string;
  to: string | null;
  value: number | null;
  asset: string | null;
  category: string;
  rawContract: {
    value: string | null;
    address: string | null;
    decimal: string | null;
  };
  metadata?: {
    blockTimestamp?: string;
  };
};

type AlchemyResponse = {
  jsonrpc: string;
  id: number;
  result?: {
    transfers: AlchemyTransfer[];
    pageKey?: string;
  };
  error?: { code: number; message: string };
};

function alchemyUrl(chainSlug: string): string {
  return `https://${chainSlug}.g.alchemy.com/v2/${env.alchemyApiKey}`;
}

async function fetchTransfers(
  chainSlug: string,
  params: Record<string, unknown>,
): Promise<AlchemyTransfer[]> {
  const url = alchemyUrl(chainSlug);
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "alchemy_getAssetTransfers",
      params: [
        {
          ...params,
          excludeZeroValue: true,
          withMetadata: true,
          category: [...CATEGORIES],
          order: "desc",
          maxCount: "0x3e8",
        },
      ],
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`alchemy_${response.status}`);
  }

  const body = (await response.json()) as AlchemyResponse;
  if (body.error) {
    throw new Error(`alchemy_rpc_${body.error.code}`);
  }

  return body.result?.transfers ?? [];
}

function estimateUsdCents(asset: string | null, value: number | null): number {
  if (value == null || value <= 0 || !asset) return 0;
  const symbol = asset.toUpperCase();
  const price = ROUGH_PRICES[symbol] ?? ROUGH_PRICES[asset] ?? 0;
  if (price === 0) return 0;
  try {
    return usdToCents(value * price);
  } catch {
    return 0;
  }
}

type SwapPair = {
  hash: string;
  chainName: string;
  outgoing: AlchemyTransfer | null;
  incoming: AlchemyTransfer | null;
  timestamp: Date;
};

function detectSwaps(
  outbound: AlchemyTransfer[],
  inbound: AlchemyTransfer[],
  chainName: string,
  since: Date,
): SwapPair[] {
  const byHash = new Map<string, { out: AlchemyTransfer[]; in: AlchemyTransfer[] }>();

  for (const t of outbound) {
    const h = t.hash.toLowerCase();
    const entry = byHash.get(h) ?? { out: [], in: [] };
    entry.out.push(t);
    byHash.set(h, entry);
  }

  for (const t of inbound) {
    const h = t.hash.toLowerCase();
    const entry = byHash.get(h) ?? { out: [], in: [] };
    entry.in.push(t);
    byHash.set(h, entry);
  }

  const swaps: SwapPair[] = [];

  for (const [hash, { out, in: inc }] of byHash.entries()) {
    if (out.length === 0 || inc.length === 0) continue;

    const primary = out[0];
    const secondary = inc[0];

    const ts = primary.metadata?.blockTimestamp
      ? new Date(primary.metadata.blockTimestamp)
      : new Date();

    if (ts < since) continue;

    swaps.push({
      hash,
      chainName,
      outgoing: primary,
      incoming: secondary,
      timestamp: ts,
    });
  }

  return swaps;
}

function swapToCandidate(pair: SwapPair): HistoricalCandidate {
  const fromAsset = pair.outgoing?.asset ?? "unknown";
  const toAsset = pair.incoming?.asset ?? "unknown";
  const fromValue = pair.outgoing?.value ?? 0;
  const toValue = pair.incoming?.value ?? 0;

  const outUsd = estimateUsdCents(fromAsset, fromValue);
  const inUsd = estimateUsdCents(toAsset, toValue);
  const notionalUsdCents = Math.max(outUsd, inUsd);

  return {
    provider: "alchemy",
    txHash: pair.hash,
    fromChain: pair.chainName,
    toChain: pair.chainName,
    fromToken: fromAsset ?? "unknown",
    toToken: toAsset ?? "unknown",
    fromAmount: fromValue?.toString() ?? "0",
    toAmount: toValue?.toString() ?? "0",
    notionalUsdCents,
    kind: "trade" as ActivityKind,
    executedAt: pair.timestamp,
  };
}

async function fetchChainSwaps(
  chainId: number,
  address: string,
  since: Date,
): Promise<HistoricalCandidate[]> {
  const slug = ALCHEMY_CHAINS[chainId];
  if (!slug) return [];
  const chainName = CHAIN_ID_TO_NAME[chainId] ?? `chain-${chainId}`;

  const [outbound, inbound] = await Promise.all([
    fetchTransfers(slug, { fromBlock: "0x0", fromAddress: address }),
    fetchTransfers(slug, { fromBlock: "0x0", toAddress: address }),
  ]);

  const pairs = detectSwaps(outbound, inbound, chainName, since);
  return pairs.map(swapToCandidate);
}

export async function fetchAlchemyTrades(
  address: string,
  since: Date,
): Promise<HistoricalCandidate[]> {
  if (!env.alchemyApiKey) return [];

  const chainIds = Object.keys(ALCHEMY_CHAINS).map(Number);

  const results = await Promise.allSettled(
    chainIds.map((chainId) => fetchChainSwaps(chainId, address, since)),
  );

  const candidates: HistoricalCandidate[] = [];

  for (const result of results) {
    if (result.status === "fulfilled") {
      candidates.push(...result.value);
    }
  }

  return candidates;
}

export function alchemySource(): TradeSource | null {
  if (!env.alchemyApiKey) return null;
  return { name: "alchemy", fetchTrades: fetchAlchemyTrades };
}

export async function fetchAlchemyTradeByHash(
  address: string,
  txHash: string,
): Promise<HistoricalCandidate | null> {
  if (!env.alchemyApiKey) return null;

  for (const [chainIdStr, slug] of Object.entries(ALCHEMY_CHAINS)) {
    const chainId = Number(chainIdStr);
    const chainName = CHAIN_ID_TO_NAME[chainId] ?? `chain-${chainId}`;

    try {
      const [outbound, inbound] = await Promise.all([
        fetchTransfers(slug, { fromBlock: "0x0", fromAddress: address }),
        fetchTransfers(slug, { fromBlock: "0x0", toAddress: address }),
      ]);

      const matchOut = outbound.filter((t) => t.hash.toLowerCase() === txHash.toLowerCase());
      const matchIn = inbound.filter((t) => t.hash.toLowerCase() === txHash.toLowerCase());

      if (matchOut.length === 0 && matchIn.length === 0) continue;

      const pairs = detectSwaps(matchOut, matchIn, chainName, new Date(0));
      if (pairs.length > 0) return swapToCandidate(pairs[0]);

      const single = matchOut[0] ?? matchIn[0];
      if (!single) continue;

      const ts = single.metadata?.blockTimestamp
        ? new Date(single.metadata.blockTimestamp)
        : new Date();

      return {
        provider: "alchemy",
        txHash: txHash.toLowerCase(),
        fromChain: chainName,
        toChain: chainName,
        fromToken: single.asset ?? "unknown",
        toToken: single.asset ?? "unknown",
        fromAmount: single.value?.toString() ?? "0",
        toAmount: single.value?.toString() ?? "0",
        notionalUsdCents: estimateUsdCents(single.asset, single.value),
        kind: "trade",
        executedAt: ts,
      };
    } catch {
      continue;
    }
  }

  return null;
}
