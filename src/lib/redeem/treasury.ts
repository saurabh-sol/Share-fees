import { createWalletClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrum } from "viem/chains";
import { env } from "@/lib/env";

export const ARBITRUM_USDT = "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9";

const usdtAbi = parseAbi(["function transfer(address to, uint256 amount) returns (bool)"]);

export function treasuryCanBroadcast() {
  if (!env.treasuryEnabled || !env.treasuryPrivateKey) return false;
  if (env.nodeEnv === "production" && !env.treasuryLive) return false;
  return /^0x[0-9a-fA-F]{64}$/.test(env.treasuryPrivateKey);
}

export type BroadcastUsdt = (input: {
  destination: string;
  amountCents: number;
}) => Promise<string>;

export const broadcastArbitrumUsdt: BroadcastUsdt = async ({ destination, amountCents }) => {
  if (!treasuryCanBroadcast() || !env.treasuryPrivateKey) {
    throw new Error("treasury_disabled");
  }
  const account = privateKeyToAccount(env.treasuryPrivateKey as `0x${string}`);
  const client = createWalletClient({
    account,
    chain: arbitrum,
    transport: http(),
  });
  const units = BigInt(amountCents) * BigInt(10_000);
  return client.writeContract({
    address: ARBITRUM_USDT,
    abi: usdtAbi,
    functionName: "transfer",
    args: [destination as `0x${string}`, units],
  });
};
