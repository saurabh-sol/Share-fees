import { createWalletClient, getAddress, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ROBINHOOD_CHAIN_ID, ROBINHOOD_USDG, robinhoodChain } from "@/lib/chains/robinhood";
import { env } from "@/lib/env";
import {
  USDG_CLAIM_DEADLINE_SECONDS,
  buildPayClaimRequest,
  centsToUsdgUnits,
  getRewardVaultAddress,
  usdgClaimEip712Domain,
  usdgClaimTypedDataTypes,
  type OnChainClaimVoucher,
} from "@/lib/redeem/reward-vault";

export const TREASURY_USDG = ROBINHOOD_USDG;
export { TREASURY_USDG_DECIMALS } from "@/lib/redeem/reward-vault";

export function normalizeTreasuryPrivateKey(raw?: string): `0x${string}` | null {
  if (!raw) return null;
  const hex = raw.trim().replace(/^0x/i, "");
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) return null;
  return `0x${hex}`;
}

export function treasuryCanBroadcast() {
  if (!normalizeTreasuryPrivateKey(env.treasuryPrivateKey)) return false;
  if (env.nodeEnv === "production") {
    return env.treasuryEnabled && env.treasuryLive;
  }
  return !env.treasuryDisabled;
}

export function treasuryCanPayOnChain() {
  return treasuryCanBroadcast() && Boolean(getRewardVaultAddress());
}

export type BroadcastUsdt = (input: {
  destination: string;
  amountCents: number;
  redemptionId: string;
}) => Promise<string>;

export async function signUsdgClaimVoucher(input: {
  redemptionId: string;
  destination: string;
  amountCents: number;
}): Promise<OnChainClaimVoucher | null> {
  const vault = getRewardVaultAddress();
  const key = normalizeTreasuryPrivateKey(env.treasuryPrivateKey);
  if (!vault || !key || !treasuryCanBroadcast()) return null;

  const account = privateKeyToAccount(key);
  const recipient = getAddress(input.destination);
  const amount = centsToUsdgUnits(input.amountCents);
  const deadline = Math.floor(Date.now() / 1000) + USDG_CLAIM_DEADLINE_SECONDS;
  const signature = await account.signTypedData({
    domain: usdgClaimEip712Domain(vault),
    types: usdgClaimTypedDataTypes,
    primaryType: "Claim",
    message: {
      redemptionId: input.redemptionId,
      recipient,
      amount,
      deadline: BigInt(deadline),
    },
  });

  return {
    vault,
    chainId: ROBINHOOD_CHAIN_ID,
    redemptionId: input.redemptionId,
    recipient,
    amount: amount.toString(),
    deadline,
    signature,
  };
}

export const broadcastRobinhoodUsdg: BroadcastUsdt = async ({
  destination,
  amountCents,
  redemptionId,
}) => {
  const key = normalizeTreasuryPrivateKey(env.treasuryPrivateKey);
  const vault = getRewardVaultAddress();
  if (!treasuryCanBroadcast() || !key) {
    throw new Error("treasury_disabled");
  }
  if (!vault) {
    throw new Error("reward_vault_unconfigured");
  }
  const account = privateKeyToAccount(key);
  const client = createWalletClient({
    account,
    chain: robinhoodChain,
    transport: http(),
  });
  const request = buildPayClaimRequest({
    vault,
    destination,
    amountCents,
    redemptionId,
  });
  return client.writeContract(request);
};
