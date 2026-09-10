# Accrued Dune analytics

## Contract submission

1. Open [dune.com/contracts/new](https://dune.com/contracts/new)
2. Chain: **Robinhood (4663)**
3. Submit **AccruedSwapRouter**: `0xc78e883f87675e75334df4d341f6fcb0915ebf19`
4. ABI: from [`contracts/AccruedSwapRouter.sol`](../../contracts/AccruedSwapRouter.sol) compiler output or [`ACCRUED_SWAP_ROUTER_ABI`](../../src/lib/uniswap/constants.ts)
5. Optional: **UsdgRewardVault** `0x991FA150A5Cf1680d41137a38bEAa9Eaa0eBE1db` for redeem analytics

After decoding, update table names in SQL if Dune names differ from `accruedswaprouter_evt_AccruedSwap`.

## Queries

| File | Purpose |
|------|---------|
| [`canonical_swaps.sql`](./canonical_swaps.sql) | One row per Accrued user trade — **build all charts from this** |
| [`total_volume.sql`](./queries/total_volume.sql) | All-time SUM(volume_usd) |
| [`volume_24h.sql`](./queries/volume_24h.sql) | Rolling 24h volume |
| [`daily_volume.sql`](./queries/daily_volume.sql) | Chart: date, daily_volume_usd |
| [`unique_traders.sql`](./queries/unique_traders.sql) | COUNT(DISTINCT user) |
| [`top_pairs.sql`](./queries/top_pairs.sql) | Top trading pairs |

## Dashboard

Create public dashboard **Accrued** on Dune:

1. KPI cards: total volume, 30d volume, total swaps, unique traders, fees ($0)
2. Daily volume chart ← `daily_volume.sql`
3. DAU chart ← extend canonical with date grouping
4. Top markets ← `top_pairs.sql`
5. Recent swaps table ← canonical ordered by block_time DESC LIMIT 50

Placeholder URL after publish: `https://dune.com/accrued/accrued` (update in footer when live).

## Reconciliation

Run before publishing:

```bash
node scripts/reconcile-dune-swaps.mjs
```
