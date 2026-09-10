/**
 * Direct Robinhood Chain RPC scanner — no API key required.
 *
 * Alchemy and Zerion do NOT index Robinhood Chain (4663), so wallet scans
 * were blind to every trade made there. This source reads ERC-20 Transfer
 * logs straight from the public RPC and reconstructs the wallet's activity
 * for the scan window (90 days), including Uniswap trades through the
 * Universal Router.
 */
import { createPublicClient, formatUnits, http, parseAbiItem, type Address } from "viem";
import {
  robinhoodChain,
  ROBINHOOD_CHAIN_ID,
  ROBINHOOD_USDG,
  ROBINHOOD_USDT,
  ROBINHOOD_WETH,
} from "@/lib/chains/robinhood";
import { resolveErc20 } from "@/lib/chains/resolve-token";
import { stableSymbolNotionalCents } from "@/lib/indexer/notional-display";
import { ACCRUED_SWAP_ROUTER, UNIVERSAL_ROUTER, V3_SWAP_ROUTER_02 } from "@/lib/uniswap/constants";
import type { ActivityKind, HistoricalCandidate, TradeSource } from "./types";

const TRANSFER_EVENT = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)",
);

/** fromChain string that matches in-app settle records — keeps dedup intact. */
const CHAIN_KEY = String(ROBINHOOD_CHAIN_ID);

/** Cap how many rows a single scan can produce. Newest first. */
const MAX_CANDIDATES = 500;
/** Per-direction raw log cap so a hyperactive wallet can't blow up the scan. */
const MAX_RAW_LOGS = 4000;

/** Contracts that execute Uniswap swaps on Robinhood Chain. */
/** Accrued-attributed routers only (analytics use AccruedSwap events). */
const DEX_ROUTERS = new Set(
  [ACCRUED_SWAP_ROUTER[ROBINHOOD_CHAIN_ID], UNIVERSAL_ROUTER[ROBINHOOD_CHAIN_ID]]
    .filter(Boolean)
    .map((addr) => addr!.toLowerCase()),
);

const client = createPublicClient({
  chain: robinhoodChain,
  transport: http(undefined, {
    timeout: 30_000,
    batch: { batchSize: 100, wait: 25 },
  }),
});

/* ─── Token metadata cache (symbol + decimals) ─── */
const tokenCache = new Map<string, { symbol: string; decimals: number } | null>();

async function tokenMeta(address: string) {
  const key = address.toLowerCase();
  const cached = tokenCache.get(key);
  if (cached !== undefined) return cached;
  const resolved = await resolveErc20(address).catch(() => null);
  const meta = resolved ? { symbol: resolved.symbol, decimals: resolved.decimals } : null;
  tokenCache.set(key, meta);
  return meta;
}

/* ─── ETH → USD price (CoinGecko, 5-min cache, graceful fallback) ─── */
let ethPriceCache: { cents: number; at: number } | null = null;

async function ethUsdCents(): Promise<number> {
  if (ethPriceCache && Date.now() - ethPriceCache.at < 5 * 60 * 1000) {
    return ethPriceCache.cents;
  }
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
      { cache: "no-store", signal: AbortSignal.timeout(8_000) },
    );
    if (res.ok) {
      const body = (await res.json()) as { ethereum?: { usd?: number } };
      const usd = body.ethereum?.usd;
      if (usd && usd > 0) {
        ethPriceCache = { cents: Math.round(usd * 100), at: Date.now() };
        return ethPriceCache.cents;
      }
    }
  } catch {
    /* fall through to cache/fallback */
  }
  return ethPriceCache?.cents ?? 250_000;
}

type RawTransfer = {
  txHash: `0x${string}`;
  blockNumber: bigint;
  token: `0x${string}`;
  value: bigint;
  direction: "out" | "in";
};

/**
 * Fetch Transfer logs where the wallet is sender or recipient.
 * Tries the full chain first (fast for normal wallets), then narrows the
 * block range if the node rejects the query.
 */
