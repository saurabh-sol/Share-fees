import { switchChain, getWalletClient, waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { ROBINHOOD_CHAIN_ID } from "@/lib/chains/robinhood";
import { usdgRewardVaultAbi, type OnChainClaimVoucher } from "@/lib/redeem/reward-vault-core";
import { wagmiConfig } from "@/lib/wallet/wagmi";

export async function submitUsdgRewardClaim(voucher: OnChainClaimVoucher) {
  // Force Robinhood Chain — claim gas must be paid in RH ETH, never mainnet.
  try {
    await switchChain(wagmiConfig, { chainId: ROBINHOOD_CHAIN_ID });
  } catch {
    const wc = await getWalletClient(wagmiConfig).catch(() => null);
    const cid = wc ? await wc.getChainId() : null;
    if (cid !== ROBINHOOD_CHAIN_ID) {
      throw new Error("Switch your wallet to Robinhood Chain (4663) to claim. Gas is paid in Robinhood ETH.");
    }
  }
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
