/**
 * Client-side Uniswap V3 swap execution via wagmi.
 * Handles: ERC-20 approval → SwapRouter02.exactInputSingle
 */
import {
  getWalletClient,
  readContract,
  writeContract,
  waitForTransactionReceipt,
  switchChain,
} from "wagmi/actions";
import { encodeFunctionData, type Hash } from "viem";
import { wagmiConfig } from "@/lib/wallet/wagmi";
import {
  SWAP_ROUTER_02,
  SWAP_ROUTER_ABI,
  ERC20_ABI,
  type UniswapChainId,
  type FeeTier,
} from "./constants";

export type UniswapSwapParams = {
  chainId: UniswapChainId;
  tokenIn: `0x${string}`;
  tokenOut: `0x${string}`;
  amountIn: string;
  amountOutMinimum: string;
  fee: FeeTier;
  recipient: `0x${string}`;
  isNativeIn: boolean;
  isNativeOut: boolean;
};

/**
 * Execute a Uniswap V3 swap.
 * 1. Switch to the correct chain if needed
 * 2. Approve the SwapRouter02 if input is ERC-20
 * 3. Call exactInputSingle
 * Returns the transaction hash.
 */
export async function executeUniswapSwap(
  params: UniswapSwapParams,
  onProgress?: (step: string) => void,
): Promise<Hash> {
  const routerAddress = SWAP_ROUTER_02[params.chainId];
  const amountIn = BigInt(params.amountIn);
  const amountOutMin = BigInt(params.amountOutMinimum);

  const currentChain = wagmiConfig.chains.find((c) => c.id === params.chainId);
  if (currentChain) {
    try {
      await switchChain(wagmiConfig, { chainId: params.chainId });
    } catch {
      /* already on the right chain */
    }
  }

  if (!params.isNativeIn) {
    onProgress?.("Checking token allowance…");
    const allowance = await readContract(wagmiConfig, {
      address: params.tokenIn,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [params.recipient, routerAddress],
      chainId: params.chainId,
    });

    if ((allowance as bigint) < amountIn) {
      onProgress?.("Approve token spend in your wallet…");
      const approveTx = await writeContract(wagmiConfig, {
        address: params.tokenIn,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [routerAddress, amountIn],
        chainId: params.chainId,
      });
      await waitForTransactionReceipt(wagmiConfig, {
        hash: approveTx,
        chainId: params.chainId,
        confirmations: 1,
      });
    }
  }

  onProgress?.("Confirm the swap in your wallet…");

  const deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60); // 20 min

  const swapCalldata = encodeFunctionData({
    abi: SWAP_ROUTER_ABI,
    functionName: "exactInputSingle",
    args: [
      {
        tokenIn: params.tokenIn,
        tokenOut: params.tokenOut,
        fee: params.fee,
        recipient: params.isNativeOut ? routerAddress : params.recipient,
        amountIn,
        amountOutMinimum: amountOutMin,
        sqrtPriceLimitX96: 0n,
      },
    ],
  });

  const walletClient = await getWalletClient(wagmiConfig, {
    chainId: params.chainId,
  });

  const txHash = await walletClient.sendTransaction({
    to: routerAddress,
    data: swapCalldata,
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
