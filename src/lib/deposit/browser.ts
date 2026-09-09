import { erc20Abi } from "viem";
import { switchChain, waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { ROBINHOOD_CHAIN_ID } from "@/lib/chains/robinhood";
import { wagmiConfig } from "@/lib/wallet/wagmi";

export async function sendAccrDeposit(input: {
  tokenAddress: `0x${string}`;
  recipient: `0x${string}`;
  amount: bigint;
}) {
  await switchChain(wagmiConfig, { chainId: ROBINHOOD_CHAIN_ID });

  const hash = await writeContract(wagmiConfig, {
    chainId: ROBINHOOD_CHAIN_ID,
    address: input.tokenAddress,
    abi: erc20Abi,
    functionName: "transfer",
    args: [input.recipient, input.amount],
  });

  await waitForTransactionReceipt(wagmiConfig, { hash, chainId: ROBINHOOD_CHAIN_ID });
  return hash;
}
