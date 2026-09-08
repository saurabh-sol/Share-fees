import { createPublicClient, http, type Chain } from "viem";
import { mainnet, optimism, polygon, arbitrum, base, bsc, avalanche } from "viem/chains";
import { robinhoodChain } from "@/lib/chains/robinhood";
import {
  V4_POOL_CONFIGS,
  V4_QUOTER,
  V4_QUOTER_ABI,
  WRAPPED_NATIVE,
  NATIVE_ADDRESS,
  ZERO_HOOKS,
  sortCurrencies,
  type UniswapChainId,
  type PoolKey,
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
 * In V4, native ETH is represented as address(0) in the PoolKey.
 * If user passes native sentinel, keep it as address(0).
 */
function resolveForPoolKey(address: string): `0x${string}` {
  return address.toLowerCase() as `0x${string}`;
}

export type UniswapQuoteResult = {
  amountOut: bigint;
  fee: number;
  tickSpacing: number;
  poolKey: PoolKey;
  zeroForOne: boolean;
  tokenIn: `0x${string}`;
  tokenOut: `0x${string}`;
  isNativeIn: boolean;
  isNativeOut: boolean;
};

/**
 * Call V4Quoter.quoteExactInputSingle across standard pool configs.
 * Returns the best (highest amountOut) result, or throws if no pool has liquidity.
 */
export async function quoteUniswap(input: {
  chainId: UniswapChainId;
  fromToken: string;
  toToken: string;
  fromAmount: string;
}): Promise<UniswapQuoteResult> {
  const client = getClient(input.chainId);
  const quoterAddress = V4_QUOTER[input.chainId];
  const isNativeIn = input.fromToken.toLowerCase() === NATIVE_ADDRESS.toLowerCase();
  const isNativeOut = input.toToken.toLowerCase() === NATIVE_ADDRESS.toLowerCase();

  const tokenIn = resolveForPoolKey(input.fromToken);
  const tokenOut = resolveForPoolKey(input.toToken);
  const amountIn = BigInt(input.fromAmount);

  const { currency0, currency1, zeroForOne } = sortCurrencies(tokenIn, tokenOut);

  const results = await Promise.allSettled(
    V4_POOL_CONFIGS.map(async (cfg) => {
      const poolKey: PoolKey = {
        currency0,
        currency1,
        fee: cfg.fee,
        tickSpacing: cfg.tickSpacing,
        hooks: ZERO_HOOKS,
      };

      const result = await client.simulateContract({
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

      const deltaAmounts = result.result[0] as readonly bigint[];
      const outIdx = zeroForOne ? 1 : 0;
      let amountOut = deltaAmounts[outIdx] ?? 0n;
      if (amountOut < 0n) amountOut = -amountOut;

      return { amountOut, poolKey, cfg };
    }),
  );

  let best: { amountOut: bigint; poolKey: PoolKey; cfg: (typeof V4_POOL_CONFIGS)[number] } | null = null;

  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    const { amountOut, poolKey, cfg } = result.value;
    if (amountOut === 0n) continue;
    if (!best || amountOut > best.amountOut) {
      best = { amountOut, poolKey, cfg };
    }
  }

  if (!best) {
    throw new UniswapQuoteError("No Uniswap V4 pool with sufficient liquidity for this pair.", 404);
  }

  return {
    amountOut: best.amountOut,
    fee: best.cfg.fee,
    tickSpacing: best.cfg.tickSpacing,
    poolKey: best.poolKey,
    zeroForOne,
    tokenIn,
    tokenOut,
    isNativeIn,
    isNativeOut,
  };
}

export class UniswapQuoteError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "UniswapQuoteError";
    this.status = status;
  }
}
