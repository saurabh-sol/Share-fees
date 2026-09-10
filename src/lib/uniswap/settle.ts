/**
 * Server-side Uniswap swap verification.
 * Prefers AccruedSwap events from AccruedSwapRouter; falls back to legacy router parsing.
 */
import { createPublicClient, decodeEventLog, http, type Chain } from "viem";
import { mainnet, optimism, polygon, arbitrum, base, bsc, avalanche } from "viem/chains";
import { env } from "@/lib/env";
import { robinhoodChain } from "@/lib/chains/robinhood";
import {
  ACCRUED_SWAP_ROUTER_ABI,
  UNIVERSAL_ROUTER,
  V3_SWAP_ROUTER_02,
  WRAPPED_NATIVE,
  NATIVE_ADDRESS,
  type UniswapChainId,
} from "./constants";
import { addressesEqual } from "@/lib/lifi/notional";

const CHAIN_MAP: Record<UniswapChainId, Chain> = {
  1: mainnet,
  10: optimism,
  137: polygon,
  42161: arbitrum,
  8453: base,
  56: bsc,
  43114: avalanche,
  4663: robinhoodChain,
};

const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

export type VerifiedUniswapFill = {
  kind: "done";
  txHash: string;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  notionalUsdCents: number;
};

export type UniswapSettleResult =
  | VerifiedUniswapFill
  | { kind: "pending" };

function accruedRouterForChain(chainId: UniswapChainId): `0x${string}` | undefined {
  if (chainId !== 4663) return undefined;
  const raw = env.accruedSwapRouterAddress?.trim();
  if (!raw || !/^0x[0-9a-fA-F]{40}$/.test(raw)) return undefined;
  return raw as `0x${string}`;
}

function normalizeTokenAddress(token: string, wrappedNative: string) {
  if (token === "0x0000000000000000000000000000000000000000") {
    return NATIVE_ADDRESS;
  }
  if (addressesEqual(token, wrappedNative)) {
    return wrappedNative;
  }
  return token;
}

function parseAccruedSwapLog(
  logs: Array<{ address: string; topics: readonly `0x${string}`[]; data: `0x${string}` }>,
  router: string,
  sessionAddress: string,
  wrappedNative: string,
) {
  for (const log of logs) {
    if (!addressesEqual(log.address, router)) continue;
    try {
      const decoded = decodeEventLog({
        abi: ACCRUED_SWAP_ROUTER_ABI,
        eventName: "AccruedSwap",
        topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
        data: log.data,
      });
      if (!addressesEqual(decoded.args.user, sessionAddress)) {
        throw new UniswapSettleError(
          "AccruedSwap user does not match your session address.",
          403,
        );
      }
      return {
        fromToken: normalizeTokenAddress(decoded.args.tokenIn, wrappedNative),
        toToken: normalizeTokenAddress(decoded.args.tokenOut, wrappedNative),
        fromAmount: decoded.args.amountIn.toString(),
        toAmount: decoded.args.amountOut.toString(),
      };
    } catch (error) {
      if (error instanceof UniswapSettleError) throw error;
    }
  }
  return null;
}

