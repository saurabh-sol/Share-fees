/**
 * Uniswap V3 deployment addresses and chain configuration.
 * Addresses verified against https://docs.uniswap.org/contracts/v3/reference/deployments
 */

/** Uniswap V3 fee tiers (in hundredths of a bip). Try in order of popularity. */
export const FEE_TIERS = [3000, 500, 10000, 100] as const;
export type FeeTier = (typeof FEE_TIERS)[number];

/** Chains where Uniswap V3 is deployed and we support swaps. */
export const UNISWAP_CHAIN_IDS = [1, 10, 137, 42161, 8453, 56, 43114, 81457, 4663] as const;
export type UniswapChainId = (typeof UNISWAP_CHAIN_IDS)[number];

export function isUniswapChainId(value: number): value is UniswapChainId {
  return (UNISWAP_CHAIN_IDS as readonly number[]).includes(value);
}

/** Wrapped native token per chain. Uniswap V3 pools use WETH/WMATIC/etc. */
export const WRAPPED_NATIVE: Record<UniswapChainId, `0x${string}`> = {
  1: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",     // WETH (Ethereum)
  10: "0x4200000000000000000000000000000000000006",       // WETH (Optimism)
  137: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",    // WMATIC (Polygon)
  42161: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",   // WETH (Arbitrum)
  8453: "0x4200000000000000000000000000000000000006",     // WETH (Base)
  56: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",     // WBNB (BSC)
  43114: "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",   // WAVAX (Avalanche)
  81457: "0x4300000000000000000000000000000000000004",     // WETH (Blast)
  4663: "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73",    // WETH (Robinhood Chain)
};

/** QuoterV2 — same address on most standard deployments. */
export const QUOTER_V2: Record<UniswapChainId, `0x${string}`> = {
  1: "0x61fFE014bA17989E743c5F6cB21bF9697530B21e",
  10: "0x61fFE014bA17989E743c5F6cB21bF9697530B21e",
  137: "0x61fFE014bA17989E743c5F6cB21bF9697530B21e",
  42161: "0x61fFE014bA17989E743c5F6cB21bF9697530B21e",
  8453: "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a",
  56: "0x78D78E420Da98ad378D7799bE8f4AF69033EB077",
  43114: "0xbe0F5544EC67e9B3b2D979aaA43f18Fd87E6257F",
  81457: "0x61fFE014bA17989E743c5F6cB21bF9697530B21e",
  4663: "0x33e885eD0Ec9bF04EcfB19341582aADCb4c8A9E7",  // Robinhood Chain
};

/** SwapRouter02 — same on most chains. */
export const SWAP_ROUTER_02: Record<UniswapChainId, `0x${string}`> = {
  1: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45",
  10: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45",
  137: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45",
  42161: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45",
  8453: "0x2626664c2603336E57B271c5C0b26F421741e481",
  56: "0xB971eF87ede563556b2ED4b1C0b0019111Dd85d2",
  43114: "0xbb00FF08d01D300023C629E8fFfFcb65A5a578cE",
  81457: "0x549FEB8c9bd4c12Ad2AB27022dA12492aC452B66",
  4663: "0xCaf681a66D020601342297493863E78C959E5cb2",  // Robinhood Chain
};

export const NATIVE_ADDRESS = "0x0000000000000000000000000000000000000000";

/** ABI fragments for QuoterV2 and SwapRouter02. */
export const QUOTER_V2_ABI = [
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

export const SWAP_ROUTER_ABI = [
  {
    inputs: [
      {
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "recipient", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "amountOutMinimum", type: "uint256" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
        name: "params",
        type: "tuple",
      },
    ],
    name: "exactInputSingle",
    outputs: [{ name: "amountOut", type: "uint256" }],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [],
    name: "refundETH",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [{ name: "deadline", type: "uint256" }],
    name: "multicall",
    outputs: [{ name: "results", type: "bytes[]" }],
    stateMutability: "payable",
    type: "function",
  },
] as const;

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
