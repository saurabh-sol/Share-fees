import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { creditEvents, discoveredSwaps, swaps } from "@/lib/db/schema";
import { listWalletActivity } from "@/lib/indexer/claim";
import { summarizeWalletVolume } from "@/lib/indexer/summary";
import { CLAIMABLE_KINDS } from "@/lib/indexer/types";
import {
  MIN_NOTIONAL_USD_CENTS,
  MIN_REWARD_CENTS,
  getActiveRuleOrNull,
} from "@/lib/rules/engine";
import { lockWalletRow, syncWalletCache } from "./balances";
import {
  remainingDailyCapCents,
  writeRewardLedgerOnly,
  writeRewardLegs,
  readWallet,
  postSwapReward,
} from "./post-swap-reward";

export const VOLUME_SCAN_CHAIN = "scan";

export function volumeScanTxHash(userId: string) {
  return `volume:${userId}`;
}

async function lifetimeRewardCents(
  db: Awaited<ReturnType<typeof getDb>>,
  userId: string,
) {
  const rows = await db
    .select({
      total: sql<number>`coalesce(sum(${creditEvents.amountCents}), 0)`,
    })
    .from(creditEvents)
    .where(eq(creditEvents.userId, userId));
  return Number(rows[0]?.total ?? 0);
}

export async function previewScannedVolumeReward(
  userId: string,
  db?: Awaited<ReturnType<typeof getDb>>,
) {
  const client = db ?? (await getDb());
  const [rows, rule] = await Promise.all([listWalletActivity(userId, client), getActiveRuleOrNull(client)]);
  const summary = summarizeWalletVolume(rows, {
    conversionBps: rule?.conversionBps,
    minNotionalUsdCents: rule?.minNotionalUsdCents ?? MIN_NOTIONAL_USD_CENTS,
  });
  return {
    creditedCents: 0,
    alreadyExists: false,
    swapId: null as string | null,
    status: "claim_required",
    totalVolumeCents: summary.totalVolumeCents,
    estimatedTotalRewardCents: summary.estimatedTotalRewardCents,
    ...(await readWallet(client, userId)),
  };
}

/**
 * Post website credit so it matches the Activity "Total reward" figure.
 * Lifetime credit events are subtracted so a fill already paid is not paid twice.
 */
export async function settleScannedVolumeReward(
  userId: string,
  db?: Awaited<ReturnType<typeof getDb>>,
) {
  const client = db ?? (await getDb());
  const [rows, rule] = await Promise.all([listWalletActivity(userId, client), getActiveRuleOrNull(client)]);
  const summary = summarizeWalletVolume(rows, {
    conversionBps: rule?.conversionBps,
    minNotionalUsdCents: rule?.minNotionalUsdCents ?? MIN_NOTIONAL_USD_CENTS,
  });
  const balances = await readWallet(client, userId);
  const empty = {
    creditedCents: 0,
    alreadyExists: true,
    swapId: null as string | null,
    status: "skipped",
    totalVolumeCents: summary.totalVolumeCents,
    estimatedTotalRewardCents: summary.estimatedTotalRewardCents,
    ...balances,
  };

  if (!rule || !summary.qualifiesVolume || summary.estimatedTotalRewardCents < MIN_REWARD_CENTS) {
    return empty;
  }

  const lifetime = await lifetimeRewardCents(client, userId);
  const gap = summary.estimatedTotalRewardCents - lifetime;
  const txHash = volumeScanTxHash(userId);
  const [existing] = await client
    .select()
    .from(swaps)
    .where(and(eq(swaps.txHash, txHash), eq(swaps.fromChain, VOLUME_SCAN_CHAIN)))
    .limit(1);

  if (!existing) {
    if (gap < MIN_REWARD_CENTS) {
      return { ...empty, creditCents: balances.creditCents };
    }
    const posted = await postSwapReward(
      {
        userId,
        source: "historical",
        txHash,
        fromChain: VOLUME_SCAN_CHAIN,
        toChain: VOLUME_SCAN_CHAIN,
        fromToken: "VOLUME",
        toToken: "CREDIT",
        fromAmount: String(summary.totalVolumeCents),
        toAmount: String(summary.estimatedTotalRewardCents),
        notionalUsdCents: summary.totalVolumeCents,
        executedAt: new Date(),
      },
      client,
    );
    if (posted.creditedCents > 0) {
      await markVolumeSettled(userId, client);
      return {
        ...posted,
        totalVolumeCents: summary.totalVolumeCents,
        estimatedTotalRewardCents: summary.estimatedTotalRewardCents,
      };
    }
    // Inserted but not credited (held/paused) — top up below.
  }

  return client.transaction(async (tx) => {
    await lockWalletRow(tx as never, userId);
    const [row] = await tx
      .select()
      .from(swaps)
      .where(and(eq(swaps.txHash, txHash), eq(swaps.fromChain, VOLUME_SCAN_CHAIN)))
      .limit(1);
    if (!row) {
      const current = await readWallet(tx as never, userId);
      return { ...empty, ...current };
    }

    const [event] = await tx
      .select()
      .from(creditEvents)
      .where(eq(creditEvents.swapId, row.id))
      .limit(1);
    const already = event?.amountCents ?? 0;
    const remainingCap = await remainingDailyCapCents(tx as never, userId, rule.dailyCapUsdCents);
    const paid = await lifetimeRewardCents(tx as never, userId);
    const stillDue = summary.estimatedTotalRewardCents - paid;
    const targetOnThisSwap = already + stillDue;
    const next = Math.min(targetOnThisSwap, already + remainingCap);
    const delta = next - already;

    if (delta < MIN_REWARD_CENTS) {
      await markVolumeSettled(userId, tx as never);
      const current = await syncWalletCache(tx as never, userId);
      return {
        creditedCents: 0,
        alreadyExists: true,
        swapId: row.id,
        status: row.status,
        totalVolumeCents: summary.totalVolumeCents,
        estimatedTotalRewardCents: summary.estimatedTotalRewardCents,
        ...current,
      };
    }

    if (event) {
      await tx
        .update(creditEvents)
        .set({ amountCents: already + delta })
        .where(eq(creditEvents.id, event.id));
      await writeRewardLedgerOnly(tx, {
        userId,
        swapId: row.id,
        amountCents: delta,
      });
    } else {
      await writeRewardLegs(tx, {
        userId,
        swapId: row.id,
        ruleId: rule.id,
        amountCents: delta,
      });
    }

    await tx
      .update(swaps)
      .set({
        notionalUsdCents: summary.totalVolumeCents,
        status: "rewarded",
        toAmount: String(already + delta),
        fromAmount: String(summary.totalVolumeCents),
      })
      .where(eq(swaps.id, row.id));

    await markVolumeSettled(userId, tx as never);
    const current = await syncWalletCache(tx as never, userId);
    return {
      creditedCents: delta,
      alreadyExists: already > 0,
      swapId: row.id,
      status: "rewarded",
      totalVolumeCents: summary.totalVolumeCents,
      estimatedTotalRewardCents: summary.estimatedTotalRewardCents,
      ...current,
    };
  });
}

async function markVolumeSettled(
  userId: string,
  db: Pick<Awaited<ReturnType<typeof getDb>>, "update">,
) {
  await db
    .update(discoveredSwaps)
    .set({ status: "volume_settled", claimedAt: new Date() })
    .where(
      and(
        eq(discoveredSwaps.userId, userId),
        eq(discoveredSwaps.status, "unclaimed"),
        inArray(discoveredSwaps.kind, [...CLAIMABLE_KINDS]),
      ),
    );
}
