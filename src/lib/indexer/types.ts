export type ActivityKind =
  | "trade"
  | "execute"
  | "send"
  | "receive"
  | "deposit"
  | "withdraw"
  | "approve"
  | "other";

export type HistoricalCandidate = {
  provider: "alchemy" | "zerion" | "lifi" | "uniswap" | "import" | "robinhood";
  txHash: string;
  fromChain: string;
  toChain: string;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  notionalUsdCents: number;
  kind: ActivityKind;
  executedAt: Date;
};

export const CLAIMABLE_KINDS = new Set<ActivityKind>(["trade", "execute"]);

/** Swaps plus USDG (and other) send/receive — all count toward scan volume. */
export const VOLUME_KINDS = new Set<ActivityKind>(["trade", "execute", "send", "receive"]);

export function isClaimableKind(kind: string | null | undefined) {
  return CLAIMABLE_KINDS.has((kind ?? "trade") as ActivityKind);
}

export function isVolumeKind(kind: string | null | undefined) {
  return VOLUME_KINDS.has((kind ?? "trade") as ActivityKind);
}

export type TradeSource = {
  name: string;
  fetchTrades: (address: string, since: Date) => Promise<HistoricalCandidate[]>;
};
