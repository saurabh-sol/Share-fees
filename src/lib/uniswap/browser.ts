/**
 * Client-side Uniswap V4 swap execution via Universal Router + Permit2.
 *
 * Flow:
 * 1. Switch chain if needed
 * 2. For ERC-20 input: approve Permit2, then Permit2 → approve Universal Router
 * 3. Encode a V4_SWAP command:
 *    - Single-hop → SWAP_EXACT_IN_SINGLE + SETTLE_ALL + TAKE_ALL
 *    - Multi-hop  → SWAP_EXACT_IN        + SETTLE_ALL + TAKE_ALL
 * 4. Execute via Universal Router
 */
import {
  readContract,
  writeContract,
  waitForTransactionReceipt,
  switchChain,
  getWalletClient,
} from "wagmi/actions";
import { encodeAbiParameters, concat, numberToHex, type Hash } from "viem";
import { wagmiConfig } from "@/lib/wallet/wagmi";
import {
  UNIVERSAL_ROUTER,
  UNIVERSAL_ROUTER_ABI,
  PERMIT2,
  PERMIT2_ABI,
  ERC20_ABI,
  NATIVE_ADDRESS,
  CMD_V4_SWAP,
  ACT_SWAP_EXACT_IN_SINGLE,
  ACT_SWAP_EXACT_IN,
  ACT_SETTLE_ALL,
  ACT_TAKE_ALL,
  type UniswapChainId,
  type PoolKey,
  type PathKey,
} from "./constants";

export type UniswapSwapParams = {
  chainId: UniswapChainId;
  amountIn: string;
  amountOutMinimum: string;
  recipient: `0x${string}`;
  isNativeIn: boolean;
  isNativeOut: boolean;
  /**
   * The route to execute.
   * - `single` — one pool via SWAP_EXACT_IN_SINGLE.
   * - `multi`  — 2+ hops via SWAP_EXACT_IN with a PathKey chain.
   *
   * Legacy `poolKey` / `zeroForOne` fields on the top level are honored when
   * `route` is missing (backwards compat with older quote responses).
   */
  route?:
    | { type: "single"; poolKey: PoolKey; zeroForOne: boolean }
    | { type: "multi"; currencyIn: `0x${string}`; path: PathKey[] };
  /** @deprecated Use `route` instead. Kept so older callers still work. */
  poolKey?: PoolKey;
  /** @deprecated Use `route` instead. Kept so older callers still work. */
  zeroForOne?: boolean;
};

/** Tuple type for the SWAP_EXACT_IN_SINGLE action params. */
const SWAP_SINGLE_PARAM_TYPES = [
  {
    type: "tuple",
    components: [
      {
        type: "tuple",
        name: "poolKey",
        components: [
          { type: "address", name: "currency0" },
          { type: "address", name: "currency1" },
          { type: "uint24", name: "fee" },
          { type: "int24", name: "tickSpacing" },
          { type: "address", name: "hooks" },
        ],
      },
      { type: "bool", name: "zeroForOne" },
      { type: "uint128", name: "amountIn" },
      { type: "uint128", name: "amountOutMinimum" },
      { type: "bytes", name: "hookData" },
    ],
  },
] as const;

/** Tuple type for the SWAP_EXACT_IN (multi-hop) action params. */
const SWAP_MULTI_PARAM_TYPES = [
  {
    type: "tuple",
    components: [
      { type: "address", name: "currencyIn" },
      {
        type: "tuple[]",
        name: "path",
        components: [
          { type: "address", name: "intermediateCurrency" },
          { type: "uint24", name: "fee" },
          { type: "int24", name: "tickSpacing" },
          { type: "address", name: "hooks" },
          { type: "bytes", name: "hookData" },
        ],
      },
      { type: "uint128", name: "amountIn" },
      { type: "uint128", name: "amountOutMinimum" },
    ],
  },
] as const;

/**
 * Execute a Uniswap V4 swap via the Universal Router.
 * Returns the transaction hash.
 */
