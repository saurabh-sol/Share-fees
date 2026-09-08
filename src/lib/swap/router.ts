import { ROBINHOOD_CHAIN_ID, ROBINHOOD_USDG } from "@/lib/chains/robinhood";
import { isUniswapChainId, type PathKey, type PoolKey } from "@/lib/uniswap/constants";
import { quoteUniswap, UniswapQuoteError } from "@/lib/uniswap/quote";

/**
 * The route the client should execute against.
 *
 * - `single`    — one Uniswap V4 pool. Client encodes SWAP_EXACT_IN_SINGLE.
 * - `multi`     — V4 2+ hops through hub currencies. Client encodes SWAP_EXACT_IN.
 * - `v3-single` — one Uniswap V3 pool via Universal Router V3_SWAP_EXACT_IN.
 * - `v3-multi`  — V3 2+ hops via packed path bytes.
 */
export type UniswapRoute =
  | {
      type: "single";
      poolKey: PoolKey;
      zeroForOne: boolean;
    }
  | {
      type: "multi";
      currencyIn: `0x${string}`;
      path: PathKey[];
    }
  | {
      type: "v3-single";
      v3TokenIn: `0x${string}`;
      v3TokenOut: `0x${string}`;
      v3Fee: number;
    }
  | {
      type: "v3-multi";
      v3Path: `0x${string}`;
    };

export type UniswapQuoteView = {
  provider: "uniswap";
  amountOut: string;
  fee: number;
  tickSpacing: number;
  /** Legacy — only meaningful for single-hop. Kept so older clients don't crash. */
  poolKey: PoolKey;
  /** Legacy — only meaningful for single-hop. Kept so older clients don't crash. */
  zeroForOne: boolean;
  tokenIn: string;
  tokenOut: string;
  isNativeIn: boolean;
  isNativeOut: boolean;
  /** True when ETH input must be wrapped to WETH before the swap. */
  needsWrapIn: boolean;
  /** True when WETH output must be unwrapped to ETH after the swap. */
  needsUnwrapOut: boolean;
  /** The concrete route the browser executes. */
  route: UniswapRoute;
  action: {
    fromChainId: number;
    toChainId: number;
    fromToken: { address: string; symbol: string; decimals: number; logoURI?: string };
    toToken: { address: string; symbol: string; decimals: number; logoURI?: string };
    fromAmount: string;
  };
  estimate: {
    fromAmount: string;
    toAmount: string;
    toAmountUSD?: string;
    fromAmountUSD?: string;
  };
};

export type RoutedQuote = {
  provider: "uniswap";
  quote: UniswapQuoteView;
  fromAmountUsdCents: number;
};

/**
 * Compute the swap's USD notional.
 *
 * Robinhood Chain trades are always priced against USDG (a $1 stablecoin), so:
 * - If USDG is the input → USD notional = fromAmount (human units)
 * - If USDG is the output → USD notional = toAmount (human units)
 * - Otherwise, fall back to the token's advertised priceUSD, or the pool's
 *   quoted amountOut.
 */
function computeUsdCents(input: {
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  fromDecimals: number;
  toDecimals: number;
  fromPriceUsd?: number;
  toPriceUsd?: number;
}): number {
  const usdg = ROBINHOOD_USDG.toLowerCase();

  const fromHuman = Number(input.fromAmount) / 10 ** input.fromDecimals;
  const toHuman = Number(input.toAmount) / 10 ** input.toDecimals;

  if (input.fromToken.toLowerCase() === usdg) {
    return Math.round(fromHuman * 100);
  }
  if (input.toToken.toLowerCase() === usdg) {
    return Math.round(toHuman * 100);
  }

  if (input.fromPriceUsd && input.fromPriceUsd > 0) {
    return Math.round(fromHuman * input.fromPriceUsd * 100);
  }
  if (input.toPriceUsd && input.toPriceUsd > 0) {
    return Math.round(toHuman * input.toPriceUsd * 100);
  }

  return 0;
}