export async function verifyUniswapFill(input: {
  txHash: string;
  chainId: UniswapChainId;
  sessionAddress: string;
  expectedFromToken: string;
  expectedToToken: string;
  expectedNotionalCents: number;
}): Promise<UniswapSettleResult> {
  const chain = CHAIN_MAP[input.chainId];
  const client = createPublicClient({
    chain,
    transport: http(undefined, { timeout: 20_000 }),
  });

  const routerAddress = UNIVERSAL_ROUTER[input.chainId];
  const wrappedNative = WRAPPED_NATIVE[input.chainId];
  const accruedRouter = accruedRouterForChain(input.chainId);

  let receipt;
  try {
    receipt = await client.getTransactionReceipt({
      hash: input.txHash as `0x${string}`,
    });
  } catch {
    return { kind: "pending" };
  }

  if (!receipt || receipt.status !== "success") {
    return { kind: "pending" };
  }

  if (!addressesEqual(receipt.from, input.sessionAddress)) {
    throw new UniswapSettleError(
      "Transaction sender does not match your session address.",
      403,
    );
  }

  const tx = await client.getTransaction({
    hash: input.txHash as `0x${string}`,
  });

  const swapRouter02 = V3_SWAP_ROUTER_02[input.chainId];
  const toAccrued = accruedRouter != null && addressesEqual(tx.to ?? "", accruedRouter);
  const toLegacyRouter =
    addressesEqual(tx.to ?? "", routerAddress) ||
    (swapRouter02 != null && addressesEqual(tx.to ?? "", swapRouter02));

  if (accruedRouter && !toAccrued && !toLegacyRouter) {
    throw new UniswapSettleError(
      "Swap must go through AccruedSwapRouter for attribution.",
      400,
    );
  }

  if (!toAccrued && !toLegacyRouter) {
    throw new UniswapSettleError(
      "Transaction was not sent to a known Uniswap or Accrued router.",
      400,
    );
  }

  if (toAccrued && accruedRouter) {
    const fromEvent = parseAccruedSwapLog(receipt.logs, accruedRouter, input.sessionAddress, wrappedNative);
    if (fromEvent) {
      return {
        kind: "done",
        txHash: input.txHash,
        fromToken: fromEvent.fromToken,
        toToken: fromEvent.toToken,
        fromAmount: fromEvent.fromAmount,
        toAmount: fromEvent.toAmount,
        notionalUsdCents: input.expectedNotionalCents,
      };
    }
    throw new UniswapSettleError("AccruedSwap event not found in transaction receipt.", 400);
  }

  let fromAmount = "0";
  let toAmount = "0";
  let fromToken = input.expectedFromToken;
  let toToken = input.expectedToToken;

  const isNativeIn = input.expectedFromToken.toLowerCase() === NATIVE_ADDRESS.toLowerCase();
  const isNativeOut = input.expectedToToken.toLowerCase() === NATIVE_ADDRESS.toLowerCase();

  const transfers = receipt.logs
    .map((log) => {
      try {
        if (log.topics[0] === TRANSFER_TOPIC) {
          const from_ = ("0x" + (log.topics[1] ?? "").slice(26)) as `0x${string}`;
          const to_ = ("0x" + (log.topics[2] ?? "").slice(26)) as `0x${string}`;
          const value_ = BigInt(log.data);
          return { from: from_, to: to_, value: value_, address: log.address };
        }
      } catch {
        /* skip non-Transfer */
      }
      return null;
    })
    .filter(Boolean) as Array<{ from: `0x${string}`; to: `0x${string}`; value: bigint; address: `0x${string}` }>;

  if (isNativeIn) {
    fromAmount = tx.value.toString();
    fromToken = NATIVE_ADDRESS;
    const outTransfer =
      transfers.find(
        (t) =>
          addressesEqual(t.to, input.sessionAddress) &&
          !addressesEqual(t.address, wrappedNative),
      ) ?? transfers.find((t) => addressesEqual(t.to, input.sessionAddress));
    if (outTransfer) {
      toAmount = outTransfer.value.toString();
      toToken = outTransfer.address;
    }
  } else if (isNativeOut) {
    const inTransfer = transfers.find((t) => addressesEqual(t.from, input.sessionAddress));
    if (inTransfer) {
      fromAmount = inTransfer.value.toString();
      fromToken = inTransfer.address;
    }
    const wethOutTransfer = transfers.find(
      (t) =>
        addressesEqual(t.address, wrappedNative) &&
        addressesEqual(t.to, input.sessionAddress),
    );
    if (wethOutTransfer) {
      toAmount = wethOutTransfer.value.toString();
    } else {
      toAmount = tx.value.toString();
    }
    toToken = NATIVE_ADDRESS;
  } else {
    const inTransfer = transfers.find((t) => addressesEqual(t.from, input.sessionAddress));
    const outTransfer = transfers.find(
      (t) =>
        addressesEqual(t.to, input.sessionAddress) &&
        !addressesEqual(t.from, input.sessionAddress),
    );
    if (inTransfer) {
      fromAmount = inTransfer.value.toString();
      fromToken = inTransfer.address;
    }
    if (outTransfer) {
      toAmount = outTransfer.value.toString();
      toToken = outTransfer.address;
    }
  }

  return {
    kind: "done",
    txHash: input.txHash,
    fromToken,
    toToken,
    fromAmount,
    toAmount,
    notionalUsdCents: input.expectedNotionalCents,
  };
}

export class UniswapSettleError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "UniswapSettleError";
    this.status = status;
  }
}
