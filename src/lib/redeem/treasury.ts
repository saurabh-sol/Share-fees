import { eq } from "drizzle-orm";
import { createWalletClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrum } from "viem/chains";
import { getDb } from "@/lib/db/client";
import { payoutOutbox, redemptions } from "@/lib/db/schema";
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

export async function processPayoutOutbox(input?: {
  broadcast?: BroadcastUsdt;
  db?: Awaited<ReturnType<typeof getDb>>;
}) {
  const client = input?.db ?? (await getDb());
  const send = input?.broadcast ?? broadcastArbitrumUsdt;
  const rows = await client.select().from(payoutOutbox).where(eq(payoutOutbox.status, "queued"));

  const results: Array<{ id: string; status: string; txHash?: string }> = [];
  for (const row of rows) {
    if (!treasuryCanBroadcast() && !input?.broadcast) {
      results.push({ id: row.id, status: "queued" });
      continue;
    }
    try {
      await client
        .update(payoutOutbox)
        .set({ status: "sending", attempts: row.attempts + 1, updatedAt: new Date() })
        .where(eq(payoutOutbox.id, row.id));
      const txHash = await send({
        destination: row.destination,
        amountCents: row.amountCents,
      });
      await client
        .update(payoutOutbox)
        .set({ status: "sent", txHash, lastError: null, updatedAt: new Date() })
        .where(eq(payoutOutbox.id, row.id));
      await client
        .update(redemptions)
        .set({ status: "fulfilled", fulfilledAt: new Date() })
        .where(eq(redemptions.id, row.redemptionId));
      results.push({ id: row.id, status: "sent", txHash });
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 180) : "payout_failed";
      await client
        .update(payoutOutbox)
        .set({ status: "failed", lastError: message, updatedAt: new Date() })
        .where(eq(payoutOutbox.id, row.id));
      results.push({ id: row.id, status: "failed" });
    }
  }
  return results;
}
