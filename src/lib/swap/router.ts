import { ROBINHOOD_CHAIN_ID, ROBINHOOD_USDG } from "@/lib/chains/robinhood";
import { isUniswapChainId, type PoolKey } from "@/lib/uniswap/constants";
import { quoteUniswap, UniswapQuoteError } from "@/lib/uniswap/quote";

export type UniswapQuoteView = {
  provider: "uniswap";
  amountOut: string;
  fee: number;
  tickSpacing: number;
  poolKey: PoolKey;
  zeroForOne: boolean;
  tokenIn: string;
  tokenOut: string;
  isNativeIn: boolean;
  isNativeOut: boolean;
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

  const fromAmountHuman = Number(input.fromAmount) / 10 ** fromDecimals;
  const toAmountHuman = Number(result.amountOut) / 10 ** toDecimals;
  const fromAmountUsd = fromAmountUsdCents > 0
    ? (fromAmountUsdCents / 100).toFixed(2)
    : undefined;
  // toAmountUSD uses same notional (Robinhood pairs are USDG-based → symmetric).
  const toAmountUsd = fromAmountUsdCents > 0
    ? (fromAmountUsdCents / 100).toFixed(2)
    : undefined;

  const quoteView: UniswapQuoteView = {
    provider: "uniswap",
    amountOut: result.amountOut.toString(),
    fee: result.fee,
    tickSpacing: result.tickSpacing,
    poolKey: result.poolKey,
    zeroForOne: result.zeroForOne,
    tokenIn: result.tokenIn,
    tokenOut: result.tokenOut,
    isNativeIn: result.isNativeIn,
    isNativeOut: result.isNativeOut,
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
  // Reference these so tsc doesn't complain about the local `Number()` conversions when priceUSD isn't provided.
  void fromAmountHuman;
  void toAmountHuman;

  return {
    provider: "uniswap",
    quote: quoteView,
    fromAmountUsdCents,
  };
}
