import { createPublicClient, http, type Chain } from "viem";
import { mainnet, optimism, polygon, arbitrum, base, bsc, avalanche } from "viem/chains";
import { robinhoodChain, ROBINHOOD_USDG } from "@/lib/chains/robinhood";
import {
  V4_POOL_CONFIGS,
  V4_QUOTER,
  V4_QUOTER_ABI,
  NATIVE_ADDRESS,
  ZERO_HOOKS,
  sortCurrencies,
  type UniswapChainId,
  type PoolKey,
  type PathKey,
} from "./constants";

const CHAIN_MAP: Record<UniswapChainId, Chain> = {
  1: mainnet,
  10: optimism,
  137: polygon,
  42161: arbitrum,
  8453: base,
  56: bsc,
  43114: avalanche,
  4663: robinhoodChain,
};

const clientCache = new Map<number, ReturnType<typeof createPublicClient>>();

function getClient(chainId: UniswapChainId) {
  let client = clientCache.get(chainId);
  if (client) return client;

  const chain = CHAIN_MAP[chainId];
  client = createPublicClient({
    chain,
    transport: http(undefined, { timeout: 15_000 }),
  });
  clientCache.set(chainId, client);
  return client;
}

/**
 * A single-hop pool found in V4Quoter for a given (tokenA, tokenB) pair.
 * Records which fee/tickSpacing worked so browser.ts can encode the swap.
 */
export type SingleHop = {
  fee: number;
  tickSpacing: number;
  poolKey: PoolKey;
  zeroForOne: boolean;
  amountOut: bigint;
};

/**
 * The routing envelope returned by `quoteUniswap`.
 * - `single` — a direct pool exists and we quote through it.
 * - `multi` — a multi-hop route through one or more intermediate currencies.
 */
export type UniswapQuoteResult = {
  amountOut: bigint;
  tokenIn: `0x${string}`;
  tokenOut: `0x${string}`;
  isNativeIn: boolean;
  isNativeOut: boolean;
} & (
  | {
      route: "single";
      fee: number;
      tickSpacing: number;
      poolKey: PoolKey;
      zeroForOne: boolean;
    }
  | {
      route: "multi";
      fee: number; // fee of the first hop (for display)
      tickSpacing: number; // tickSpacing of the first hop
      currencyIn: `0x${string}`;
      path: PathKey[]; // one PathKey per hop, in order
    }
);

/**
 * Try every V4_POOL_CONFIG for a given (fromToken → toToken) pair.
 * Returns the pool that yields the highest amountOut, or `null` if no pool
 * has liquidity for that pair at any tried config.
 */
async function quoteSingleHop(
  client: ReturnType<typeof createPublicClient>,
  quoterAddress: `0x${string}`,
  fromToken: `0x${string}`,
  toToken: `0x${string}`,
  amountIn: bigint,
): Promise<SingleHop | null> {
  if (fromToken.toLowerCase() === toToken.toLowerCase()) return null;
  if (amountIn <= 0n) return null;

  const { currency0, currency1, zeroForOne } = sortCurrencies(fromToken, toToken);

  const results = await Promise.allSettled(
    V4_POOL_CONFIGS.map(async (cfg) => {
      const poolKey: PoolKey = {
        currency0,
        currency1,
        fee: cfg.fee,
        tickSpacing: cfg.tickSpacing,
        hooks: ZERO_HOOKS,
      };

      const sim = await client.simulateContract({
        address: quoterAddress,
        abi: V4_QUOTER_ABI,
        functionName: "quoteExactInputSingle",
        args: [
          {
            poolKey: {
              currency0: poolKey.currency0,
              currency1: poolKey.currency1,
              fee: poolKey.fee,
              tickSpacing: poolKey.tickSpacing,
              hooks: poolKey.hooks,
            },
            zeroForOne,
            exactAmount: amountIn,
            hookData: "0x" as `0x${string}`,
          },
        ],
      });

      const deltaAmounts = sim.result[0] as readonly bigint[];
      const outIdx = zeroForOne ? 1 : 0;
      let amountOut = deltaAmounts[outIdx] ?? 0n;
      if (amountOut < 0n) amountOut = -amountOut;

      return { amountOut, poolKey, cfg };
    }),
  );

  let best: SingleHop | null = null;
  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    const { amountOut, poolKey, cfg } = r.value;
    if (amountOut === 0n) continue;
    if (!best || amountOut > best.amountOut) {
      best = {
        fee: cfg.fee,
        tickSpacing: cfg.tickSpacing,
        poolKey,
        zeroForOne,
        amountOut,
      };
    }
  }
  return best;
}

