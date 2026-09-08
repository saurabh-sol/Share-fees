import { and, eq, inArray } from "drizzle-orm";
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
  const empty = {
    creditedCents: 0,
    alreadyExists: true,
    swapId: null as string | null,
    status: "skipped",
    totalVolumeCents: summary.totalVolumeCents,
    estimatedTotalRewardCents: summary.estimatedTotalRewardCents,
    ...(await readWallet(client, userId)),
  };

  if (!rule || !summary.qualifiesVolume || summary.estimatedTotalRewardCents < MIN_REWARD_CENTS) {
    return empty;
  }

  const settleCents = summary.unpaidRewardCents;
  const txHash = volumeScanTxHash(userId);
  const [existing] = await client
    .select()
    .from(swaps)
    .where(and(eq(swaps.txHash, txHash), eq(swaps.fromChain, VOLUME_SCAN_CHAIN)))
    .limit(1);

  if (!existing) {
    if (settleCents < MIN_REWARD_CENTS) {
      return empty;
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
        toAmount: String(settleCents),
        notionalUsdCents: summary.totalVolumeCents,
        executedAt: new Date(),
      },
      client,
    );
    if (posted.creditedCents > 0) {
      await markVolumeSettled(userId, client);
    }
    return {
      ...posted,
      totalVolumeCents: summary.totalVolumeCents,
      estimatedTotalRewardCents: summary.estimatedTotalRewardCents,
    };
  }

  return client.transaction(async (tx) => {
    await lockWalletRow(tx as never, userId);
    const [event] = await tx
      .select()
      .from(creditEvents)
      .where(eq(creditEvents.swapId, existing.id))
      .limit(1);
    const already = event?.amountCents ?? 0;
    const remainingCap = await remainingDailyCapCents(tx as never, userId, rule.dailyCapUsdCents);
    const target = Math.min(settleCents, already + remainingCap);
    const delta = target - already;

    if (delta < MIN_REWARD_CENTS) {
      await markVolumeSettled(userId, tx as never);
      const balances = await readWallet(tx as never, userId);
      return {
        creditedCents: 0,
        alreadyExists: true,
        swapId: existing.id,
        status: existing.status,
        totalVolumeCents: summary.totalVolumeCents,
        estimatedTotalRewardCents: summary.estimatedTotalRewardCents,
        ...balances,
      };
    }

    if (event) {
      await tx
        .update(creditEvents)
        .set({ amountCents: already + delta })
        .where(eq(creditEvents.id, event.id));
      await writeRewardLedgerOnly(tx, {
        userId,
        swapId: existing.id,
        amountCents: delta,
      });
    } else {
      await writeRewardLegs(tx, {
        userId,
        swapId: existing.id,
        ruleId: rule.id,
        amountCents: target,
      });
    }

    await tx
      .update(swaps)
      .set({
        notionalUsdCents: summary.totalVolumeCents,
        status: "rewarded",
        toAmount: String(target),
        fromAmount: String(summary.totalVolumeCents),
      })
      .where(eq(swaps.id, existing.id));

    await markVolumeSettled(userId, tx as never);
    const balances = await syncWalletCache(tx as never, userId);
    return {
      creditedCents: event ? delta : target,
      alreadyExists: already > 0,
      swapId: existing.id,
      status: "rewarded",
      totalVolumeCents: summary.totalVolumeCents,
      estimatedTotalRewardCents: summary.estimatedTotalRewardCents,
      ...balances,
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
