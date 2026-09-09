import { eq, ne, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { creditEvents, discoveredSwaps, redemptions, swaps } from "@/lib/db/schema";
import {
  applyPublicStatsFloor,
  PRODUCTION_PUBLIC_STATS_FLOOR,
  readPublicStatsFloor,
  statsFromFloorOnly,
} from "./baseline";

export type { PublicStatsFloor } from "./baseline";
export {
  PRODUCTION_PUBLIC_STATS_FLOOR,
  ensurePublicStatsBaseline,
  readPublicStatsFloor,
} from "./baseline";

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
}): Promise<PublicDeskStats> {
  if (!options?.fresh && cache && cache.expiresAt > Date.now()) {
    return cache.value;
  }

  try {
    const client = options?.db ?? (await getDb());
    const floor = await readPublicStatsFloor(client);

    const [creditRow] = await client
      .select({
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

    const [scanRow] = await client
      .select({
        scanVolumeCents: sql<number>`coalesce(sum(${discoveredSwaps.notionalUsdCents}), 0)`,
      })
      .from(discoveredSwaps);

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

    const totalVolumeCents = Math.max(
      Number(creditRow?.creditVolumeCents ?? 0),
      Number(scanRow?.scanVolumeCents ?? 0),
    );

    const live: PublicDeskStats = {
      activeWallets: Number(unionRow?.total ?? 0),
      claimedLlmCreditsUsd: Number(llmRow?.claimedLlmCents ?? 0) / 100,
      creditPaidUsd: Math.round(Number(creditRow?.creditPaidCents ?? 0) / 100),
      swapVolumeUsd: Math.round(totalVolumeCents / 100),
      asOf: new Date().toISOString(),
    };

    const stats = applyPublicStatsFloor(live, floor);
    cache = { value: stats, expiresAt: Date.now() + CACHE_TTL_MS };
    return stats;
  } catch {
    const fallbackFloor =
      process.env.NODE_ENV === "production" ? PRODUCTION_PUBLIC_STATS_FLOOR : {
        minActiveWallets: 0,
        minClaimedLlmCents: 0,
        minSwapVolumeUsd: 0,
      };
    const stats = statsFromFloorOnly(fallbackFloor);
    cache = { value: stats, expiresAt: Date.now() + CACHE_TTL_MS };
    return stats;
  }
}
