# Accrued swap attribution

How Accrued swaps execute on-chain and how volume is attributed for Dune and DeFiLlama.

## Live flow (post AccruedSwapRouter)

```
User wallet
    → Accrued Frontend (/app/swap)
    → AccruedSwapRouter (emits AccruedSwap)
    → Uniswap V3 SwapRouter02
    → Liquidity pool
    → POST /api/v1/swaps/settle (session + event verification)
    → Postgres swaps table
```

## Legacy flow (pre-router, not counted in public analytics)

```
User wallet → SwapRouter02 directly → pool
```

Legacy fills may still settle via transfer-log parsing when `ACCRUED_SWAP_ROUTER_ADDRESS` was unset at settle time.

## Contract addresses (Robinhood Chain, 4663)

| Role | Address |
|------|---------|
| **AccruedSwapRouter** | `0xc78e883f87675e75334df4d341f6fcb0915ebf19` |
| UsdgRewardVault | `0x991FA150A5Cf1680d41137a38bEAa9Eaa0eBE1db` |
| $ACCR token | `0x85aCab234fce5d5287a7C24807A317581160420B` |
| V3 SwapRouter02 | `0xcaf681a66d020601342297493863e78c959e5cb2` |
| Universal Router | `0x8876789976decbfcbbbe364623c63652db8c0904` |
| WETH | `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73` |
| USDG | `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` |
| USDT | `0xE246BC49b0598d7Cd9f0eAD48B885034f1254380` |

## AccruedSwap event

```solidity
event AccruedSwap(
    address indexed user,
    address indexed tokenIn,
    address indexed tokenOut,
    uint256 amountIn,
    uint256 amountOut,
    address recipient
);
```

- **user** = `msg.sender` (trader wallet, never the router)
- **amountIn / amountOut** = user-facing leg at the router boundary (one row per trade)
- No USD values on-chain; USD computed in analytics per [usd-methodology.md](./usd-methodology.md)

## Per-field attribution

| Field | Legacy | Post-router |
|-------|--------|-------------|
| `tx.from` | User wallet | User wallet |
| `tx.to` | SwapRouter02 or UR | AccruedSwapRouter |
| tokenIn / tokenOut | Transfer log heuristics | `AccruedSwap` event |
| Public analytics | Not attributable | Dune + DeFiLlama index `AccruedSwap` only |

## What does NOT count as Accrued volume

- Uniswap swaps on Robinhood that bypass AccruedSwapRouter
- LI.FI / ChangeNOW flows (off-chain partner attribution only until routed through Accrued contracts)
- Internal Uniswap routing hops (one user trade = one `AccruedSwap` row)
- Router or SwapRouter02 addresses as `user`

## Deploy

```bash
TREASURY_PRIVATE_KEY=0x... npx tsx scripts/deploy-accrued-swap-router.ts
```

Set `ACCRUED_SWAP_ROUTER_ADDRESS` in production env after deploy.
