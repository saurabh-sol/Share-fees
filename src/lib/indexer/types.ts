export type HistoricalCandidate = {
  provider: "zerion" | "lifi" | "import";
  txHash: string;
  fromChain: string;
  toChain: string;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  notionalUsdCents: number;
  executedAt: Date;
};

export type TradeSource = {
  name: string;
  fetchTrades: (address: string, since: Date) => Promise<HistoricalCandidate[]>;
};