export async function routeSwapQuote(input: {
  fromChainId: number;
  toChainId: number;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  fromAddress: string;
  fromTokenMeta?: { symbol: string; decimals: number; priceUSD?: string; logoURI?: string };
  toTokenMeta?: { symbol: string; decimals: number; priceUSD?: string; logoURI?: string };
}): Promise<RoutedQuote> {
  // Robinhood-only. No cross-chain bridging.
  if (input.fromChainId !== input.toChainId) {
    throw new UniswapQuoteError(
      "Cross-chain bridging is disabled. Both chains must be Robinhood Chain (4663).",
      400,
    );
  }
  if (input.fromChainId !== ROBINHOOD_CHAIN_ID || !isUniswapChainId(input.fromChainId)) {
    throw new UniswapQuoteError(
      "Swap Studio is Robinhood-Chain-only. Switch your wallet to Robinhood Chain (4663).",
      400,
    );
  }

  const result = await quoteUniswap({
    chainId: input.fromChainId,
    fromToken: input.fromToken,
    toToken: input.toToken,
    fromAmount: input.fromAmount,
  });

  const fromDecimals = input.fromTokenMeta?.decimals ?? 18;
  const toDecimals = input.toTokenMeta?.decimals ?? 18;
  const fromPriceUsd = input.fromTokenMeta?.priceUSD ? Number(input.fromTokenMeta.priceUSD) : undefined;
  const toPriceUsd = input.toTokenMeta?.priceUSD ? Number(input.toTokenMeta.priceUSD) : undefined;

  const fromAmountUsdCents = computeUsdCents({
    fromToken: input.fromToken,
    toToken: input.toToken,
    fromAmount: input.fromAmount,
    toAmount: result.amountOut.toString(),
    fromDecimals,
    toDecimals,
    fromPriceUsd,
    toPriceUsd,
  });

  const fromAmountUsd = fromAmountUsdCents > 0
    ? (fromAmountUsdCents / 100).toFixed(2)
    : undefined;
  // toAmountUSD uses same notional (Robinhood pairs are USDG-based → symmetric).
  const toAmountUsd = fromAmountUsdCents > 0
    ? (fromAmountUsdCents / 100).toFixed(2)
    : undefined;

  // Build the execution route. For single-hop we also expose `poolKey` /
  // `zeroForOne` at the top level so older client builds keep working.
  let route: UniswapRoute;
  if (result.route === "single") {
    route = { type: "single", poolKey: result.poolKey, zeroForOne: result.zeroForOne };
  } else if (result.route === "multi") {
    route = { type: "multi", currencyIn: result.currencyIn, path: result.path };
  } else if (result.route === "v3-single") {
    route = { type: "v3-single", v3TokenIn: result.v3TokenIn, v3TokenOut: result.v3TokenOut, v3Fee: result.v3Fee };
  } else {
    route = { type: "v3-multi", v3Path: result.v3Path };
  }

  const zeroAddr = "0x0000000000000000000000000000000000000000" as `0x${string}`;
  const legacyPoolKey: PoolKey = "poolKey" in result
    ? result.poolKey
    : {
        currency0: "currencyIn" in result ? result.currencyIn : zeroAddr,
        currency1: zeroAddr,
        fee: result.fee,
        tickSpacing: result.tickSpacing,
        hooks: zeroAddr,
      };
  const legacyZeroForOne = "zeroForOne" in result ? result.zeroForOne : true;

  const quoteView: UniswapQuoteView = {
    provider: "uniswap",
    amountOut: result.amountOut.toString(),
    fee: result.fee,
    tickSpacing: result.tickSpacing,
    poolKey: legacyPoolKey,
    zeroForOne: legacyZeroForOne,
    tokenIn: result.tokenIn,
    tokenOut: result.tokenOut,
    isNativeIn: result.isNativeIn,
    isNativeOut: result.isNativeOut,
    needsWrapIn: result.needsWrapIn ?? false,
    needsUnwrapOut: result.needsUnwrapOut ?? false,
    route,
    action: {
      fromChainId: input.fromChainId,
      toChainId: input.toChainId,
      fromToken: {
        address: input.fromToken,
        symbol: input.fromTokenMeta?.symbol ?? "TOKEN",
        decimals: fromDecimals,
        logoURI: input.fromTokenMeta?.logoURI,
      },
      toToken: {
        address: input.toToken,
        symbol: input.toTokenMeta?.symbol ?? "TOKEN",
        decimals: toDecimals,
        logoURI: input.toTokenMeta?.logoURI,
      },
      fromAmount: input.fromAmount,
    },
    estimate: {
      fromAmount: input.fromAmount,
      toAmount: result.amountOut.toString(),
      toAmountUSD: toAmountUsd,
      fromAmountUSD: fromAmountUsd,
    },
  };

  return {
    provider: "uniswap",
    quote: quoteView,
    fromAmountUsdCents,
  };
}
