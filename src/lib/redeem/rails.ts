import { STOCK_RAILS } from "./stock-catalog";

export type StockRail = (typeof STOCK_RAILS)[number];
export type Rail = "usdt" | "llm_credits" | "ai_create_credits" | StockRail;

export function isStockRail(rail: string): rail is StockRail {
  return (STOCK_RAILS as readonly string[]).includes(rail);
}

export function isUsdtLikeRail(rail: Rail) {
  return rail === "usdt" || isStockRail(rail);
}
