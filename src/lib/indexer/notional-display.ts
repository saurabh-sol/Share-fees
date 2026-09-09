/** Client-safe USD inference when stored notional is 0 but token amounts exist. */
export function inferDisplayNotionalCents(input: {
  notionalUsdCents: number;
  fromToken: string;
  toToken: string;
  fromAmount?: string;
  toAmount?: string;
  ethUsdCents?: number;
}): number {
  if (input.notionalUsdCents > 0) return input.notionalUsdCents;
  const ethUsd = input.ethUsdCents ?? 250_000;
  return Math.max(
    stableSymbolNotionalCents(input.fromToken, input.fromAmount ?? "", ethUsd),
    stableSymbolNotionalCents(input.toToken, input.toAmount ?? "", ethUsd),
  );
}

export function stableSymbolNotionalCents(
  symbol: string,
  amount: string,
  ethUsdCents: number,
): number {
  const human = Number(amount);
  if (!Number.isFinite(human) || human <= 0) return 0;
  const sym = symbol.toUpperCase();
  if (sym === "USDT" || sym === "USDG" || sym === "USDC") return Math.round(human * 100);
  if (sym === "ETH" || sym === "WETH") return Math.round(human * ethUsdCents);
  return 0;
}
