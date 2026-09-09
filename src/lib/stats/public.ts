import { eq, ne, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { creditEvents, discoveredSwaps, redemptions, swaps } from "@/lib/db/schema";

export type PublicDeskStats = {
  activeWallets: number;
  claimedLlmCreditsUsd: number;
  creditPaidUsd: number;
  swapVolumeUsd: number;
  asOf: string;
};

const CACHE_TTL_MS = 30 * 1000;
let cache: { value: PublicDeskStats; expiresAt: number } | null = null;

export function clearPublicDeskStatsCacheForTest() {
  cache = null;
}

export async function getPublicDeskStats(options?: {
  fresh?: boolean;
  db?: Awaited<ReturnType<typeof getDb>>;
}): Promise<PublicDeskStats | null> {
  if (!options?.fresh && cache && cache.expiresAt > Date.now()) {
    return cache.value;
  }

  try {
    const client = options?.db ?? (await getDb());

    // 1. Credit-based stats (fills that earned a reward).
    const [creditRow] = await client
      .select({
        creditWallets: sql<number>`count(distinct ${creditEvents.userId})`,
        creditPaidCents: sql<number>`coalesce(sum(${creditEvents.amountCents}), 0)`,
        creditVolumeCents: sql<number>`coalesce(sum(${swaps.notionalUsdCents}), 0)`,
      })
      .from(creditEvents)
      .innerJoin(swaps, eq(creditEvents.swapId, swaps.id))
      .where(ne(swaps.source, "mock"));

    const [llmRow] = await client
      .select({
        claimedLlmCents: sql<number>`coalesce(sum(${redemptions.amountCents}), 0)`,
      })
      .from(redemptions)
      .where(eq(redemptions.rail, "llm_credits"));

    // 2. Scanned wallet stats (any wallet that scanned — regardless of credit).
    const [scanRow] = await client
      .select({
        scanWallets: sql<number>`count(distinct ${discoveredSwaps.userId})`,
        scanVolumeCents: sql<number>`coalesce(sum(${discoveredSwaps.notionalUsdCents}), 0)`,
      })
      .from(discoveredSwaps);

    // Active wallets = union of credited wallets + scanned wallets.
    // Exclude mock-linked credit events from the wallet count.
    const [unionRow] = await client
      .select({
        total: sql<number>`count(*)`,
      })
      .from(
        sql`(
          SELECT ${creditEvents.userId} AS uid
          FROM ${creditEvents}
          INNER JOIN ${swaps} ON ${creditEvents.swapId} = ${swaps.id}
          WHERE ${swaps.source} != 'mock'
          UNION
          SELECT ${discoveredSwaps.userId} AS uid FROM ${discoveredSwaps}
        ) AS combined`,
      );

    const activeWallets = Number(unionRow?.total ?? 0);
    const totalVolumeCents =
      Math.max(Number(creditRow?.creditVolumeCents ?? 0), Number(scanRow?.scanVolumeCents ?? 0));

    const stats: PublicDeskStats = {
      activeWallets,
      claimedLlmCreditsUsd: Number(llmRow?.claimedLlmCents ?? 0) / 100,
      creditPaidUsd: Math.round(Number(creditRow?.creditPaidCents ?? 0) / 100),
      swapVolumeUsd: Math.round(totalVolumeCents / 100),
      asOf: new Date().toISOString(),
    };

    cache = { value: stats, expiresAt: Date.now() + CACHE_TTL_MS };
    return stats;
  } catch {
    return null;
  }
}
