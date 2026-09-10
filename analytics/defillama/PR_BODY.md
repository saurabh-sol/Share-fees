## Summary

Adds trading volume tracking for **Accrued** on **Robinhood Chain**.

The adapter tracks only swaps that emit `AccruedSwap` from the deployed **AccruedSwapRouter** (`0xc78e883f87675e75334df4d341f6fcb0915ebf19`). Unrelated Uniswap activity on Robinhood Chain is excluded.

## Category

DEX Aggregator — Accrued routes through Uniswap V3 SwapRouter02 but does not own liquidity.

## Contracts

| Contract | Address |
|----------|---------|
| AccruedSwapRouter | `0xc78e883f87675e75334df4d341f6fcb0915ebf19` |
| SwapRouter02 (downstream) | `0xcaf681a66d020601342297493863e78c959e5cb2` |

## Methodology

- One `AccruedSwap` event = one user trade
- USD: stablecoin leg (USDG/USDT) preferred; WETH via price oracle
- Protocol fees: $0 (fees adapter included for completeness)
- Start block: router deploy block on Robinhood mainnet

## Links

- Website: https://accrued.trade
- Dune dashboard: https://dune.com/accured/accrued
- DeFiLlama PR: https://github.com/DefiLlama/dimension-adapters/pull/9382
- Attribution doc: https://github.com/saurabh-sol/Share-fees/blob/main/docs/analytics/swap-attribution.md
