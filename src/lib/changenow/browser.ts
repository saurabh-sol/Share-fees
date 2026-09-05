import { erc20Abi, parseUnits } from "viem";
import { sendTransaction, switchChain, waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { wagmiConfig } from "@/lib/wallet/wagmi";
import { isNativeToken } from "./assets";

export async function sendChangeNowDeposit(input: {
  fromChainId: number;
  tokenAddress: string;
  payinAddress: `0x${string}`;
  humanAmount: string;
  decimals?: number;
}) {
  const supported = wagmiConfig.chains.find((chain) => chain.id === input.fromChainId);
  if (!supported) {
    throw new Error(`unsupported_switch_chain:${input.fromChainId}`);
  }
  await switchChain(wagmiConfig, { chainId: supported.id });
  const decimals = input.decimals ?? 18;
  const value = parseUnits(input.humanAmount, decimals);

  const hash = isNativeToken(input.tokenAddress)
    ? await sendTransaction(wagmiConfig, {
        chainId: supported.id,
        to: input.payinAddress,
        value,
      })
    : await writeContract(wagmiConfig, {
        chainId: supported.id,
        address: input.tokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: "transfer",
        args: [input.payinAddress, value],
      });

  await waitForTransactionReceipt(wagmiConfig, { hash, chainId: supported.id });
  return hash;
}
