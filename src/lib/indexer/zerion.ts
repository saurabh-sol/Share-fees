import { env } from "@/lib/env";
import { usdToCents } from "@/lib/lifi/notional";
import type { HistoricalCandidate, TradeSource } from "./types";

const ZERION_BASE = "https://api.zerion.io/v1";

const CHAIN_SLUGS = "ethereum,optimism,base,arbitrum,polygon,binance-smart-chain";

type ZerionTransfer = {
  direction?: string;
  quantity?: { numeric?: string };
  value?: number | null;
  fungible_info?: { symbol?: string };
};

type ZerionTx = {
  attributes?: {
    operation_type?: string;
    hash?: string;
    mined_at?: string;
    status?: string;
    transfers?: ZerionTransfer[];
  };
  relationships?: {
    chain?: { data?: { id?: string } };
  };
};

function notionalFromTransfers(transfers: ZerionTransfer[]): number {
  const outgoing = transfers
    .filter((item) => item.direction === "out" && typeof item.value === "number" && item.value > 0)
    .map((item) => item.value as number);
  if (outgoing.length === 0) return 0;
  return usdToCents(Math.max(...outgoing));
}

function tokensFromTransfers(transfers: ZerionTransfer[]) {
  const out = transfers.find((item) => item.direction === "out");
  const incoming = transfers.find((item) => item.direction === "in");
  return {
    fromToken: out?.fungible_info?.symbol ?? "unknown",
    toToken: incoming?.fungible_info?.symbol ?? "unknown",
    fromAmount: out?.quantity?.numeric ?? "0",
    toAmount: incoming?.quantity?.numeric ?? "0",
  };
}

export async function fetchZerionTrades(
  address: string,
  since: Date,
): Promise<HistoricalCandidate[]> {
  if (!env.zerionApiKey) return [];

  const found: HistoricalCandidate[] = [];
  let next: string | null = `${ZERION_BASE}/wallets/${address}/transactions/?currency=usd&page[size]=50&filter[operation_types]=trade&filter[trash]=only_non_trash&filter[chain_ids]=${CHAIN_SLUGS}&filter[min_mined_at]=${since.getTime()}`;
  const auth = `Basic ${Buffer.from(`${env.zerionApiKey}:`).toString("base64")}`;

  for (let page = 0; page < 3 && next; page += 1) {
    const response = await fetch(next, {
      headers: {
        accept: "application/json",
        authorization: auth,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      throw new Error(`zerion_${response.status}`);
    }
    const body = (await response.json()) as {
      data?: ZerionTx[];
      links?: { next?: string | null };
    };
    for (const item of body.data ?? []) {
      const attrs = item.attributes;
      if (!attrs?.hash || attrs.status !== "confirmed") continue;
      const transfers = attrs.transfers ?? [];
      const notionalUsdCents = notionalFromTransfers(transfers);
      const tokens = tokensFromTransfers(transfers);
      const chain = item.relationships?.chain?.data?.id ?? "ethereum";
      found.push({
        provider: "zerion",
        txHash: attrs.hash.toLowerCase(),
        fromChain: chain,
        toChain: chain,
        ...tokens,
        notionalUsdCents,
        executedAt: attrs.mined_at ? new Date(attrs.mined_at) : new Date(),
      });
    }
    next = body.links?.next ?? null;
  }

  return found;
}

export function zerionSource(): TradeSource | null {
  if (!env.zerionApiKey) return null;
  return { name: "zerion", fetchTrades: fetchZerionTrades };
}

export async function fetchZerionTradeByHash(
  address: string,
  txHash: string,
): Promise<HistoricalCandidate | null> {
  if (!env.zerionApiKey) return null;
  const auth = `Basic ${Buffer.from(`${env.zerionApiKey}:`).toString("base64")}`;
  const url = `${ZERION_BASE}/wallets/${address}/transactions/?currency=usd&page[size]=5&filter[search_query]=${txHash}`;
  const response = await fetch(url, {
    headers: { accept: "application/json", authorization: auth },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) return null;
  const body = (await response.json()) as { data?: ZerionTx[] };
  const match = (body.data ?? []).find(
    (item) => item.attributes?.hash?.toLowerCase() === txHash.toLowerCase(),
  );
  if (!match?.attributes?.hash) return null;
  const transfers = match.attributes.transfers ?? [];
  return {
    provider: "zerion",
    txHash: match.attributes.hash.toLowerCase(),
    fromChain: match.relationships?.chain?.data?.id ?? "ethereum",
    toChain: match.relationships?.chain?.data?.id ?? "ethereum",
    ...tokensFromTransfers(transfers),
    notionalUsdCents: notionalFromTransfers(transfers),
    executedAt: match.attributes.mined_at ? new Date(match.attributes.mined_at) : new Date(),
  };
}
