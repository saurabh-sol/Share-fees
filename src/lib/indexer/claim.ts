import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { discoveredSwaps } from "@/lib/db/schema";
import { postSwapReward } from "@/lib/ledger/post-swap-reward";
import { readVerifiedFill } from "@/lib/lifi/settle";
import { MIN_NOTIONAL_USD_CENTS, getActiveRuleOrNull } from "@/lib/rules/engine";
import { fetchAlchemyTradeByHash } from "./alchemy";
import { fetchZerionTradeByHash } from "./zerion";
import { isClaimableKind, type HistoricalCandidate } from "./types";

export class ClaimError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "ClaimError";
  }
}

export async function reverifyCandidate(input: {
  address: string;
  txHash: string;
  fromChain: string;
  toChain: string;
}): Promise<HistoricalCandidate> {
  try {
    const lifi = await readVerifiedFill({
      txHash: input.txHash,
      fromChain: input.fromChain,
      toChain: input.toChain,
      sessionAddress: input.address,
    });
    if (lifi.kind === "done") {
      return {
        provider: "lifi",
        txHash: lifi.executedHash.toLowerCase(),
        fromChain: input.fromChain,
        toChain: input.toChain,
        fromToken: lifi.fromToken,
        toToken: lifi.toToken,
        fromAmount: lifi.fromAmount,
        toAmount: lifi.toAmount,
        notionalUsdCents: lifi.notionalUsdCents,
        kind: "trade",
        executedAt: new Date(),
      };
    }
  } catch {
    // Fall through to Zerion. A pending LI.FI fill is not claimable yet.
  }

  const alchemy = await fetchAlchemyTradeByHash(input.address, input.txHash);
  if (alchemy) return alchemy;

  const zerion = await fetchZerionTradeByHash(input.address, input.txHash);
  if (!zerion) {
    throw new ClaimError("unverified_historical_swap", 422);
  }
  return zerion;
}

export async function listUnclaimed(userId: string, db?: Awaited<ReturnType<typeof getDb>>) {
  const client = db ?? (await getDb());
  return client
    .select()
    .from(discoveredSwaps)
    .where(and(eq(discoveredSwaps.userId, userId), eq(discoveredSwaps.status, "unclaimed")));
}

export async function listWalletActivity(userId: string, db?: Awaited<ReturnType<typeof getDb>>) {
  const client = db ?? (await getDb());
  return client
    .select()
    .from(discoveredSwaps)
    .where(eq(discoveredSwaps.userId, userId))
    .orderBy(desc(discoveredSwaps.executedAt));
}

export async function claimDiscoveredSwap(input: {
  userId: string;
  address: string;
  claimId: string;
  reverify?: typeof reverifyCandidate;
  db?: Awaited<ReturnType<typeof getDb>>;
}) {
  const client = input.db ?? (await getDb());
  const [row] = await client
    .select()
    .from(discoveredSwaps)
    .where(and(eq(discoveredSwaps.id, input.claimId), eq(discoveredSwaps.userId, input.userId)))
    .limit(1);

  if (!row) {
    throw new ClaimError("claim_not_found", 404);
  }
  if (row.status !== "unclaimed") {
    throw new ClaimError(row.status === "below_threshold" ? "below_threshold" : "claim_not_open", 409);
  }
  if (!isClaimableKind(row.kind)) {
    throw new ClaimError("not_a_swap", 400);
  }

  const verify = input.reverify ?? reverifyCandidate;
  const verified = await verify({
    address: input.address,
    txHash: row.txHash,
    fromChain: row.fromChain,
    toChain: row.toChain,
  });

  const rule = await getActiveRuleOrNull(client);
  const floor = rule?.minNotionalUsdCents ?? MIN_NOTIONAL_USD_CENTS;
  if (verified.notionalUsdCents < floor) {
    await client
      .update(discoveredSwaps)
      .set({ status: "below_threshold" })
      .where(eq(discoveredSwaps.id, row.id));
    throw new ClaimError("below_threshold", 400);
  }

  return postSwapReward(
    {
      userId: input.userId,
      source: "historical",
      txHash: verified.txHash,
      fromChain: verified.fromChain,
      toChain: verified.toChain,
      fromToken: verified.fromToken,
      toToken: verified.toToken,
      fromAmount: verified.fromAmount,
      toAmount: verified.toAmount,
      notionalUsdCents: verified.notionalUsdCents,
      executedAt: verified.executedAt,
    },
    client,
    {
      afterWrite: async (tx) => {
        await tx
          .update(discoveredSwaps)
          .set({ status: "claimed", claimedAt: new Date() })
          .where(eq(discoveredSwaps.id, row.id));
      },
    },
  );
}
