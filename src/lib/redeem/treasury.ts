import { createWalletClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { env } from "@/lib/env";

export const ETHEREUM_USDG = "0xe343167631d89B6Ffc58B88d6b7fB0228795491D";

const usdgAbi = parseAbi(["function transfer(address to, uint256 amount) returns (bool)"]);

export function treasuryCanBroadcast() {
  if (!env.treasuryEnabled || !env.treasuryPrivateKey) return false;
  if (env.nodeEnv === "production" && !env.treasuryLive) return false;
  return /^0x[0-9a-fA-F]{64}$/.test(env.treasuryPrivateKey);
}

export type BroadcastUsdt = (input: {
  destination: string;
  amountCents: number;
}) => Promise<string>;

export const broadcastEthereumUsdg: BroadcastUsdt = async ({ destination, amountCents }) => {
  if (!treasuryCanBroadcast() || !env.treasuryPrivateKey) {
    throw new Error("treasury_disabled");
  }
  const account = privateKeyToAccount(env.treasuryPrivateKey as `0x${string}`);
  const client = createWalletClient({
    account,
    chain: mainnet,
    transport: http(),
  });
  const units = BigInt(amountCents) * BigInt(10_000);
  return client.writeContract({
    address: ETHEREUM_USDG,
    abi: usdgAbi,
    functionName: "transfer",
    args: [destination as `0x${string}`, units],
  });
};
