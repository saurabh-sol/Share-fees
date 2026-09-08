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
  WRAPPED_NATIVE,
  CMD_V3_SWAP_EXACT_IN,
  CMD_WRAP_ETH,
  CMD_UNWRAP_WETH,
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
  needsWrapIn?: boolean;
  needsUnwrapOut?: boolean;
  /**
   * The route to execute.
   * - `single`    — one V4 pool via SWAP_EXACT_IN_SINGLE.
   * - `multi`     — V4 2+ hops via SWAP_EXACT_IN with PathKey chain.
   * - `v3-single` — one V3 pool via V3_SWAP_EXACT_IN packed path.
   * - `v3-multi`  — V3 2+ hops via packed path bytes.
   *
   * Legacy `poolKey` / `zeroForOne` fields on the top level are honored when
   * `route` is missing (backwards compat with older quote responses).
   */
  route?:
    | { type: "single"; poolKey: PoolKey; zeroForOne: boolean }
    | { type: "multi"; currencyIn: `0x${string}`; path: PathKey[] }
    | { type: "v3-single"; v3TokenIn: `0x${string}`; v3TokenOut: `0x${string}`; v3Fee: number }
    | { type: "v3-multi"; v3Path: `0x${string}` };
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
 * Pack a V3-style path: tokenA (20B) + fee (3B) + tokenB (20B) [+ fee + tokenC …]
 */
function packV3SinglePath(
  tokenIn: `0x${string}`,
  tokenOut: `0x${string}`,
  fee: number,
): `0x${string}` {
  const inHex = tokenIn.toLowerCase().slice(2);
  const feeHex = fee.toString(16).padStart(6, "0");
  const outHex = tokenOut.toLowerCase().slice(2);
  return `0x${inHex}${feeHex}${outHex}`;
}

/**
 * Execute a Uniswap swap via the Universal Router.
 * Supports V4 (single / multi), V3 (single / multi), and WRAP/UNWRAP for native ETH.
 * Returns the transaction hash.
 */
export async function executeUniswapSwap(
  params: UniswapSwapParams,
  onProgress?: (step: string) => void,
): Promise<Hash> {
  const route =
    params.route ??
    (params.poolKey
      ? {
          type: "single" as const,
          poolKey: params.poolKey,
          zeroForOne: Boolean(params.zeroForOne),
        }
      : null);

  if (!route) throw new Error("Swap route missing from quote.");

  const routerAddress = UNIVERSAL_ROUTER[params.chainId];
  const amountIn = BigInt(params.amountIn);
  const amountOutMin = BigInt(params.amountOutMinimum);
  const weth = WRAPPED_NATIVE[params.chainId];
  const needsWrap = params.needsWrapIn ?? false;
  const needsUnwrap = params.needsUnwrapOut ?? false;

  try {
    await switchChain(wagmiConfig, { chainId: params.chainId });
  } catch { /* already on the right chain */ }

  const isV3 = route.type === "v3-single" || route.type === "v3-multi";

  // ── Token approval ──
  if (!params.isNativeIn) {
    const approvalToken = isV3
      ? (route.type === "v3-single" ? route.v3TokenIn : weth)
      : route.type === "single"
        ? (route.zeroForOne ? route.poolKey.currency0 : route.poolKey.currency1)
        : route.currencyIn;

    await ensurePermit2Approval(
      approvalToken,
      routerAddress,
      amountIn,
      params.recipient,
      params.chainId,
      onProgress,
    );
  }

  onProgress?.("Encoding swap…");

  const commandBytes: number[] = [];
  const inputsArr: `0x${string}`[] = [];
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60);

  // ── WRAP_ETH (if native ETH → WETH route) ──
  if (needsWrap && params.isNativeIn) {
    commandBytes.push(CMD_WRAP_ETH);
    inputsArr.push(
      encodeAbiParameters(
        [{ type: "address" }, { type: "uint256" }],
        [routerAddress, amountIn],
      ),
    );
  }

  if (isV3) {
    // ── V3 swap ──
    const packedPath =
      route.type === "v3-single"
        ? packV3SinglePath(route.v3TokenIn, route.v3TokenOut, route.v3Fee)
        : route.v3Path;

    const swapRecipient = needsUnwrap ? routerAddress : params.recipient;
    const payerIsUser = !(needsWrap && params.isNativeIn);

    commandBytes.push(CMD_V3_SWAP_EXACT_IN);
    inputsArr.push(
      encodeAbiParameters(
        [
          { type: "address" },
          { type: "uint256" },
          { type: "uint256" },
          { type: "bytes" },
          { type: "bool" },
        ],
        [swapRecipient, amountIn, amountOutMin, packedPath, payerIsUser],
      ),
    );
  } else {
    // ── V4 swap ──
    const inputCurrency =
      route.type === "single"
        ? (route.zeroForOne ? route.poolKey.currency0 : route.poolKey.currency1)
        : route.currencyIn;
    const outputCurrency =
      route.type === "single"
        ? (route.zeroForOne ? route.poolKey.currency1 : route.poolKey.currency0)
        : route.path[route.path.length - 1].intermediateCurrency;

    const swapActionByte =
      route.type === "single" ? ACT_SWAP_EXACT_IN_SINGLE : ACT_SWAP_EXACT_IN;

    const actions = concat([
      numberToHex(swapActionByte, { size: 1 }),
      numberToHex(ACT_SETTLE_ALL, { size: 1 }),
      numberToHex(ACT_TAKE_ALL, { size: 1 }),
    ]);

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
      [needsUnwrap ? weth : outputCurrency, amountOutMin],
    );

    const v4SwapInput = encodeAbiParameters(
      [{ type: "bytes" }, { type: "bytes[]" }],
      [actions, [swapParam, settleParam, takeParam]],
    );

    commandBytes.push(CMD_V4_SWAP);
    inputsArr.push(v4SwapInput);
  }

  // ── UNWRAP_WETH (if route ends in WETH but user wants ETH) ──
  if (needsUnwrap) {
    commandBytes.push(CMD_UNWRAP_WETH);
    inputsArr.push(
      encodeAbiParameters(
        [{ type: "address" }, { type: "uint256" }],
        [params.recipient, amountOutMin],
      ),
    );
  }

  // ── Build the commands byte string ──
  let commands: `0x${string}` = "0x";
  for (const b of commandBytes) {
    commands = (commands + numberToHex(b, { size: 1 }).slice(2)) as `0x${string}`;
  }

  onProgress?.("Confirm the swap in your wallet…");

  const walletClient = await getWalletClient(wagmiConfig, { chainId: params.chainId });
  const sendValue = params.isNativeIn ? amountIn : 0n;

  const txHash = await walletClient.writeContract({
    address: routerAddress,
    abi: UNIVERSAL_ROUTER_ABI,
    functionName: "execute",
    args: [commands, inputsArr, deadline],
    value: sendValue,
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
