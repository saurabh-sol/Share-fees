import { involvesRobinhood } from "@/lib/changenow/assets";
import { quoteChangeNow } from "@/lib/changenow/quote";
import { ChangeNowError } from "@/lib/changenow/types";
import { fetchLifiQuote, type LifiQuote } from "@/lib/lifi/http";
import { usdToCents } from "@/lib/lifi/notional";
import { isAllowedChainId } from "@/lib/lifi/constants";
import type { ChangeNowQuoteView } from "@/lib/changenow/types";

export type RoutedQuote = {
  provider: "lifi" | "changenow";
  quote: LifiQuote | ChangeNowQuoteView;
  fromAmountUsdCents: number;
};

export async function routeSwapQuote(input: {
  fromChainId: number;
  toChainId: number;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  fromAddress: string;
}): Promise<RoutedQuote> {
  if (involvesRobinhood(input.fromChainId, input.toChainId)) {
    const quoted = await quoteChangeNow(input);
    return {
      provider: "changenow",
      quote: quoted.view,
      fromAmountUsdCents: quoted.fromAmountUsdCents,
    };
  }

  if (isAllowedChainId(input.fromChainId) && isAllowedChainId(input.toChainId)) {
    try {
      const quote = await fetchLifiQuote(input);
      const fromAmountUsdCents = quote.estimate.fromAmountUSD
        ? usdToCents(quote.estimate.fromAmountUSD)
        : 0;
      return { provider: "lifi", quote, fromAmountUsdCents };
    } catch (error) {
      try {
        const quoted = await quoteChangeNow(input);
        return {
          provider: "changenow",
          quote: quoted.view,
          fromAmountUsdCents: quoted.fromAmountUsdCents,
        };
      } catch {
        throw error;
      }
    }
  }

  throw new ChangeNowError("That chain pair is not enabled.", 400);
}
