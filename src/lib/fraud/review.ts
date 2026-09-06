import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { creditEvents, fraudFlags, swaps } from "@/lib/db/schema";
import { lockWalletRow, syncWalletCache } from "@/lib/ledger/balances";
import {
  LedgerError,
  remainingDailyCapCents,
  writeRewardLegs,
} from "@/lib/ledger/post-swap-reward";
import { MIN_REWARD_CENTS, computeRewardCents, getActiveRuleOrNull } from "@/lib/rules/engine";

export class ReviewError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "ReviewError";
  }
}

export async function resolveFraudFlag(input: {
  flagId: string;
  action: "release" | "reject";
  reviewer: string;
  db?: Awaited<ReturnType<typeof getDb>>;
}) {
  const client = input.db ?? (await getDb());
  const [flag] = await client.select().from(fraudFlags).where(eq(fraudFlags.id, input.flagId)).limit(1);
  if (!flag) {
    throw new ReviewError("flag_not_found", 404);
  }
  if (flag.status !== "open") {
    throw new ReviewError("flag_already_resolved", 409);
  }
  if (!flag.swapId) {
    throw new ReviewError("flag_missing_swap", 400);
  }

  const [swap] = await client.select().from(swaps).where(eq(swaps.id, flag.swapId)).limit(1);
  if (!swap) {
    throw new ReviewError("swap_not_found", 404);
  }

  if (input.action === "reject") {
    await client.transaction(async (tx) => {
      await tx.update(swaps).set({ status: "rejected" }).where(eq(swaps.id, swap.id));
      await tx
        .update(fraudFlags)
        .set({ status: "closed", reviewedBy: input.reviewer, reviewedAt: new Date() })
        .where(eq(fraudFlags.id, flag.id));
    });
    return { flagId: flag.id, swapId: swap.id, status: "rejected", creditedCents: 0 };
  }

  return client.transaction(async (tx) => {
    await lockWalletRow(tx as never, swap.userId);
    const [existingCredit] = await tx
      .select()
      .from(creditEvents)
      .where(eq(creditEvents.swapId, swap.id))
      .limit(1);
    if (existingCredit) {
      await tx
        .update(fraudFlags)
        .set({ status: "closed", reviewedBy: input.reviewer, reviewedAt: new Date() })
        .where(eq(fraudFlags.id, flag.id));
      return { flagId: flag.id, swapId: swap.id, status: "rewarded", creditedCents: 0 };
    }

    const rule = await getActiveRuleOrNull(tx as never);
    if (!rule) {
      throw new ReviewError("rewards_paused", 409);
    }

    const reward = computeRewardCents(swap.notionalUsdCents, rule.conversionBps);
    const remainingCap = await remainingDailyCapCents(tx as never, swap.userId, rule.dailyCapUsdCents);
    const credited = Math.min(reward, remainingCap);
    if (credited < MIN_REWARD_CENTS) {
      throw new LedgerError("daily_cap", 409);
    }

    await writeRewardLegs(tx, {
      userId: swap.userId,
      swapId: swap.id,
      ruleId: rule.id,
      amountCents: credited,
    });
    await tx.update(swaps).set({ status: "rewarded" }).where(eq(swaps.id, swap.id));
    await tx
      .update(fraudFlags)
      .set({ status: "closed", reviewedBy: input.reviewer, reviewedAt: new Date() })
      .where(eq(fraudFlags.id, flag.id));
    await syncWalletCache(tx as never, swap.userId);
    return { flagId: flag.id, swapId: swap.id, status: "rewarded", creditedCents: credited };
  });
}
