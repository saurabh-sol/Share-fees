# DeFiLlama dimension-adapters

## Metadata

| Field | Value |
|-------|-------|
| Protocol | Accrued |
| Website | https://accrued.trade |
| Chain | Robinhood (4663) |
| Category | DEX Aggregator |
| Router | `0xc78e883f87675e75334df4d341f6fcb0915ebf19` |

## PR steps

1. Fork https://github.com/DefiLlama/dimension-adapters
2. Copy [`dexs/accrued.ts`](./dexs/accrued.ts) → `dexs/accrued.ts`
3. Copy [`fees/accrued.ts`](./fees/accrued.ts) → `fees/accrued.ts`
4. Set `START_BLOCK` in both files to AccruedSwapRouter deploy block
5. Export in `dexs/index.ts` and `fees/index.ts` per repo conventions
6. Test: `npm test` / adapter test commands in dimension-adapters README
7. Compare daily volume vs Dune `daily_volume.sql` for 3+ dates
8. Open PR — see [`PR_BODY.md`](./PR_BODY.md)

Or run from repo root:

```bash
./scripts/prepare-defillama-pr.sh
```
