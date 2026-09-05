import { fetchLifiTokens } from "@/lib/lifi/http";
import { usdToCents } from "@/lib/lifi/notional";
import { NATIVE_TOKEN, ROBINHOOD_CHAIN_ID } from "@/lib/chains/robinhood";
import { ChangeNowError, type ChangeNowQuoteView } from "./types";
import { decimalAmount, loadMappedPair } from "./assets";
import { fetchChangeNowEstimate, fetchChangeNowMinAmount } from "./http";

async function fallbackEthUsd(): Promise<string | undefined> {
  try {
    const tokens = await fetchLifiTokens(1);
    const eth = tokens.find(
      (token) =>
        token.symbol.toUpperCase() === "ETH" &&
        token.address.toLowerCase() === NATIVE_TOKEN,
    );
    return eth?.priceUSD;
  } catch {
    return undefined;
  }
}

function usdFromAmount(amount: string, priceUsd?: string) {
  if (!priceUsd) return undefined;
  const units = Number.parseFloat(amount);
  const price = Number.parseFloat(priceUsd);
  if (!Number.isFinite(units) || !Number.isFinite(price) || units <= 0 || price <= 0) {
    return undefined;
  }
  return (units * price).toFixed(6);
}

export async function quoteChangeNow(input: {
  fromChainId: number;
  toChainId: number;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  fromAddress?: string;
}): Promise<{ view: ChangeNowQuoteView; fromAmountUsdCents: number }> {
  const { from, to } = await loadMappedPair(input);
  const human = decimalAmount(input.fromAmount, 18);
  if (Number.parseFloat(human) <= 0) {
    throw new ChangeNowError("Amount must be greater than zero.", 400);
  }

  const [estimate, minAmount] = await Promise.all([
    fetchChangeNowEstimate({
      fromCurrency: from.ticker,
      toCurrency: to.ticker,
      fromNetwork: from.network,
      toNetwork: to.network,
      fromAmount: human,
      fromLegacy: from.legacyTicker,
      toLegacy: to.legacyTicker,
    }),
    fetchChangeNowMinAmount({
      fromCurrency: from.ticker,
      toCurrency: to.ticker,
      fromNetwork: from.network,
      toNetwork: to.network,
    }),
  ]);

  if (minAmount && Number.parseFloat(human) < Number.parseFloat(minAmount)) {
    throw new ChangeNowError(`Below ChangeNOW minimum of ${minAmount} ${from.ticker.toUpperCase()}.`, 400);
  }

  let fromAmountUsd = estimate.fromAmountUsd;
  let toAmountUsd = estimate.toAmountUsd;
  if (!fromAmountUsd && (from.ticker.toLowerCase() === "eth" || input.fromChainId === ROBINHOOD_CHAIN_ID)) {
    fromAmountUsd = usdFromAmount(estimate.fromAmount, await fallbackEthUsd());
  }

  const fromAmountUsdCents = fromAmountUsd ? usdToCents(fromAmountUsd) : 0;
  const view: ChangeNowQuoteView = {
    provider: "changenow",
    fromCurrency: from.ticker,
    toCurrency: to.ticker,
    fromNetwork: from.network,
    toNetwork: to.network,
    fromAmount: estimate.fromAmount,
    toAmount: estimate.toAmount,
    minAmount,
    transactionSpeedForecast: estimate.transactionSpeedForecast,
    warningMessage: estimate.warningMessage,
    action: {
      fromChainId: input.fromChainId,
      toChainId: input.toChainId,
      fromToken: {
        address: from.tokenContract ?? NATIVE_TOKEN,
        symbol: from.ticker.toUpperCase(),
        decimals: 18,
        chainId: input.fromChainId,
        logoURI: from.image ?? undefined,
      },
      toToken: {
        address: to.tokenContract ?? NATIVE_TOKEN,
        symbol: to.ticker.toUpperCase(),
        decimals: 18,
        chainId: input.toChainId,
        logoURI: to.image ?? undefined,
      },
      fromAmount: input.fromAmount,
      fromAddress: input.fromAddress,
    },
    estimate: {
      fromAmount: estimate.fromAmount,
      toAmount: estimate.toAmount,
      fromAmountUSD: fromAmountUsd,
      toAmountUSD: toAmountUsd,
    },
  };

  return { view, fromAmountUsdCents };
}