async function fetchTransferLogs(
  user: Address,
  direction: "out" | "in",
): Promise<RawTransfer[]> {
  const latest = await client.getBlockNumber();
  // Full history first (fast for normal wallets — the node filters by topic).
  // Progressively narrower windows for hyperactive addresses where the node
  // times out or hits its 10k-log result cap.
  const startBlocks: bigint[] = [
    0n,
    latest > 40_000_000n ? latest - 40_000_000n : 0n,
    latest > 15_000_000n ? latest - 15_000_000n : 0n,
    latest > 5_000_000n ? latest - 5_000_000n : 0n,
    latest > 1_000_000n ? latest - 1_000_000n : 0n,
  ];

  let lastError: unknown = null;
  for (const fromBlock of startBlocks) {
    try {
      const logs = await client.getLogs({
        event: TRANSFER_EVENT,
        args: direction === "out" ? { from: user } : { to: user },
        fromBlock,
        toBlock: "latest",
        strict: false,
      });
      return logs
        .filter((log) => typeof log.args.value === "bigint")
        .slice(-MAX_RAW_LOGS)
        .map((log) => ({
          txHash: log.transactionHash,
          blockNumber: log.blockNumber,
          token: log.address.toLowerCase() as `0x${string}`,
          value: log.args.value as bigint,
          direction,
        }));
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("robinhood_getlogs_failed");
}

type TxGroup = {
  txHash: `0x${string}`;
  blockNumber: bigint;
  out: RawTransfer[];
  in: RawTransfer[];
};

function groupByTx(transfers: RawTransfer[]): TxGroup[] {
  const map = new Map<string, TxGroup>();
  for (const t of transfers) {
    const key = t.txHash.toLowerCase();
    let group = map.get(key);
    if (!group) {
      group = { txHash: t.txHash, blockNumber: t.blockNumber, out: [], in: [] };
      map.set(key, group);
    }
    if (t.direction === "out") group.out.push(t);
    else group.in.push(t);
  }
  // Newest first.
  return [...map.values()].sort((a, b) => (a.blockNumber > b.blockNumber ? -1 : 1));
}

function largest(transfers: RawTransfer[]): RawTransfer | null {
  return transfers.reduce<RawTransfer | null>(
    (best, t) => (!best || t.value > best.value ? t : best),
    null,
  );
}

/** USD cents per 1 whole token. Only positive prices are cached. */
const tokenUsdCentsCache = new Map<string, number>();

const STABLE_ADDRESSES = new Set([
  ROBINHOOD_USDG.toLowerCase(),
  ROBINHOOD_USDT.toLowerCase(),
]);

type QuoteTarget = {
  address: `0x${string}`;
  decimals: number;
  kind: "stable" | "weth";
};

const QUOTE_TARGETS: QuoteTarget[] = [
  { address: ROBINHOOD_USDT.toLowerCase() as `0x${string}`, decimals: 6, kind: "stable" },
  { address: ROBINHOOD_USDG.toLowerCase() as `0x${string}`, decimals: 6, kind: "stable" },
  { address: ROBINHOOD_WETH.toLowerCase() as `0x${string}`, decimals: 18, kind: "weth" },
];

import { inferDisplayNotionalCents } from "@/lib/indexer/notional-display";

async function usdCentsPerWholeToken(token: `0x${string}`, decimals: number): Promise<number> {
  const key = token.toLowerCase();
  if (STABLE_ADDRESSES.has(key)) return 100;
  if (key === ROBINHOOD_WETH.toLowerCase()) return ethUsdCents();

  const cached = tokenUsdCentsCache.get(key);
  if (cached !== undefined) return cached;

  const { quoteUniswap } = await import("@/lib/uniswap/quote");
  const unitIn = 10n ** BigInt(decimals);

  for (const target of QUOTE_TARGETS) {
    if (key === target.address.toLowerCase()) continue;
    try {
      const quoted = await quoteUniswap({
        chainId: ROBINHOOD_CHAIN_ID,
        fromToken: token,
        toToken: target.address,
        fromAmount: unitIn.toString(),
      });
      let perUnit: number;
      if (target.kind === "weth") {
        const wethHuman = Number(formatUnits(quoted.amountOut, 18));
        perUnit = Math.round(wethHuman * (await ethUsdCents()));
      } else {
        perUnit = Math.round(Number(formatUnits(quoted.amountOut, target.decimals)) * 100);
      }
      if (perUnit > 0) {
        tokenUsdCentsCache.set(key, perUnit);
        return perUnit;
      }
    } catch {
      /* try next quote target */
    }
  }

  // Reverse: $1 stable → token, then invert to USD per whole token.
  for (const target of QUOTE_TARGETS.filter((t) => t.kind === "stable")) {
    if (key === target.address.toLowerCase()) continue;
    try {
      const oneStable = 10n ** BigInt(target.decimals);
      const quoted = await quoteUniswap({
        chainId: ROBINHOOD_CHAIN_ID,
        fromToken: target.address,
        toToken: token,
        fromAmount: oneStable.toString(),
      });
      const tokensOut = Number(formatUnits(quoted.amountOut, decimals));
      if (tokensOut > 0) {
        const perUnit = Math.round(100 / tokensOut);
        if (perUnit > 0) {
          tokenUsdCentsCache.set(key, perUnit);
          return perUnit;
        }
      }
    } catch {
      /* try next stable */
    }
  }

  return 0;
}

/** USD notional in cents. Stables and WETH first; else live Uniswap quote (USDT → USDG → WETH). */
async function sideUsdCents(
  token: `0x${string}` | null,
  value: bigint,
  decimals: number,
): Promise<number> {
  if (!token || value <= 0n) return 0;
  const human = Number(formatUnits(value, decimals));
  if (!Number.isFinite(human) || human <= 0) return 0;

  const perUnit = await usdCentsPerWholeToken(token, decimals);
  if (perUnit > 0) return Math.round(human * perUnit);
  return 0;
}

export async function fetchRobinhoodTrades(
  address: string,
  since: Date,
): Promise<HistoricalCandidate[]> {
  const user = address as Address;

  // Sequential to stay under the public RPC's rate limit.
  const outLogs = await fetchTransferLogs(user, "out");
  const inLogs = await fetchTransferLogs(user, "in");

  const groups = groupByTx([...outLogs, ...inLogs]).slice(0, MAX_CANDIDATES);
  if (groups.length === 0) return [];

  // Resolve block timestamps in small sequential chunks so the public RPC
  // doesn't rate-limit us, with one retry pass for stragglers.
  const uniqueBlocks = [...new Set(groups.map((g) => g.blockNumber))];
  const blockTimes = new Map<bigint, Date>();

  async function fetchBlockTimes(blocks: bigint[]) {
    const failed: bigint[] = [];
    const CHUNK = 20;
    for (let i = 0; i < blocks.length; i += CHUNK) {
      const chunk = blocks.slice(i, i + CHUNK);
      const results = await Promise.allSettled(
        chunk.map((n) => client.getBlock({ blockNumber: n })),
      );
      results.forEach((result, idx) => {
        if (result.status === "fulfilled") {
          blockTimes.set(result.value.number, new Date(Number(result.value.timestamp) * 1000));
        } else {
          failed.push(chunk[idx]);
        }
      });
      if (i + CHUNK < blocks.length) {
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
    }
    return failed;
  }

  const failedBlocks = await fetchBlockTimes(uniqueBlocks);
  if (failedBlocks.length > 0) {
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    await fetchBlockTimes(failedBlocks);
  }

  // Interpolation fallback for blocks the RPC never answered: estimate the
  // timestamp from the two nearest known anchors (block times are ~uniform).
  const anchors = [...blockTimes.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  function estimateTime(blockNumber: bigint): Date | null {
    if (anchors.length === 0) return null;
    if (anchors.length === 1) return anchors[0][1];
    let lower = anchors[0];
    let upper = anchors[anchors.length - 1];
    for (const anchor of anchors) {
      if (anchor[0] <= blockNumber) lower = anchor;
      if (anchor[0] >= blockNumber) {
        upper = anchor;
        break;
      }
    }
    if (upper[0] === lower[0]) return lower[1];
    const ratio =
      Number(blockNumber - lower[0]) / Number(upper[0] - lower[0]);
    return new Date(
      lower[1].getTime() + ratio * (upper[1].getTime() - lower[1].getTime()),
    );
  }

  // Look up every single-sided tx so ETH ↔ token swaps via Universal Router
  // *or* SwapRouter02 are classified as trades (native ETH has no Transfer log).
  const singleSided = groups.filter((g) => g.out.length === 0 || g.in.length === 0);
  const txInfo = new Map<string, { to: string | null; value: bigint }>();
  const TX_CHUNK = 20;
  for (let i = 0; i < singleSided.length; i += TX_CHUNK) {
    const chunk = singleSided.slice(i, i + TX_CHUNK);
    const txResults = await Promise.allSettled(
      chunk.map((g) => client.getTransaction({ hash: g.txHash })),
    );
    for (const result of txResults) {
      if (result.status === "fulfilled") {
        txInfo.set(result.value.hash.toLowerCase(), {
          to: result.value.to?.toLowerCase() ?? null,
          value: result.value.value,
        });
      }
    }
    if (i + TX_CHUNK < singleSided.length) {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }

  const candidates: HistoricalCandidate[] = [];

  for (const group of groups) {
    const executedAt = blockTimes.get(group.blockNumber) ?? estimateTime(group.blockNumber);
    if (!executedAt || executedAt < since) continue;

    const outT = largest(group.out);
    const inT = largest(group.in);
    const tx = txInfo.get(group.txHash.toLowerCase());
    const viaRouter = Boolean(tx?.to && DEX_ROUTERS.has(tx.to));
    const ethInValue = viaRouter && tx && tx.value > 0n ? tx.value : 0n;

    const outMeta = outT ? await tokenMeta(outT.token) : null;
    const inMeta = inT ? await tokenMeta(inT.token) : null;
    // Skip pure-NFT rows (unresolvable as ERC-20 on both sides).
    if (outT && !outMeta && inT && !inMeta) continue;
    if (outT && !outMeta && !inT) continue;
    if (inT && !inMeta && !outT) continue;

    const outDecimals = outMeta?.decimals ?? 18;
    const inDecimals = inMeta?.decimals ?? 18;

    let kind: ActivityKind;
    let fromToken: string;
    let toToken: string;
    let fromAmount: string;
    let toAmount: string;

    if (outT && inT) {
      kind = "trade";
      fromToken = outMeta?.symbol ?? "TOKEN";
      toToken = inMeta?.symbol ?? "TOKEN";
      fromAmount = formatUnits(outT.value, outDecimals);
      toAmount = formatUnits(inT.value, inDecimals);
    } else if (inT && ethInValue > 0n) {
      // ETH → token swap through the Universal Router.
      kind = "trade";
      fromToken = "ETH";
      toToken = inMeta?.symbol ?? "TOKEN";
      fromAmount = formatUnits(ethInValue, 18);
      toAmount = formatUnits(inT.value, inDecimals);
    } else if (outT && viaRouter) {
      // token → ETH swap (unwrap output isn't visible in Transfer topics).
      kind = "trade";
      fromToken = outMeta?.symbol ?? "TOKEN";
      toToken = "ETH";
      fromAmount = formatUnits(outT.value, outDecimals);
      toAmount = "0";
    } else if (outT) {
      kind = "send";
      fromToken = outMeta?.symbol ?? "TOKEN";
      toToken = fromToken;
      fromAmount = formatUnits(outT.value, outDecimals);
      toAmount = fromAmount;
    } else if (inT) {
      kind = "receive";
      fromToken = inMeta?.symbol ?? "TOKEN";
      toToken = fromToken;
      fromAmount = formatUnits(inT.value, inDecimals);
      toAmount = fromAmount;
    } else {
      continue;
    }

    // Notional: prefer the priceable side (USDG/USDT 1:1, WETH × ETH price,
    // native ETH value × ETH price). Fall back to parsed stable/ETH amounts.
    const ethPrice = await ethUsdCents();
    const outUsd = outT ? await sideUsdCents(outT.token, outT.value, outDecimals) : 0;
    const inUsd = inT ? await sideUsdCents(inT.token, inT.value, inDecimals) : 0;
    const ethUsd =
      ethInValue > 0n
        ? Math.round(Number(formatUnits(ethInValue, 18)) * ethPrice)
        : 0;
    let notionalUsdCents = Math.max(outUsd, inUsd, ethUsd);
    if (notionalUsdCents === 0) {
      notionalUsdCents = Math.max(
        stableSymbolNotionalCents(fromToken, fromAmount, ethPrice),
        stableSymbolNotionalCents(toToken, toAmount, ethPrice),
      );
    }

    candidates.push({
      provider: "robinhood",
      txHash: group.txHash.toLowerCase(),
      fromChain: CHAIN_KEY,
      toChain: CHAIN_KEY,
      fromToken,
      toToken,
      fromAmount,
      toAmount,
      notionalUsdCents,
      kind,
      executedAt,
    });
  }

  return candidates;
}

export function robinhoodRpcSource(): TradeSource {
  return { name: "robinhood", fetchTrades: fetchRobinhoodTrades };
}

/**
 * Re-verify a single Robinhood Chain tx from its receipt.
 * Used by the individual claim flow — Alchemy/Zerion can't verify chain 4663.
 */
export async function fetchRobinhoodTradeByHash(
  address: string,
  txHash: string,
): Promise<HistoricalCandidate | null> {
  try {
    const receipt = await client.getTransactionReceipt({ hash: txHash as `0x${string}` });
    if (!receipt || receipt.status !== "success") return null;

    const user = address.toLowerCase();
    const transferTopic =
      "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

    const transfers: RawTransfer[] = [];
    for (const log of receipt.logs) {
      if (log.topics[0] !== transferTopic || log.topics.length < 3) continue;
      const from = `0x${(log.topics[1] ?? "").slice(26)}`.toLowerCase();
      const to = `0x${(log.topics[2] ?? "").slice(26)}`.toLowerCase();
      let value = 0n;
      try {
        value = BigInt(log.data === "0x" ? 0 : log.data);
      } catch {
        continue;
      }
      if (from === user) {
        transfers.push({
          txHash: receipt.transactionHash,
          blockNumber: receipt.blockNumber,
          token: log.address.toLowerCase() as `0x${string}`,
          value,
          direction: "out",
        });
      } else if (to === user) {
        transfers.push({
          txHash: receipt.transactionHash,
          blockNumber: receipt.blockNumber,
          token: log.address.toLowerCase() as `0x${string}`,
          value,
          direction: "in",
        });
      }
    }
    if (transfers.length === 0) return null;

    const [tx, block] = await Promise.all([
      client.getTransaction({ hash: txHash as `0x${string}` }),
      client.getBlock({ blockNumber: receipt.blockNumber }),
    ]);

    const outT = largest(transfers.filter((t) => t.direction === "out"));
    const inT = largest(transfers.filter((t) => t.direction === "in"));
    const outMeta = outT ? await tokenMeta(outT.token) : null;
    const inMeta = inT ? await tokenMeta(inT.token) : null;
    const outDecimals = outMeta?.decimals ?? 18;
    const inDecimals = inMeta?.decimals ?? 18;

    const ethPrice = await ethUsdCents();
    const outUsd = outT ? await sideUsdCents(outT.token, outT.value, outDecimals) : 0;
    const inUsd = inT ? await sideUsdCents(inT.token, inT.value, inDecimals) : 0;
    const ethUsd =
      tx.value > 0n
        ? Math.round(Number(formatUnits(tx.value, 18)) * ethPrice)
        : 0;
    const fromToken = outT ? (outMeta?.symbol ?? "TOKEN") : "ETH";
    const toToken = inT ? (inMeta?.symbol ?? "TOKEN") : "ETH";
    const fromAmount = outT ? formatUnits(outT.value, outDecimals) : formatUnits(tx.value, 18);
    const toAmount = inT ? formatUnits(inT.value, inDecimals) : "0";
    let notionalUsdCents = Math.max(outUsd, inUsd, ethUsd);
    if (notionalUsdCents === 0) {
      notionalUsdCents = Math.max(
        stableSymbolNotionalCents(fromToken, fromAmount, ethPrice),
        stableSymbolNotionalCents(toToken, toAmount, ethPrice),
      );
    }

    return {
      provider: "robinhood",
      txHash: txHash.toLowerCase(),
      fromChain: CHAIN_KEY,
      toChain: CHAIN_KEY,
      fromToken,
      toToken,
      fromAmount,
      toAmount,
      notionalUsdCents,
      kind: "trade",
      executedAt: new Date(Number(block.timestamp) * 1000),
    };
  } catch {
    return null;
  }
}
