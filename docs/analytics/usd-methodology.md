# USD volume methodology

Used by Dune SQL ([analytics/dune/](../analytics/dune/)) and DeFiLlama adapters ([analytics/defillama/](../analytics/defillama/)).

## Primary rule

One **AccruedSwap** event = one user trade. Volume is counted **once** at the user-facing notional:

```
volume_usd = amountIn × price(tokenIn)
```

If `tokenIn` has no reliable price, use:

```
volume_usd = amountOut × price(tokenOut)
```

Never sum internal pool hops. Never double-count multi-hop routes.

## Price priority

| Priority | Source | When |
|----------|--------|------|
| A | Stablecoin leg | `tokenIn` or `tokenOut` is USDG (`0x5fc…`) or USDT (`0xE246…`) — use raw amount (6 or 18 decimals normalized) as USD |
| B | DeFiLlama Prices API | ETH, WBTC, major ERC-20 with RH coverage |
| C | DexScreener | $ACCR and RH-native tokens |
| D | Catalog mapping | Tokenized equities (NVDA, AAPL, MSFT, etc.) — USD per share from [stock-catalog.ts](../../src/lib/redeem/stock-catalog.ts), documented in Dune lookup table |

## Fees and revenue

- **User fees:** Uniswap LP fees only (paid to LPs, not Accrued)
- **Accrued protocol fees:** $0 today — no interface fee in AccruedSwapRouter
- **Protocol revenue:** $0 until an on-chain fee switch is added

Do not report Uniswap LP fees as Accrued protocol revenue.

## Limitations

- Analytics start at **AccruedSwapRouter deploy block** — no backfilled pre-router volume
- Robinhood Chain coverage in external price APIs may lag
- Equity tokens use catalog prices, not market feeds