/**
 * On Robinhood Chain, hub currencies for multi-hop routing are USDG (the
 * stable quote for stocks) and native ETH (the quote for pools.trade-style
 * pools). We try each hub in turn when a direct pool doesn't exist.
 */
function hubCandidates(chainId: UniswapChainId): `0x${string}`[] {
  if (chainId === 4663) {
    return [
      ROBINHOOD_USDG.toLowerCase() as `0x${string}`,
      NATIVE_ADDRESS,
    ];
  }
  return [];
}

/**
 * Quote a Uniswap V4 route.
 *
 * Strategy:
 * 1. Try a direct single-pool quote (all fee/tickSpacing configs).
 * 2. If no direct pool has liquidity, try a 2-hop route through each hub
 *    currency (USDG, then native ETH). Pick the hub that gives the best
 *    `amountOut`.
 *
 * Throws `UniswapQuoteError(404)` if no route can be found.
 */
export async function quoteUniswap(input: {
  chainId: UniswapChainId;
  fromToken: string;
  toToken: string;
  fromAmount: string;
}): Promise<UniswapQuoteResult> {
  const client = getClient(input.chainId);
  const quoterAddress = V4_QUOTER[input.chainId];

  const tokenIn = input.fromToken.toLowerCase() as `0x${string}`;
  const tokenOut = input.toToken.toLowerCase() as `0x${string}`;
  const amountIn = BigInt(input.fromAmount);
  const isNativeIn = tokenIn === NATIVE_ADDRESS.toLowerCase();
  const isNativeOut = tokenOut === NATIVE_ADDRESS.toLowerCase();

  // 1. Try direct single-pool.
  const direct = await quoteSingleHop(client, quoterAddress, tokenIn, tokenOut, amountIn);
  if (direct) {
    return {
      route: "single",
      amountOut: direct.amountOut,
      fee: direct.fee,
      tickSpacing: direct.tickSpacing,
      poolKey: direct.poolKey,
      zeroForOne: direct.zeroForOne,
      tokenIn,
      tokenOut,
      isNativeIn,
      isNativeOut,
    };
  }

  // 2. Try 2-hop routes through hub currencies.
  const hubs = hubCandidates(input.chainId).filter(
    (h) => h !== tokenIn && h !== tokenOut,
  );

  type MultiHopCandidate = {
    hub: `0x${string}`;
    firstHop: SingleHop;
    secondHop: SingleHop;
    amountOut: bigint;
  };

  const multiHops = await Promise.all(
    hubs.map(async (hub): Promise<MultiHopCandidate | null> => {
      const firstHop = await quoteSingleHop(client, quoterAddress, tokenIn, hub, amountIn);
      if (!firstHop) return null;
      const secondHop = await quoteSingleHop(
        client,
        quoterAddress,
        hub,
        tokenOut,
        firstHop.amountOut,
      );
      if (!secondHop) return null;
      return {
        hub,
        firstHop,
        secondHop,
        amountOut: secondHop.amountOut,
      };
    }),
  );

  const bestMulti = multiHops.reduce<MultiHopCandidate | null>((best, cand) => {
    if (!cand) return best;
    if (!best || cand.amountOut > best.amountOut) return cand;
    return best;
  }, null);

  if (bestMulti) {
    // Build PathKey[] for Universal Router execution.
    // Each PathKey specifies the OUTPUT of that hop plus the pool params.
    const path: PathKey[] = [
      {
        intermediateCurrency: bestMulti.hub,
        fee: bestMulti.firstHop.fee,
        tickSpacing: bestMulti.firstHop.tickSpacing,
        hooks: ZERO_HOOKS,
        hookData: "0x",
      },
      {
        intermediateCurrency: tokenOut,
        fee: bestMulti.secondHop.fee,
        tickSpacing: bestMulti.secondHop.tickSpacing,
        hooks: ZERO_HOOKS,
        hookData: "0x",
      },
    ];

    return {
      route: "multi",
      amountOut: bestMulti.amountOut,
      fee: bestMulti.firstHop.fee,
      tickSpacing: bestMulti.firstHop.tickSpacing,
      currencyIn: tokenIn,
      path,
      tokenIn,
      tokenOut,
      isNativeIn,
      isNativeOut,
    };
  }

  throw new UniswapQuoteError(
    "No Uniswap V4 pool with sufficient liquidity for this pair. Try a smaller amount, or swap into USDG first.",
    404,
  );
}

export class UniswapQuoteError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "UniswapQuoteError";
    this.status = status;
  }
}
