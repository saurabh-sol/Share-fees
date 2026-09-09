import { createPublicClient, http, parseAbi, type Hash } from "viem";
import { ROBINHOOD_ACCR, robinhoodChain } from "@/lib/chains/robinhood";
import { env } from "@/lib/env";

const TRANSFER_EVENT = parseAbi([
  "event Transfer(address indexed from, address indexed to, uint256 value)",
])[0];

const TOLERANCE_BPS = 200n; // 2% underfill tolerance

function getClient() {
  return createPublicClient({
    chain: robinhoodChain,
    transport: http(undefined, { timeout: 20_000 }),
  });
}

export type VerifiedAccrDeposit = {
  from: `0x${string}`;
  to: `0x${string}`;
  value: bigint;
  tokenAddress: `0x${string}`;
};

export async function verifyAccrDepositTx(input: {
  txHash: string;
  expectedFrom: string;
  expectedAmountRaw: bigint;
  tokenAddress?: string;
  recipientAddress?: string;
}): Promise<VerifiedAccrDeposit> {
  const treasury = (input.recipientAddress ?? env.accrDepositWallet)?.toLowerCase();
  if (!treasury) {
    throw new Error("deposit_wallet_unconfigured");
  }

  const token = (input.tokenAddress ?? ROBINHOOD_ACCR).toLowerCase() as `0x${string}`;
  const client = getClient();

  const receipt = await client.getTransactionReceipt({
    hash: input.txHash as Hash,
  });
  if (receipt.status !== "success") {
    throw new Error("tx_reverted");
  }

  const fromExpected = input.expectedFrom.toLowerCase();
  let matched: VerifiedAccrDeposit | null = null;

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== token) continue;
    if (log.topics.length < 3) continue;

    const from = `0x${log.topics[1]?.slice(26)}`.toLowerCase() as `0x${string}`;
    const to = `0x${log.topics[2]?.slice(26)}`.toLowerCase() as `0x${string}`;
    if (from !== fromExpected || to !== treasury) continue;

    const value = BigInt(log.data);
    if (value <= 0n) continue;

    matched = { from, to, value, tokenAddress: token };
    break;
  }

  if (!matched) {
    throw new Error("transfer_not_found");
  }

  const minAccepted =
    (input.expectedAmountRaw * (10_000n - TOLERANCE_BPS)) / 10_000n;
  if (matched.value < minAccepted) {
    throw new Error("transfer_amount_too_low");
  }

  return matched;
}
