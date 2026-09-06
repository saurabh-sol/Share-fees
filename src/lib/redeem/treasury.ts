import { createWalletClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ROBINHOOD_USDG, robinhoodChain } from "@/lib/chains/robinhood";
import { env } from "@/lib/env";

export const TREASURY_USDG = ROBINHOOD_USDG;
export const TREASURY_USDG_DECIMALS = 6;

const usdgAbi = parseAbi(["function transfer(address to, uint256 amount) returns (bool)"]);

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

export type BroadcastUsdt = (input: {
  destination: string;
  amountCents: number;
}) => Promise<string>;

export const broadcastRobinhoodUsdg: BroadcastUsdt = async ({ destination, amountCents }) => {
  const key = normalizeTreasuryPrivateKey(env.treasuryPrivateKey);
  if (!treasuryCanBroadcast() || !key) {
    throw new Error("treasury_disabled");
  }
  const account = privateKeyToAccount(key);
  const client = createWalletClient({
    account,
    chain: robinhoodChain,
    transport: http(),
  });
  const units = BigInt(amountCents) * 10n ** BigInt(TREASURY_USDG_DECIMALS - 2);
  return client.writeContract({
    address: TREASURY_USDG,
    abi: usdgAbi,
    functionName: "transfer",
    args: [destination as `0x${string}`, units],
  });
};
