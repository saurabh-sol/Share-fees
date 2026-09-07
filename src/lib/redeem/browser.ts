import { switchChain, waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { ROBINHOOD_CHAIN_ID } from "@/lib/chains/robinhood";
import { usdgRewardVaultAbi, type OnChainClaimVoucher } from "@/lib/redeem/reward-vault-core";
import { wagmiConfig } from "@/lib/wallet/wagmi";

export async function submitUsdgRewardClaim(voucher: OnChainClaimVoucher) {
  await switchChain(wagmiConfig, { chainId: ROBINHOOD_CHAIN_ID });
  const hash = await writeContract(wagmiConfig, {
    chainId: ROBINHOOD_CHAIN_ID,
    address: voucher.vault,
    abi: usdgRewardVaultAbi,
    functionName: "claim",
    args: [voucher.redemptionId, BigInt(voucher.amount), BigInt(voucher.deadline), voucher.signature],
  });
  await waitForTransactionReceipt(wagmiConfig, { hash, chainId: ROBINHOOD_CHAIN_ID });
  return hash;
}
