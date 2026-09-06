import { env } from "@/lib/env";
import { usdToCents } from "@/lib/lifi/notional";
import type { ActivityKind, HistoricalCandidate, TradeSource } from "./types";

const ZERION_BASE = "https://api.zerion.io/v1";

const ZERION_PAGE_SIZE = 50;
const ZERION_MAX_PAGES = 10;

function zerionAuthHeader() {
  const raw = `${env.zerionApiKey}:`;
  const encoded =
    typeof Buffer !== "undefined"
      ? Buffer.from(raw).toString("base64")
      : btoa(raw);
  return `Basic ${encoded}`;
}

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

export function normalizeActivityKind(raw: string | undefined): ActivityKind {
  const value = (raw ?? "").toLowerCase();
  if (value === "swap" || value === "trade") {
    return "trade";
  }
  if (
    value === "execute" ||
    value === "send" ||
    value === "receive" ||
    value === "deposit" ||
    value === "withdraw" ||
    value === "approve"
  ) {
    return value;
  }
  return "other";
}

function notionalFromTransfers(transfers: ZerionTransfer[]): number {
  const valued = transfers
    .filter((item) => typeof item.value === "number" && item.value > 0)
    .map((item) => item.value as number);
  if (valued.length === 0) return 0;
  try {
    return usdToCents(Math.max(...valued));
  } catch {
    return 0;
  }
}

function tokensFromTransfers(transfers: ZerionTransfer[]) {
  const out = transfers.find((item) => item.direction === "out");
  const incoming = transfers.find((item) => item.direction === "in");
  return {
    fromToken: out?.fungible_info?.symbol ?? incoming?.fungible_info?.symbol ?? "unknown",
    toToken: incoming?.fungible_info?.symbol ?? out?.fungible_info?.symbol ?? "unknown",
    fromAmount: out?.quantity?.numeric ?? incoming?.quantity?.numeric ?? "0",
    toAmount: incoming?.quantity?.numeric ?? out?.quantity?.numeric ?? "0",
  };
}

function candidateFromZerion(item: ZerionTx): HistoricalCandidate | null {
  const attrs = item.attributes;
  if (!attrs?.hash || attrs.status !== "confirmed") return null;
  const transfers = attrs.transfers ?? [];
  const chain = item.relationships?.chain?.data?.id ?? "ethereum";
  return {
    provider: "zerion",
    txHash: attrs.hash.toLowerCase(),
    fromChain: chain,
    toChain: chain,
    ...tokensFromTransfers(transfers),
    notionalUsdCents: notionalFromTransfers(transfers),
    kind: normalizeActivityKind(attrs.operation_type),
    executedAt: attrs.mined_at ? new Date(attrs.mined_at) : new Date(),
  };
}

export async function fetchZerionTrades(
  address: string,
  since: Date,
): Promise<HistoricalCandidate[]> {
  if (!env.zerionApiKey) return [];

  const found: HistoricalCandidate[] = [];
  let next: string | null =
    `${ZERION_BASE}/wallets/${address}/transactions/?currency=usd&page[size]=${ZERION_PAGE_SIZE}&filter[trash]=only_non_trash&filter[min_mined_at]=${since.getTime()}`;
  const auth = zerionAuthHeader();

  for (let page = 0; page < ZERION_MAX_PAGES && next; page += 1) {
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
      const row = candidateFromZerion(item);
      if (row) found.push(row);
    }
    const linked = body.links?.next ?? null;
    next = !linked
      ? null
      : linked.startsWith("http")
        ? linked
        : new URL(linked, `${ZERION_BASE}/`).toString();
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
  const auth = zerionAuthHeader();
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
  if (!match) return null;
  return candidateFromZerion(match);
}
