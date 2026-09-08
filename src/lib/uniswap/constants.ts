/**
 * Uniswap V4 deployment addresses and chain configuration.
 * V4 uses a singleton PoolManager, V4Quoter, Universal Router, and Permit2.
 * Addresses from https://developers.uniswap.org/docs/protocols/v4/deployments
 */

/**
 * V4 pool configs: (fee in hundredths of a bip, tickSpacing).
 * We try each in order and keep the best quote.
 *
 * Order matters — most common combos first. Robinhood Chain's pools.trade
 * launchpad uses `2500 / 25` (0.25%, native-ETH-quoted), so we include that
 * plus the classic mainnet set.
 */
export const V4_POOL_CONFIGS = [
  { fee: 3000, tickSpacing: 60 },   // 0.30% — mainnet most common
  { fee: 500, tickSpacing: 10 },    // 0.05% — popular for majors / stables
  { fee: 2500, tickSpacing: 25 },   // 0.25% — Robinhood pools.trade current
  { fee: 2500, tickSpacing: 60 },   // 0.25% — Robinhood pools.trade original
  { fee: 10000, tickSpacing: 200 }, // 1.00% — exotic pairs
  { fee: 100, tickSpacing: 1 },     // 0.01% — stablecoin ↔ stablecoin
  { fee: 1000, tickSpacing: 20 },   // 0.10% — mid-fee configs
  { fee: 500, tickSpacing: 60 },    // 0.05% wide
  { fee: 3000, tickSpacing: 200 },  // 0.30% wide
] as const;
export type PoolConfig = (typeof V4_POOL_CONFIGS)[number];

/** Chains where Uniswap V4 is deployed and we support swaps. */
export const UNISWAP_CHAIN_IDS = [1, 10, 137, 42161, 8453, 56, 43114, 4663] as const;
export type UniswapChainId = (typeof UNISWAP_CHAIN_IDS)[number];

export function isUniswapChainId(value: number): value is UniswapChainId {
  return (UNISWAP_CHAIN_IDS as readonly number[]).includes(value);
}

/** Wrapped native token per chain. Used for display and fallback pool matching. */
export const WRAPPED_NATIVE: Record<UniswapChainId, `0x${string}`> = {
  1: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  10: "0x4200000000000000000000000000000000000006",
  137: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
  42161: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
  8453: "0x4200000000000000000000000000000000000006",
  56: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
  43114: "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
  4663: "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73",
};

/** V4 Quoter (V4Quoter) per chain. */
export const V4_QUOTER: Record<UniswapChainId, `0x${string}`> = {
  1: "0x52f0e24d1c21c8a0cb1e5a5dd6198556bd9e1203",
  10: "0x1f3131a13296fb91c90870043742c3cdbff1a8d7",
  137: "0xb3d5c3dfc3a7aebff71895a7191796bffc2c81b9",
  42161: "0x3972c00f7ed4885e145823eb7c655375d275a1c5",
  8453: "0x0d5e0f971ed27fbff6c2837bf31316121532048d",
  56: "0x9f75dd27d6664c475b90e105573e550ff69437b0",
  43114: "0xbe40675bb704506a3c2ccfb762dcfd1e979845c2",
  4663: "0x8Dc178eFB8111BB0973Dd9d722ebeFF267c98F94",
};

/** Universal Router per chain — supports V2, V3, and V4 pool swaps. */
export const UNIVERSAL_ROUTER: Record<UniswapChainId, `0x${string}`> = {
  1: "0x66a9893cc07d91d95644aedd05d03f95e1dba8af",
  10: "0x851116d9223fabed8e56c0e6b8ad0c31d98b3507",
  137: "0x1095692a6237d83c6a72f3f5efedb9a670c49223",
  42161: "0xa51afafe0263b40edaef0df8781ea9aa03e381a3",
  8453: "0x6ff5693b99212da76ad316178a184ab56d299b43",
  56: "0x1906c1d672b88cd1b9ac7593301ca990f94eae07",
  43114: "0x94b75331ae8d42c1b61065089b7d48fe14aa73b7",
  4663: "0x8876789976decbfcbbbe364623c63652db8c0904",
};

/** Permit2 — same canonical address on every chain. */
export const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3" as `0x${string}`;

export const NATIVE_ADDRESS = "0x0000000000000000000000000000000000000000" as `0x${string}`;
export const ZERO_HOOKS = "0x0000000000000000000000000000000000000000" as `0x${string}`;

/* ─── V3 QuoterV2 per chain (null = not deployed) ─── */
export const V3_QUOTER: Partial<Record<UniswapChainId, `0x${string}`>> = {
  4663: "0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7",
};

/** V3 fee tiers — try all four to discover any pool. */
export const V3_FEE_TIERS = [100, 500, 3000, 10000] as const;