export async function executeUniswapSwap(
  params: UniswapSwapParams,
  onProgress?: (step: string) => void,
): Promise<Hash> {
  // Resolve the route (support legacy shape).
  const route =
    params.route ??
    (params.poolKey
      ? {
          type: "single" as const,
          poolKey: params.poolKey,
          zeroForOne: Boolean(params.zeroForOne),
        }
      : null);

  if (!route) {
    throw new Error("Swap route missing from quote.");
  }

  const routerAddress = UNIVERSAL_ROUTER[params.chainId];
  const amountIn = BigInt(params.amountIn);
  const amountOutMin = BigInt(params.amountOutMinimum);

  try {
    await switchChain(wagmiConfig, { chainId: params.chainId });
  } catch {
    /* already on the right chain */
  }

  // What currency does the *user* pay in? For single-hop it's the pool's
  // zeroForOne side; for multi-hop it's the route's `currencyIn`.
  const inputCurrency =
    route.type === "single"
      ? route.zeroForOne
        ? route.poolKey.currency0
        : route.poolKey.currency1
      : route.currencyIn;

  // What currency does the user receive? Needed for the TAKE_ALL action.
  const outputCurrency =
    route.type === "single"
      ? route.zeroForOne
        ? route.poolKey.currency1
        : route.poolKey.currency0
      : route.path[route.path.length - 1].intermediateCurrency;

  if (!params.isNativeIn) {
    await ensurePermit2Approval(
      inputCurrency,
      routerAddress,
      amountIn,
      params.recipient,
      params.chainId,
      onProgress,
    );
  }

  onProgress?.("Encoding swap…");

  // Build the swap action bytes.
  const swapActionByte =
    route.type === "single"
      ? ACT_SWAP_EXACT_IN_SINGLE
      : ACT_SWAP_EXACT_IN;

  const actions = concat([
    numberToHex(swapActionByte, { size: 1 }),
    numberToHex(ACT_SETTLE_ALL, { size: 1 }),
    numberToHex(ACT_TAKE_ALL, { size: 1 }),
  ]);

  // Encode the swap params.
  const swapParam =
    route.type === "single"
      ? encodeAbiParameters(SWAP_SINGLE_PARAM_TYPES, [
          {
            poolKey: {
              currency0: route.poolKey.currency0,
              currency1: route.poolKey.currency1,
              fee: route.poolKey.fee,
              tickSpacing: route.poolKey.tickSpacing,
              hooks: route.poolKey.hooks,
            },
            zeroForOne: route.zeroForOne,
            amountIn,
            amountOutMinimum: amountOutMin,
            hookData: "0x" as `0x${string}`,
          },
        ])
      : encodeAbiParameters(SWAP_MULTI_PARAM_TYPES, [
          {
            currencyIn: route.currencyIn,
            path: route.path.map((p) => ({
              intermediateCurrency: p.intermediateCurrency,
              fee: p.fee,
              tickSpacing: p.tickSpacing,
              hooks: p.hooks,
              hookData: p.hookData,
            })),
            amountIn,
            amountOutMinimum: amountOutMin,
          },
        ]);

  const settleParam = encodeAbiParameters(
    [{ type: "address" }, { type: "uint256" }],
    [inputCurrency, amountIn],
  );

  const takeParam = encodeAbiParameters(
    [{ type: "address" }, { type: "uint256" }],
    [outputCurrency, amountOutMin],
  );

  const v4SwapInput = encodeAbiParameters(
    [{ type: "bytes" }, { type: "bytes[]" }],
    [actions, [swapParam, settleParam, takeParam]],
  );

  const commands = numberToHex(CMD_V4_SWAP, { size: 1 });

  const deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60);

  onProgress?.("Confirm the swap in your wallet…");

  const walletClient = await getWalletClient(wagmiConfig, {
    chainId: params.chainId,
  });

  const txHash = await walletClient.writeContract({
    address: routerAddress,
    abi: UNIVERSAL_ROUTER_ABI,
    functionName: "execute",
    args: [commands, [v4SwapInput], deadline],
    value: params.isNativeIn ? amountIn : 0n,
    chain: wagmiConfig.chains.find((c) => c.id === params.chainId),
  });

  onProgress?.("Waiting for confirmation…");
  await waitForTransactionReceipt(wagmiConfig, {
    hash: txHash,
    chainId: params.chainId,
    confirmations: 1,
  });

  return txHash;
}

/**
 * Ensure the Universal Router is approved to spend user's ERC-20 via Permit2.
 * Two-step approval: ERC-20 → Permit2 → Universal Router.
 */
async function ensurePermit2Approval(
  token: `0x${string}`,
  router: `0x${string}`,
  amount: bigint,
  owner: `0x${string}`,
  chainId: UniswapChainId,
  onProgress?: (step: string) => void,
) {
  // Native ETH doesn't need Permit2. Sanity guard.
  if (token.toLowerCase() === NATIVE_ADDRESS.toLowerCase()) return;

  onProgress?.("Checking token allowance…");

  const erc20Allowance = (await readContract(wagmiConfig, {
    address: token,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [owner, PERMIT2],
    chainId,
  })) as bigint;

  if (erc20Allowance < amount) {
    onProgress?.("Approve Permit2 in your wallet…");
    const approveTx = await writeContract(wagmiConfig, {
      address: token,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [PERMIT2, BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")],
      chainId,
    });
    await waitForTransactionReceipt(wagmiConfig, {
      hash: approveTx,
      chainId,
      confirmations: 1,
    });
  }

  const permit2Allowance = (await readContract(wagmiConfig, {
    address: PERMIT2,
    abi: PERMIT2_ABI,
    functionName: "allowance",
    args: [owner, token, router],
    chainId,
  })) as readonly [bigint, number, number];

  const currentAmount = permit2Allowance[0];
  const expiration = permit2Allowance[1];
  const now = Math.floor(Date.now() / 1000);

  if (currentAmount < amount || expiration <= now) {
    onProgress?.("Approve Universal Router on Permit2…");
    const maxUint160 = BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF");
    const futureExpiry = now + 30 * 24 * 60 * 60; // 30 days
    const permit2Tx = await writeContract(wagmiConfig, {
      address: PERMIT2,
      abi: PERMIT2_ABI,
      functionName: "approve",
      args: [token, router, maxUint160, futureExpiry],
      chainId,
    });
    await waitForTransactionReceipt(wagmiConfig, {
      hash: permit2Tx,
      chainId,
      confirmations: 1,
    });
  }
}
