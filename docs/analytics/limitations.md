# Analytics limitations

- **Start date:** On-chain public metrics begin at AccruedSwapRouter deploy (block `59334164`). Pre-router swaps are not backfilled.
- **Chain scope:** Robinhood Chain (4663) only for v1. LI.FI / ChangeNOW are excluded until routed through Accrued contracts.
- **Equity USD:** Tokenized stocks use catalog prices from redeem config, not live market feeds.
- **Dune decoding:** SQL table names may change after contract submission; update [`analytics/dune/canonical_swaps.sql`](../../analytics/dune/canonical_swaps.sql).
- **DeFiLlama PR:** Requires manual merge to [dimension-adapters](https://github.com/DefiLlama/dimension-adapters); adapters live in [`analytics/defillama/`](../../analytics/defillama/).
- **Marketing stats:** Homepage floors in `src/lib/stats/baseline.ts` are not used for Dune/DeFiLlama.