/* ─── Universal Router command bytes ─── */
export const CMD_V3_SWAP_EXACT_IN = 0x00;
export const CMD_WRAP_ETH = 0x0b;
export const CMD_UNWRAP_WETH = 0x0c;
export const CMD_V4_SWAP = 0x10;

/* ─── V4Router action bytes ─── */
export const ACT_SWAP_EXACT_IN_SINGLE = 0x06;
export const ACT_SWAP_EXACT_IN = 0x07;
export const ACT_SETTLE_ALL = 0x0c;
export const ACT_TAKE_ALL = 0x0d;

/* ─── Sorted pool key helper ─── */
export type PoolKey = {
  currency0: `0x${string}`;
  currency1: `0x${string}`;
  fee: number;
  tickSpacing: number;
  hooks: `0x${string}`;
};

/**
 * V4 PathKey — one hop in a multi-hop path.
 * `intermediateCurrency` is the token that comes OUT of this hop
 * (the input of the *next* hop, or the final `toToken` for the last hop).
 */
export type PathKey = {
  intermediateCurrency: `0x${string}`;
  fee: number;
  tickSpacing: number;
  hooks: `0x${string}`;
  hookData: `0x${string}`;
};

export function sortCurrencies(
  tokenA: `0x${string}`,
  tokenB: `0x${string}`,
): { currency0: `0x${string}`; currency1: `0x${string}`; zeroForOne: boolean } {
  const a = BigInt(tokenA);
  const b = BigInt(tokenB);
  if (a < b) return { currency0: tokenA, currency1: tokenB, zeroForOne: true };
  return { currency0: tokenB, currency1: tokenA, zeroForOne: false };
}

/* ─── ABI: V4 Quoter — quoteExactInputSingle + quoteExactInput (multi-hop) ─── */
export const V4_QUOTER_ABI = [
  {
    inputs: [
      {
        components: [
          {
            components: [
              { name: "currency0", type: "address" },
              { name: "currency1", type: "address" },
              { name: "fee", type: "uint24" },
              { name: "tickSpacing", type: "int24" },
              { name: "hooks", type: "address" },
            ],
            name: "poolKey",
            type: "tuple",
          },
          { name: "zeroForOne", type: "bool" },
          { name: "exactAmount", type: "uint128" },
          { name: "hookData", type: "bytes" },
        ],
        name: "params",
        type: "tuple",
      },
    ],
    name: "quoteExactInputSingle",
    outputs: [
      { name: "deltaAmounts", type: "int128[]" },
      { name: "sqrtPriceX96After", type: "uint160" },
      { name: "initializedTicksCrossed", type: "uint32" },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          { name: "exactCurrency", type: "address" },
          {
            components: [
              { name: "intermediateCurrency", type: "address" },
              { name: "fee", type: "uint24" },
              { name: "tickSpacing", type: "int24" },
              { name: "hooks", type: "address" },
              { name: "hookData", type: "bytes" },
            ],
            name: "path",
            type: "tuple[]",
          },
          { name: "exactAmount", type: "uint128" },
        ],
        name: "params",
        type: "tuple",
      },
    ],
    name: "quoteExactInput",
    outputs: [
      { name: "amountOut", type: "uint256" },
      { name: "gasEstimate", type: "uint256" },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

/* ─── ABI: Universal Router execute ─── */
export const UNIVERSAL_ROUTER_ABI = [
  {
    inputs: [
      { name: "commands", type: "bytes" },
      { name: "inputs", type: "bytes[]" },
      { name: "deadline", type: "uint256" },
    ],
    name: "execute",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
] as const;

/* ─── ABI: Permit2 ─── */
export const PERMIT2_ABI = [
  {
    inputs: [
      { name: "token", type: "address" },
      { name: "spender", type: "address" },
      { name: "amount", type: "uint160" },
      { name: "expiration", type: "uint48" },
    ],
    name: "approve",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "token", type: "address" },
      { name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [
      { name: "amount", type: "uint160" },
      { name: "expiration", type: "uint48" },
      { name: "nonce", type: "uint48" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

/* ─── ABI: V3 QuoterV2 — quoteExactInputSingle ─── */
export const V3_QUOTER_ABI = [
  {
    inputs: [
      {
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "fee", type: "uint24" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
        name: "params",
        type: "tuple",
      },
    ],
    name: "quoteExactInputSingle",
    outputs: [
      { name: "amountOut", type: "uint256" },
      { name: "sqrtPriceX96After", type: "uint160" },
      { name: "initializedTicksCrossed", type: "uint32" },
      { name: "gasEstimate", type: "uint256" },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

/* ─── ABI: ERC-20 approve + allowance ─── */
export const ERC20_ABI = [
  {
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;
