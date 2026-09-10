# Accrued Dune analytics

## Cursor MCP (optional)

Add to `.cursor/mcp.json` (project) or `~/.cursor/mcp.json` (global):

```json
{
  "mcpServers": {
    "dune": {
      "url": "https://api.dune.com/mcp/v1"
    }
  }
}
```

Restart Cursor → **Customize → MCP** → connect **dune** (OAuth browser login), or add API key auth:

```json
"headers": { "X-DUNE-API-KEY": "${env:DUNE_API_KEY}" }
```

Then ask the agent to create queries from the SQL files below and publish the dashboard.

## Contract submission

1. Open [dune.com/contracts/new](https://dune.com/contracts/new)
2. Chain: **Robinhood (4663)**
3. Submit **AccruedSwapRouter**: `0xc78e883f87675e75334df4d341f6fcb0915ebf19`
4. ABI: from [`contracts/AccruedSwapRouter.sol`](../../contracts/AccruedSwapRouter.sol) compiler output or [`ACCRUED_SWAP_ROUTER_ABI`](../../src/lib/uniswap/constants.ts)
5. Optional: **UsdgRewardVault** `0x991FA150A5Cf1680d41137a38bEAa9Eaa0eBE1db` for redeem analytics

**Query note:** `canonical_swaps.sql` reads `robinhood.logs` directly (no decoded table required). After contract decode finishes, you can switch to `robinhood.accruedswaprouter_evt_AccruedSwap` if Dune creates it — confirm the exact name in Data Explorer.

## Queries

### Live on Dune

| Query | ID | URL |
|------|-----|-----|
| Accrued Canonical Swaps | 8666293 | https://dune.com/queries/8666293 |
| Total Volume | 8666303 | https://dune.com/queries/8666303 |
| Volume 24h | 8666304 | https://dune.com/queries/8666304 |
| Volume 30d | 8666305 | https://dune.com/queries/8666305 |
| Daily Volume | 8666306 | https://dune.com/queries/8666306 |
| Unique Traders | 8666307 | https://dune.com/queries/8666307 |
| Total Swaps | 8666308 | https://dune.com/queries/8666308 |
| Top Pairs | 8666313 | https://dune.com/queries/8666313 |
| Daily Active Traders | 8666346 | https://dune.com/queries/8666346 |
| Recent Swaps | 8666356 | https://dune.com/queries/8666356 |
| Protocol Fees | 8666372 | https://dune.com/queries/8666372 |

Child queries use Dune’s [Query View](https://docs.dune.com/query-engine/query-a-query) syntax: `FROM query_8666293`.

### Source SQL (repo)

| File | Purpose |
|------|---------|
| [`canonical_swaps.sql`](./canonical_swaps.sql) | One row per Accrued user trade |
| [`total_volume.sql`](./queries/total_volume.sql) | All-time SUM(volume_usd) |
| [`volume_24h.sql`](./queries/volume_24h.sql) | Rolling 24h volume |
| [`daily_volume.sql`](./queries/daily_volume.sql) | Chart: date, daily_volume_usd |
| [`unique_traders.sql`](./queries/unique_traders.sql) | COUNT(DISTINCT user) |
| [`top_pairs.sql`](./queries/top_pairs.sql) | Top trading pairs |

## Dashboard

Public dashboard: **https://dune.com/accured/accrued** (ID 219961)

KPIs: total volume, 30d volume, swaps, unique traders, protocol fees ($0). Charts: daily volume, DAU. Tables: top pairs, recent swaps.

Metrics are empty until swaps route through AccruedSwapRouter post-deploy.

## Reconciliation

Run before publishing:

```bash
node scripts/reconcile-dune-swaps.mjs
```
