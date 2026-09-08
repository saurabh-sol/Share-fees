import { eq, ne, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { creditEvents, swaps } from "@/lib/db/schema";

export type PublicDeskStats = {
  activeWallets: number;
  fillsCredited: number;
  creditPaidUsd: number;
  swapVolumeUsd: number;
  asOf: string;
};

const CACHE_TTL_MS = 5 * 60 * 1000;
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
    const [row] = await client
      .select({
        activeWallets: sql<number>`count(distinct ${creditEvents.userId})`,
        fillsCredited: sql<number>`count(${creditEvents.id})`,
        creditPaidCents: sql<number>`coalesce(sum(${creditEvents.amountCents}), 0)`,
        swapVolumeCents: sql<number>`coalesce(sum(${swaps.notionalUsdCents}), 0)`,
      })
      .from(creditEvents)
      .innerJoin(swaps, eq(creditEvents.swapId, swaps.id))
      .where(ne(swaps.source, "mock"));

    const stats: PublicDeskStats = {
      activeWallets: Number(row?.activeWallets ?? 0),
      fillsCredited: Number(row?.fillsCredited ?? 0),
      creditPaidUsd: Math.round(Number(row?.creditPaidCents ?? 0) / 100),
      swapVolumeUsd: Math.round(Number(row?.swapVolumeCents ?? 0) / 100),
      asOf: new Date().toISOString(),
    };

    cache = { value: stats, expiresAt: Date.now() + CACHE_TTL_MS };
    return stats;
  } catch {
    return null;
  }
}
