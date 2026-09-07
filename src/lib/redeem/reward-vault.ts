import { createPublicClient, getAddress, http, isAddress, parseAbiItem } from "viem";
import { robinhoodChain } from "@/lib/chains/robinhood";
import { env } from "@/lib/env";
import {
  redemptionClaimId,
  usdgRewardVaultAbi,
  usdgUnitsToCents,
  type OnChainRewardClaim,
} from "@/lib/redeem/reward-vault-core";

export * from "@/lib/redeem/reward-vault-core";

const rewardClaimedEvent = parseAbiItem(
  "event RewardClaimed(bytes32 indexed claimId, address indexed recipient, uint256 amount, string redemptionId)",
);

export function getRewardVaultAddress(): `0x${string}` | null {
  const raw = env.rewardVaultAddress?.trim();
  if (!raw || !isAddress(raw)) return null;
  return getAddress(raw);
}

export function robinhoodPublicClient() {
  return createPublicClient({ chain: robinhoodChain, transport: http() });
}

export async function isRedemptionClaimedOnChain(redemptionId: string): Promise<boolean> {
  const vault = getRewardVaultAddress();
  if (!vault) return false;
  const client = robinhoodPublicClient();
  return client.readContract({
    address: vault,
    abi: usdgRewardVaultAbi,
    functionName: "claimed",
    args: [redemptionClaimId(redemptionId)],
  });
}

export async function listOnChainClaims(recipient: string): Promise<OnChainRewardClaim[]> {
  const vault = getRewardVaultAddress();
  if (!vault || !isAddress(recipient)) return [];
  const client = robinhoodPublicClient();
  const address = getAddress(recipient);

  const logs = await client.getLogs({
    address: vault,
    event: rewardClaimedEvent,
    args: { recipient: address },
    fromBlock: 0n,
    toBlock: "latest",
  });

  return logs
    .map((log) => ({
      claimId: log.args.claimId!,
      redemptionId: log.args.redemptionId!,
      recipient: address,
      amountCents: usdgUnitsToCents(log.args.amount!),
      claimedAt: 0,
      txHash: log.transactionHash,
    }))
    .reverse();
}
