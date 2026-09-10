# Dune + DeFiLlama deliverables

| # | Item | Value |
|---|------|-------|
| 1 | AccruedSwapRouter | `0xc78e883f87675e75334df4d341f6fcb0915ebf19` |
| 2 | Related contracts | See [swap-attribution.md](./swap-attribution.md) |
| 3 | AccruedSwap ABI | [`src/lib/uniswap/constants.ts`](../../src/lib/uniswap/constants.ts) `ACCRUED_SWAP_ROUTER_ABI` |
| 4 | Attribution | [swap-attribution.md](./swap-attribution.md) |
| 5 | Dune canonical query | [`analytics/dune/canonical_swaps.sql`](../../analytics/dune/canonical_swaps.sql) — publish on Dune after contract decode |
| 6 | Dune dashboard | https://dune.com/accrued/accrued (create from queries in `analytics/dune/`) |
| 7–9 | Volume / swaps / users | From Dune after first attributed swaps |
| 10 | Fee methodology | [usd-methodology.md](./usd-methodology.md) — $0 protocol fee |
| 11 | DeFiLlama adapter | [`analytics/defillama/dexs/accrued.ts`](../../analytics/defillama/dexs/accrued.ts) |
| 12 | DeFiLlama PR | https://github.com/DefiLlama/dimension-adapters/pull/9382 |
| 13 | Limitations | [limitations.md](./limitations.md) |

Deploy tx: https://robinhoodchain.blockscout.com/tx/0x5f00bcfff55a3bb7651813fceb743e179d2cdacae1f03c93e30e262cfc2133ab

Deploy block: `59334164`
