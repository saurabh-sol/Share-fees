import { ROBINHOOD_STOCKS } from "@/lib/chains/robinhood";

/** Treasury wallet holding Robinhood stock tokens for desk payouts. */
export const DEFAULT_STOCK_INVENTORY_WALLET = "0xd53019bdCb79D918Da115B1a6A8cA454b09E28c0";

export type StockSymbol = "NVDA" | "AAPL" | "MSFT";

export type StockPayoutOption = {
  symbol: StockSymbol;
  address: `0x${string}`;
  name: string;
  logoURI: string;
  rail: `stock_${Lowercase<StockSymbol>}`;
  /** Approximate USD price per token share (cents). Override via env at runtime. */
  usdCentsPerShare: number;
};

const STOCK_META: Record<StockSymbol, { usdCentsPerShare: number }> = {
  NVDA: { usdCentsPerShare: 14_000 },
  AAPL: { usdCentsPerShare: 23_000 },
  MSFT: { usdCentsPerShare: 42_000 },
};

/** Display + redeem cap when on-chain treasury reads low (wallet 0xd53019…). */
export const DEMO_STOCK_SHARES: Record<StockSymbol, string> = {
  NVDA: "0.44",
  AAPL: "0.31",
  MSFT: "0.20",
};

function stockRow(symbol: StockSymbol) {
  const row = ROBINHOOD_STOCKS.find((item) => item.symbol === symbol);
  if (!row) throw new Error(`missing_stock_${symbol}`);
  return row;
}

export const STOCK_PAYOUT_OPTIONS: readonly StockPayoutOption[] = (
  ["NVDA", "AAPL", "MSFT"] as const
).map((symbol) => {
  const row = stockRow(symbol);
  return {
    symbol,
    address: row.address as `0x${string}`,
    name: row.name,
    logoURI: row.logoURI,
    rail: `stock_${symbol.toLowerCase()}` as StockPayoutOption["rail"],
    usdCentsPerShare: STOCK_META[symbol].usdCentsPerShare,
  };
});

export function stockOptionForRail(rail: string) {
  return STOCK_PAYOUT_OPTIONS.find((item) => item.rail === rail) ?? null;
}

export function isStockRail(rail: string): rail is StockPayoutOption["rail"] {
  return stockOptionForRail(rail) != null;
}

export const STOCK_RAILS = STOCK_PAYOUT_OPTIONS.map((item) => item.rail);
