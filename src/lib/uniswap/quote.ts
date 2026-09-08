import { createPublicClient, http, type Chain } from "viem";
import { mainnet, optimism, polygon, arbitrum, base, bsc, avalanche } from "viem/chains";
import { robinhoodChain, ROBINHOOD_USDG } from "@/lib/chains/robinhood";
import {
  V4_POOL_CONFIGS,
  V4_QUOTER,
  V4_QUOTER_ABI,
  V3_QUOTER,
  V3_FEE_TIERS,
  V3_QUOTER_ABI,
  NATIVE_ADDRESS,
  WRAPPED_NATIVE,
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

/** V3 single-hop quote result. */
export type V3SingleHop = {
  fee: number;
  tokenIn: `0x${string}`;
  tokenOut: `0x${string}`;
  amountOut: bigint;
};

/**
 * The routing envelope returned by `quoteUniswap`.
 * - `single` — a direct V4 pool.
 * - `multi`  — V4 multi-hop through hub currencies.
 * - `v3-single` — a direct V3 pool.
 * - `v3-multi` — V3 multi-hop through hub currencies.
 */
export type UniswapQuoteResult = {
  amountOut: bigint;
  tokenIn: `0x${string}`;
  tokenOut: `0x${string}`;
  isNativeIn: boolean;
  isNativeOut: boolean;
  needsWrapIn: boolean;
  needsUnwrapOut: boolean;
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
      fee: number;
      tickSpacing: number;
      currencyIn: `0x${string}`;
      path: PathKey[];
    }
  | {
      route: "v3-single";
      fee: number;
      tickSpacing: number;
      v3TokenIn: `0x${string}`;
      v3TokenOut: `0x${string}`;
      v3Fee: number;
      poolKey: PoolKey;
      zeroForOne: boolean;
    }
  | {
      route: "v3-multi";
      fee: number;
      tickSpacing: number;
      v3Path: `0x${string}`;
      poolKey: PoolKey;
      zeroForOne: boolean;
      currencyIn: `0x${string}`;
      path: PathKey[];
    }
);

/* ─── Token variant expansion ─── */

const NATIVE_LC = NATIVE_ADDRESS.toLowerCase() as `0x${string}`;

/**
 * When the user selects ETH (0x0), also try WETH — pools may use either.
 * When the user selects WETH, also try native ETH. Returns de-duped variants.
 */
function tokenVariants(
  token: `0x${string}`,
  chainId: UniswapChainId,
): `0x${string}`[] {
  const t = token.toLowerCase() as `0x${string}`;
  const weth = WRAPPED_NATIVE[chainId].toLowerCase() as `0x${string}`;
  if (t === NATIVE_LC) return [NATIVE_LC, weth];
  if (t === weth) return [weth, NATIVE_LC];
  return [t];
}

/**
 * Hub currencies for multi-hop routing. USDG for stock pairs, WETH for
 * native-quoted pools, native ETH for V4 pools created with address(0).
 */
function hubCandidates(chainId: UniswapChainId): `0x${string}`[] {
  if (chainId === 4663) {
    return [
      ROBINHOOD_USDG.toLowerCase() as `0x${string}`,
      WRAPPED_NATIVE[4663].toLowerCase() as `0x${string}`,
      NATIVE_LC,
    ];
  }
  return [WRAPPED_NATIVE[chainId]?.toLowerCase() as `0x${string}`].filter(Boolean);
}

/* ─── V4 single-hop quoting ─── */

