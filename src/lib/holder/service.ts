import { and, desc, eq, inArray, lte } from "drizzle-orm";
import { ACCR_TOKEN_ADDRESS } from "@/lib/chains/robinhood";
import { getDb } from "@/lib/db/client";
import { holderBalanceChecks, holderVerifications } from "@/lib/db/schema";
import { newLedgerId, postSwapReward } from "@/lib/ledger/post-swap-reward";
import { readAccrBalance } from "./balance";
import {
  HOLDER_CHAIN,
  HOLDER_HOLD_MS,
  HOLDER_REWARD_CENTS,
  holderRewardTxHash,
  type HolderStatus,
} from "./constants";

export class HolderError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "HolderError";
  }
}

function serializeVerification(row: typeof holderVerifications.$inferSelect) {
  const now = Date.now();
  const eligibleMs = row.eligibleAt.getTime();
  const remainingMs = Math.max(0, eligibleMs - now);
  return {
    id: row.id,
    status: row.status as HolderStatus,
    walletAddress: row.walletAddress,
    tokenAddress: row.tokenAddress,
    startBalanceRaw: row.startBalanceRaw,
    lastBalanceRaw: row.lastBalanceRaw,
    requiredBalanceRaw: row.requiredBalanceRaw,
    rewardCents: row.rewardCents,
    startedAt: row.startedAt.toISOString(),
    eligibleAt: row.eligibleAt.toISOString(),
    creditedAt: row.creditedAt?.toISOString() ?? null,
    lastCheckedAt: row.lastCheckedAt?.toISOString() ?? null,
    swapId: row.swapId,
    failureReason: row.failureReason,
    remainingMs,
    holdComplete: remainingMs === 0,
  };
}

async function recordBalanceCheck(
  db: Awaited<ReturnType<typeof getDb>>,
  input: {
    verificationId: string;
    userId: string;
    balanceRaw: string;
    meetsRequirement: boolean;
  },
) {
  await db.insert(holderBalanceChecks).values({
    id: newLedgerId("hchk"),
    verificationId: input.verificationId,
    userId: input.userId,
    balanceRaw: input.balanceRaw,
    meetsRequirement: input.meetsRequirement ? 1 : 0,
  });
}

export async function getHolderStatus(userId: string) {
  const db = await getDb();
  const [active] = await db
    .select()
    .from(holderVerifications)
    .where(eq(holderVerifications.userId, userId))
    .orderBy(desc(holderVerifications.createdAt))
    .limit(1);

  const [credited] = await db
    .select()
    .from(holderVerifications)
    .where(and(eq(holderVerifications.userId, userId), eq(holderVerifications.status, "credited")))
    .limit(1);

  let verification = active ? serializeVerification(active) : null;
  if (active && (active.status === "pending" || active.status === "eligible")) {
    verification = await processHolderVerification(active.id, db);
  }

  const checks = verification
    ? await db
        .select()
        .from(holderBalanceChecks)
        .where(eq(holderBalanceChecks.verificationId, verification.id))
        .orderBy(desc(holderBalanceChecks.checkedAt))
        .limit(20)
    : [];

  return {
    verification,
    alreadyCredited: Boolean(credited),
    creditedAt: credited?.creditedAt?.toISOString() ?? null,
    checks: checks.map((row) => ({
      balanceRaw: row.balanceRaw,
      meetsRequirement: row.meetsRequirement === 1,
      checkedAt: row.checkedAt.toISOString(),
    })),
  };
}

export async function startHolderVerification(userId: string, walletAddress: string) {
  const db = await getDb();
  const normalized = walletAddress.toLowerCase();

  const [credited] = await db
    .select()
    .from(holderVerifications)
    .where(and(eq(holderVerifications.userId, userId), eq(holderVerifications.status, "credited")))
    .limit(1);
  if (credited) {
    throw new HolderError("holder_reward_already_claimed", 409);
  }

  const [pending] = await db
    .select()
    .from(holderVerifications)
    .where(
      and(
        eq(holderVerifications.userId, userId),
        inArray(holderVerifications.status, ["pending", "eligible"]),
      ),
    )
    .limit(1);
  if (pending) {
    return serializeVerification(pending);
  }

  const balance = await readAccrBalance(normalized);
  if (!balance.meetsRequirement) {
    throw new HolderError("insufficient_accr_balance", 400);
  }

  const now = new Date();
  const id = newLedgerId("hver");
  const eligibleAt = new Date(now.getTime() + HOLDER_HOLD_MS);

  await db.insert(holderVerifications).values({
    id,
    userId,
    walletAddress: normalized,
    tokenAddress: ACCR_TOKEN_ADDRESS.toLowerCase(),
    requiredBalanceRaw: balance.requiredRawText,
    startBalanceRaw: balance.balanceRawText,
    lastBalanceRaw: balance.balanceRawText,
    status: "pending",
    rewardCents: HOLDER_REWARD_CENTS,
    startedAt: now,
    eligibleAt,
    lastCheckedAt: now,
  });

  await recordBalanceCheck(db, {
    verificationId: id,
    userId,
    balanceRaw: balance.balanceRawText,
    meetsRequirement: true,
  });

  const [row] = await db.select().from(holderVerifications).where(eq(holderVerifications.id, id)).limit(1);
  return serializeVerification(row!);
}

