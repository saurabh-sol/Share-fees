import { fetchLifiQuote, type LifiQuote } from "@/lib/lifi/http";
import { usdToCents } from "@/lib/lifi/notional";
import { isAllowedChainId } from "@/lib/lifi/constants";
import { isUniswapChainId, type PoolKey } from "@/lib/uniswap/constants";
import { quoteUniswap, UniswapQuoteError, type UniswapQuoteResult } from "@/lib/uniswap/quote";

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
  provider: "uniswap" | "lifi";
  quote: UniswapQuoteView | LifiQuote;
  fromAmountUsdCents: number;
};

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
  const sameChain = input.fromChainId === input.toChainId;

  if (sameChain && isUniswapChainId(input.fromChainId)) {
    try {
      const result = await quoteUniswap({
        chainId: input.fromChainId,
        fromToken: input.fromToken,
        toToken: input.toToken,
        fromAmount: input.fromAmount,
      });

      const fromDecimals = input.fromTokenMeta?.decimals ?? 18;
      const fromPriceUsd = input.fromTokenMeta?.priceUSD
        ? Number(input.fromTokenMeta.priceUSD)
        : 0;
      const fromAmountHuman = Number(input.fromAmount) / 10 ** fromDecimals;
      const fromAmountUsdCents = fromPriceUsd > 0
        ? Math.round(fromAmountHuman * fromPriceUsd * 100)
        : 0;

      const toDecimals = input.toTokenMeta?.decimals ?? 18;
      const toPriceUsd = input.toTokenMeta?.priceUSD
        ? Number(input.toTokenMeta.priceUSD)
        : 0;
      const toAmountHuman = Number(result.amountOut) / 10 ** toDecimals;
      const toAmountUsd = toPriceUsd > 0 ? (toAmountHuman * toPriceUsd).toFixed(2) : undefined;
      const fromAmountUsd = fromPriceUsd > 0 ? (fromAmountHuman * fromPriceUsd).toFixed(2) : undefined;

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

      return {
        provider: "uniswap",
        quote: quoteView,
        fromAmountUsdCents: fromAmountUsdCents || (toAmountUsd ? Math.round(Number(toAmountUsd) * 100) : 0),
      };
    } catch (error) {
      if (!isAllowedChainId(input.fromChainId) || !isAllowedChainId(input.toChainId)) {
        throw error;
      }
    }
  }

  if (isAllowedChainId(input.fromChainId) && isAllowedChainId(input.toChainId)) {
    const quote = await fetchLifiQuote(input);
    const fromAmountUsdCents = quote.estimate.fromAmountUSD
      ? usdToCents(quote.estimate.fromAmountUSD)
      : 0;
    return { provider: "lifi", quote, fromAmountUsdCents };
  }

  throw new UniswapQuoteError("That chain pair is not enabled.", 400);
}
