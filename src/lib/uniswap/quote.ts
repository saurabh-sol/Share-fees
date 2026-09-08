import { createPublicClient, http, type Chain } from "viem";
import { mainnet, optimism, polygon, arbitrum, base, bsc, avalanche, blast } from "viem/chains";
import { robinhoodChain } from "@/lib/chains/robinhood";
import {
  FEE_TIERS,
  QUOTER_V2,
  QUOTER_V2_ABI,
  WRAPPED_NATIVE,
  NATIVE_ADDRESS,
  type UniswapChainId,
  type FeeTier,
} from "./constants";

const CHAIN_MAP: Record<UniswapChainId, Chain> = {
  1: mainnet,
  10: optimism,
  137: polygon,
  42161: arbitrum,
  8453: base,
  56: bsc,
  43114: avalanche,
  81457: blast,
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

function resolveToken(address: string, chainId: UniswapChainId): `0x${string}` {
  if (address.toLowerCase() === NATIVE_ADDRESS.toLowerCase()) {
    return WRAPPED_NATIVE[chainId];
  }
  return address as `0x${string}`;
}

export type UniswapQuoteResult = {
  amountOut: bigint;
  fee: FeeTier;
  tokenIn: `0x${string}`;
  tokenOut: `0x${string}`;
  gasEstimate: bigint;
  isNativeIn: boolean;
  isNativeOut: boolean;
};

/**
 * Call QuoterV2.quoteExactInputSingle across all fee tiers.
 * Returns the best (highest amountOut) result, or throws if no pool has liquidity.
 */
export async function quoteUniswap(input: {
  chainId: UniswapChainId;
  fromToken: string;
  toToken: string;
  fromAmount: string;
}): Promise<UniswapQuoteResult> {
  const client = getClient(input.chainId);
  const quoterAddress = QUOTER_V2[input.chainId];
  const isNativeIn = input.fromToken.toLowerCase() === NATIVE_ADDRESS.toLowerCase();
  const isNativeOut = input.toToken.toLowerCase() === NATIVE_ADDRESS.toLowerCase();
  const tokenIn = resolveToken(input.fromToken, input.chainId);
  const tokenOut = resolveToken(input.toToken, input.chainId);
  const amountIn = BigInt(input.fromAmount);

  const results = await Promise.allSettled(
    FEE_TIERS.map(async (fee) => {
      const result = await client.simulateContract({
        address: quoterAddress,
        abi: QUOTER_V2_ABI,
        functionName: "quoteExactInputSingle",
        args: [
          {
            tokenIn,
            tokenOut,
            amountIn,
            fee,
            sqrtPriceLimitX96: 0n,
          },
        ],
      });
      return {
        amountOut: result.result[0],
        fee,
        gasEstimate: result.result[3],
      };
    }),
  );

  let best: { amountOut: bigint; fee: FeeTier; gasEstimate: bigint } | null = null;

  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    const { amountOut, fee, gasEstimate } = result.value;
    if (amountOut === 0n) continue;
    if (!best || amountOut > best.amountOut) {
      best = { amountOut, fee, gasEstimate };
    }
  }

  if (!best) {
    throw new UniswapQuoteError("No Uniswap V3 pool with sufficient liquidity for this pair.", 404);
  }

  return {
    amountOut: best.amountOut,
    fee: best.fee,
    tokenIn,
    tokenOut,
    gasEstimate: best.gasEstimate,
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