async function creditHolderReward(userId: string, verificationId: string, db: Awaited<ReturnType<typeof getDb>>) {
  const posted = await postSwapReward(
    {
      userId,
      source: "historical",
      txHash: holderRewardTxHash(userId),
      fromChain: HOLDER_CHAIN,
      toChain: HOLDER_CHAIN,
      fromToken: "ACCR",
      toToken: "CREDIT",
      fromAmount: String(HOLDER_REWARD_CENTS),
      toAmount: String(HOLDER_REWARD_CENTS),
      notionalUsdCents: HOLDER_REWARD_CENTS,
      executedAt: new Date(),
      fixedRewardCents: HOLDER_REWARD_CENTS,
    },
    db,
  );

  if (posted.creditedCents <= 0) {
    throw new HolderError(`holder_credit_${posted.status}`, 503);
  }

  await db
    .update(holderVerifications)
    .set({
      status: "credited",
      creditedAt: new Date(),
      swapId: posted.swapId,
      lastCheckedAt: new Date(),
    })
    .where(eq(holderVerifications.id, verificationId));

  return posted;
}

export async function processHolderVerification(
  verificationId: string,
  db = undefined as Awaited<ReturnType<typeof getDb>> | undefined,
) {
  const client = db ?? (await getDb());
  const [row] = await client
    .select()
    .from(holderVerifications)
    .where(eq(holderVerifications.id, verificationId))
    .limit(1);
  if (!row) throw new HolderError("verification_not_found", 404);
  if (row.status === "credited" || row.status === "failed" || row.status === "expired") {
    return serializeVerification(row);
  }

  const balance = await readAccrBalance(row.walletAddress);
  const now = new Date();

  await recordBalanceCheck(client, {
    verificationId: row.id,
    userId: row.userId,
    balanceRaw: balance.balanceRawText,
    meetsRequirement: balance.meetsRequirement,
  });

  if (!balance.meetsRequirement) {
    await client
      .update(holderVerifications)
      .set({
        status: "failed",
        failureReason: "balance_dropped_below_minimum",
        lastBalanceRaw: balance.balanceRawText,
        lastCheckedAt: now,
      })
      .where(eq(holderVerifications.id, row.id));
    const [failed] = await client
      .select()
      .from(holderVerifications)
      .where(eq(holderVerifications.id, row.id))
      .limit(1);
    return serializeVerification(failed!);
  }

  const holdComplete = now.getTime() >= row.eligibleAt.getTime();
  if (!holdComplete) {
    await client
      .update(holderVerifications)
      .set({
        status: "pending",
        lastBalanceRaw: balance.balanceRawText,
        lastCheckedAt: now,
      })
      .where(eq(holderVerifications.id, row.id));
    const [pending] = await client
      .select()
      .from(holderVerifications)
      .where(eq(holderVerifications.id, row.id))
      .limit(1);
    return serializeVerification(pending!);
  }

  await client
    .update(holderVerifications)
    .set({
      status: "eligible",
      lastBalanceRaw: balance.balanceRawText,
      lastCheckedAt: now,
    })
    .where(eq(holderVerifications.id, row.id));

  await creditHolderReward(row.userId, row.id, client);

  const [credited] = await client
    .select()
    .from(holderVerifications)
    .where(eq(holderVerifications.id, row.id))
    .limit(1);
  return serializeVerification(credited!);
}

export async function processDueHolderVerifications() {
  const db = await getDb();
  const now = new Date();
  const due = await db
    .select()
    .from(holderVerifications)
    .where(
      and(
        inArray(holderVerifications.status, ["pending", "eligible"]),
        lte(holderVerifications.eligibleAt, now),
      ),
    )
    .limit(50);

  let processed = 0;
  for (const row of due) {
    await processHolderVerification(row.id, db);
    processed += 1;
  }
  return { processed };
}
