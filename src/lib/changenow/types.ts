export type ChangeNowCurrency = {
  ticker: string;
  name: string;
  network: string;
  tokenContract?: string | null;
  image?: string | null;
  featured?: boolean;
  isStable?: boolean;
  supportsFixedRate?: boolean;
  buy?: boolean;
  sell?: boolean;
  legacyTicker?: string;
  hasExternalId?: boolean;
};

export type ChangeNowEstimate = {
  fromCurrency: string;
  toCurrency: string;
  fromNetwork: string;
  toNetwork: string;
  fromAmount: string;
  toAmount: string;
  fromAmountUsd?: string;
  toAmountUsd?: string;
  minAmount?: string;
  transactionSpeedForecast?: string | null;
  warningMessage?: string | null;
};

export type ChangeNowExchange = {
  id: string;
  status: string;
  fromCurrency: string;
  toCurrency: string;
  fromNetwork: string;
  toNetwork: string;
  fromAmount: string;
  toAmount: string;
  payinAddress: string;
  payoutAddress: string;
  payinExtraId?: string | null;
  refundAddress?: string | null;
  payinHash?: string | null;
  payoutHash?: string | null;
  validUntil?: string | null;
};

export type ChangeNowQuoteView = {
  provider: "changenow";
  fromCurrency: string;
  toCurrency: string;
  fromNetwork: string;
  toNetwork: string;
  fromAmount: string;
  toAmount: string;
  minAmount?: string;
  transactionSpeedForecast?: string | null;
  warningMessage?: string | null;
  action: {
    fromChainId: number;
    toChainId: number;
    fromToken: { address: string; symbol: string; decimals: number; chainId: number; logoURI?: string };
    toToken: { address: string; symbol: string; decimals: number; chainId: number; logoURI?: string };
    fromAmount: string;
    fromAddress?: string;
    toAddress?: string;
  };
  estimate: {
    fromAmount: string;
    toAmount: string;
    fromAmountUSD?: string;
    toAmountUSD?: string;
  };
};

export class ChangeNowError extends Error {
  constructor(
    message: string,
    readonly status = 502,
  ) {
    super(message);
    this.name = "ChangeNowError";
  }
}