async function quoteV4SingleHop(
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
    if (r.status === "rejected") {
      console.warn("[v4-quote] pool revert:", (r.reason as Error)?.message?.slice(0, 120));
      continue;
    }
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

/* ─── V3 single-hop quoting ─── */

async function quoteV3SingleHop(
  client: ReturnType<typeof createPublicClient>,
  quoterAddress: `0x${string}`,
  fromToken: `0x${string}`,
  toToken: `0x${string}`,
  amountIn: bigint,
  chainId: UniswapChainId,
): Promise<V3SingleHop | null> {
  const weth = WRAPPED_NATIVE[chainId].toLowerCase() as `0x${string}`;
  const tIn = fromToken.toLowerCase() === NATIVE_LC ? weth : (fromToken.toLowerCase() as `0x${string}`);
  const tOut = toToken.toLowerCase() === NATIVE_LC ? weth : (toToken.toLowerCase() as `0x${string}`);

  if (tIn === tOut) return null;
  if (amountIn <= 0n) return null;

  const results = await Promise.allSettled(
    V3_FEE_TIERS.map(async (fee) => {
      const sim = await client.simulateContract({
        address: quoterAddress,
        abi: V3_QUOTER_ABI,
        functionName: "quoteExactInputSingle",
        args: [
          {
            tokenIn: tIn,
            tokenOut: tOut,
            amountIn,
            fee,
            sqrtPriceLimitX96: 0n,
          },
        ],
      });

      const amountOut = sim.result[0] as bigint;
      return { amountOut, fee };
    }),
  );

  let best: V3SingleHop | null = null;
  for (const r of results) {
    if (r.status === "rejected") {
      console.warn("[v3-quote] fee revert:", (r.reason as Error)?.message?.slice(0, 120));
      continue;
    }
    const { amountOut, fee } = r.value;
    if (amountOut === 0n) continue;
    if (!best || amountOut > best.amountOut) {
      best = { fee, tokenIn: tIn, tokenOut: tOut, amountOut };
    }
  }
  return best;
}

/* ─── V4 direct with token variants (tries both ETH and WETH) ─── */

async function bestV4Direct(
  client: ReturnType<typeof createPublicClient>,
  quoterAddress: `0x${string}`,
  tokenIn: `0x${string}`,
  tokenOut: `0x${string}`,
  amountIn: bigint,
  chainId: UniswapChainId,
): Promise<(SingleHop & { actualIn: `0x${string}`; actualOut: `0x${string}` }) | null> {
  const inVariants = tokenVariants(tokenIn, chainId);
  const outVariants = tokenVariants(tokenOut, chainId);

  const candidates = await Promise.all(
    inVariants.flatMap((tIn) =>
      outVariants.map(async (tOut) => {
        const hop = await quoteV4SingleHop(client, quoterAddress, tIn, tOut, amountIn);
        return hop ? { ...hop, actualIn: tIn, actualOut: tOut } : null;
      }),
    ),
  );

  return candidates.reduce<(SingleHop & { actualIn: `0x${string}`; actualOut: `0x${string}` }) | null>(
    (best, c) => {
      if (!c) return best;
      if (!best || c.amountOut > best.amountOut) return c;
      return best;
    },
    null,
  );
}

/* ─── V3 direct (uses WETH for native ETH automatically) ─── */

async function bestV3Direct(
  client: ReturnType<typeof createPublicClient>,
  quoterAddress: `0x${string}`,
  tokenIn: `0x${string}`,
  tokenOut: `0x${string}`,
  amountIn: bigint,
  chainId: UniswapChainId,
): Promise<V3SingleHop | null> {
  return quoteV3SingleHop(client, quoterAddress, tokenIn, tokenOut, amountIn, chainId);
}

/* ─── Pack V3 path bytes ─── */

function packV3Path(tokens: `0x${string}`[], fees: number[]): `0x${string}` {
  let packed = tokens[0].toLowerCase();
  for (let i = 0; i < fees.length; i++) {
    const feeHex = fees[i].toString(16).padStart(6, "0");
    packed += feeHex + tokens[i + 1].toLowerCase().slice(2);
  }
  return packed as `0x${string}`;
}

/* ─── Main quoting function ─── */

/**
 * Quote a Uniswap route on Robinhood Chain.
 *
 * Strategy (in order of preference):
 * 1. V4 direct pool (tries ETH ↔ WETH variants, all fee/tickSpacing configs)
 * 2. V3 direct pool (all fee tiers: 100, 500, 3000, 10000)
 * 3. V4 multi-hop through hubs (USDG, WETH, native ETH)
 * 4. V3 multi-hop through hubs (USDG, WETH)
 *
 * Picks the route with the best output amount across ALL sources.
 * Only throws "no liquidity" after exhausting every option.
 */
export async function quoteUniswap(input: {
  chainId: UniswapChainId;
  fromToken: string;
  toToken: string;
  fromAmount: string;
}): Promise<UniswapQuoteResult> {
  const client = getClient(input.chainId);
  const v4Quoter = V4_QUOTER[input.chainId];
  const v3Quoter = V3_QUOTER[input.chainId];

  const userIn = input.fromToken.toLowerCase() as `0x${string}`;
  const userOut = input.toToken.toLowerCase() as `0x${string}`;
  const amountIn = BigInt(input.fromAmount);
  const isNativeIn = userIn === NATIVE_LC;
  const isNativeOut = userOut === NATIVE_LC;
  const weth = WRAPPED_NATIVE[input.chainId].toLowerCase() as `0x${string}`;

  console.log("[quote] chain=%d in=%s out=%s amountIn=%s native_in=%s native_out=%s",
    input.chainId, userIn, userOut, amountIn.toString(), isNativeIn, isNativeOut);

  type Candidate = {
    amountOut: bigint;
    build: () => UniswapQuoteResult;
  };
  const candidates: Candidate[] = [];

  // ── 1. V4 direct (with ETH ↔ WETH variants) ──
  const v4Direct = await bestV4Direct(client, v4Quoter, userIn, userOut, amountIn, input.chainId);
  if (v4Direct) {
    const needsWrapIn = isNativeIn && v4Direct.actualIn === weth;
    const needsUnwrapOut = isNativeOut && v4Direct.actualOut === weth;
    candidates.push({
      amountOut: v4Direct.amountOut,
      build: () => ({
        route: "single",
        amountOut: v4Direct.amountOut,
        fee: v4Direct.fee,
        tickSpacing: v4Direct.tickSpacing,
        poolKey: v4Direct.poolKey,
        zeroForOne: v4Direct.zeroForOne,
        tokenIn: v4Direct.actualIn,
        tokenOut: v4Direct.actualOut,
        isNativeIn,
        isNativeOut,
        needsWrapIn,
        needsUnwrapOut,
      }),
    });
  }

  // ── 2. V3 direct ──
  if (v3Quoter) {
    const v3Direct = await bestV3Direct(client, v3Quoter, userIn, userOut, amountIn, input.chainId);
    if (v3Direct) {
      const { currency0, currency1, zeroForOne } = sortCurrencies(v3Direct.tokenIn, v3Direct.tokenOut);
      const syntheticPoolKey: PoolKey = {
        currency0,
        currency1,
        fee: v3Direct.fee,
        tickSpacing: 0,
        hooks: ZERO_HOOKS,
      };
      candidates.push({
        amountOut: v3Direct.amountOut,
        build: () => ({
          route: "v3-single",
          amountOut: v3Direct.amountOut,
          fee: v3Direct.fee,
          tickSpacing: 0,
          v3TokenIn: v3Direct.tokenIn,
          v3TokenOut: v3Direct.tokenOut,
          v3Fee: v3Direct.fee,
          poolKey: syntheticPoolKey,
          zeroForOne,
          tokenIn: userIn,
          tokenOut: userOut,
          isNativeIn,
          isNativeOut,
          needsWrapIn: isNativeIn,
          needsUnwrapOut: isNativeOut,
        }),
      });
    }
  }

  // ── 3. V4 multi-hop through hub currencies ──
  const hubs = hubCandidates(input.chainId);

  type V4MultiCandidate = {
    hub: `0x${string}`;
    actualIn: `0x${string}`;
    actualOut: `0x${string}`;
    firstHop: SingleHop;
    secondHop: SingleHop;
    amountOut: bigint;
  };

  const v4MultiResults = await Promise.all(
    hubs
      .filter((h) => h !== userIn && h !== userOut)
      .flatMap((hub) => {
        const inVariants = tokenVariants(userIn, input.chainId);
        const outVariants = tokenVariants(userOut, input.chainId);
        return inVariants.flatMap((tIn) =>
          outVariants.map(async (tOut): Promise<V4MultiCandidate | null> => {
            if (tIn === hub || tOut === hub) return null;
            const firstHop = await quoteV4SingleHop(client, v4Quoter, tIn, hub, amountIn);
            if (!firstHop) return null;
            const secondHop = await quoteV4SingleHop(client, v4Quoter, hub, tOut, firstHop.amountOut);
            if (!secondHop) return null;
            return { hub, actualIn: tIn, actualOut: tOut, firstHop, secondHop, amountOut: secondHop.amountOut };
          }),
        );
      }),
  );

  const bestV4Multi = v4MultiResults.reduce<V4MultiCandidate | null>((best, c) => {
    if (!c) return best;
    if (!best || c.amountOut > best.amountOut) return c;
    return best;
  }, null);

  if (bestV4Multi) {
    const needsWrapIn = isNativeIn && bestV4Multi.actualIn === weth;
    const needsUnwrapOut = isNativeOut && bestV4Multi.actualOut === weth;
    candidates.push({
      amountOut: bestV4Multi.amountOut,
      build: () => {
        const path: PathKey[] = [
          {
            intermediateCurrency: bestV4Multi.hub,
            fee: bestV4Multi.firstHop.fee,
            tickSpacing: bestV4Multi.firstHop.tickSpacing,
            hooks: ZERO_HOOKS,
            hookData: "0x",
          },
          {
            intermediateCurrency: bestV4Multi.actualOut,
            fee: bestV4Multi.secondHop.fee,
            tickSpacing: bestV4Multi.secondHop.tickSpacing,
            hooks: ZERO_HOOKS,
            hookData: "0x",
          },
        ];
        return {
          route: "multi",
          amountOut: bestV4Multi.amountOut,
          fee: bestV4Multi.firstHop.fee,
          tickSpacing: bestV4Multi.firstHop.tickSpacing,
          currencyIn: bestV4Multi.actualIn,
          path,
          tokenIn: bestV4Multi.actualIn,
          tokenOut: bestV4Multi.actualOut,
          isNativeIn,
          isNativeOut,
          needsWrapIn,
          needsUnwrapOut,
        };
      },
    });
  }

  // ── 4. V3 multi-hop through hub currencies ──
  if (v3Quoter) {
    const v3Hubs = hubs.filter((h) => h !== NATIVE_LC);
    const v3In = isNativeIn ? weth : userIn;
    const v3Out = isNativeOut ? weth : userOut;

    const v3MultiResults = await Promise.all(
      v3Hubs
        .filter((h) => h !== v3In && h !== v3Out)
        .map(async (hub) => {
          const first = await quoteV3SingleHop(client, v3Quoter, v3In, hub, amountIn, input.chainId);
          if (!first) return null;
          const second = await quoteV3SingleHop(client, v3Quoter, hub, v3Out, first.amountOut, input.chainId);
          if (!second) return null;
          return { hub, first, second, amountOut: second.amountOut };
        }),
    );

    const bestV3Multi = v3MultiResults.reduce<{
      hub: `0x${string}`;
      first: V3SingleHop;
      second: V3SingleHop;
      amountOut: bigint;
    } | null>((best, c) => {
      if (!c) return best;
      if (!best || c.amountOut > best.amountOut) return c;
      return best;
    }, null);

    if (bestV3Multi) {
      const packedPath = packV3Path(
        [v3In, bestV3Multi.hub, v3Out],
        [bestV3Multi.first.fee, bestV3Multi.second.fee],
      );
      const { currency0, currency1, zeroForOne } = sortCurrencies(v3In, bestV3Multi.hub);
      const syntheticPoolKey: PoolKey = {
        currency0,
        currency1,
        fee: bestV3Multi.first.fee,
        tickSpacing: 0,
        hooks: ZERO_HOOKS,
      };
      candidates.push({
        amountOut: bestV3Multi.amountOut,
        build: () => ({
          route: "v3-multi",
          amountOut: bestV3Multi.amountOut,
          fee: bestV3Multi.first.fee,
          tickSpacing: 0,
          v3Path: packedPath,
          poolKey: syntheticPoolKey,
          zeroForOne,
          currencyIn: v3In,
          path: [
            {
              intermediateCurrency: bestV3Multi.hub,
              fee: bestV3Multi.first.fee,
              tickSpacing: 0,
              hooks: ZERO_HOOKS,
              hookData: "0x",
            },
            {
              intermediateCurrency: v3Out,
              fee: bestV3Multi.second.fee,
              tickSpacing: 0,
              hooks: ZERO_HOOKS,
              hookData: "0x",
            },
          ],
          tokenIn: userIn,
          tokenOut: userOut,
          isNativeIn,
          isNativeOut,
          needsWrapIn: isNativeIn,
          needsUnwrapOut: isNativeOut,
        }),
      });
    }
  }

  // ── Pick the best across ALL candidates ──
  const winner = candidates.reduce<Candidate | null>((best, c) => {
    if (!best || c.amountOut > best.amountOut) return c;
    return best;
  }, null);

  if (winner) {
    const result = winner.build();
    console.log("[quote] winner route=%s amountOut=%s fee=%d", result.route, result.amountOut.toString(), result.fee);
    return result;
  }

  console.error("[quote] NO LIQUIDITY for %s → %s (chain %d, amount %s). Tried %d candidates.",
    userIn, userOut, input.chainId, amountIn.toString(), candidates.length);
  throw new UniswapQuoteError(
    "No Uniswap liquidity found for this pair. Checked V4 and V3 pools across all fee tiers, " +
      "including multi-hop routes through USDG and WETH.",
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
