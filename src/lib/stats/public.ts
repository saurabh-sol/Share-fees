import { eq, ne, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { accrDeposits, creditEvents, discoveredSwaps, redemptions, swaps } from "@/lib/db/schema";
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

function publicStatsMirrorOrigin(): string | undefined {
  const raw = process.env.PUBLIC_STATS_MIRROR_ORIGIN?.trim().replace(/\/$/, "");
  return raw || undefined;
}

async function fetchMirroredPublicDeskStats(): Promise<PublicDeskStats | null> {
  const origin = publicStatsMirrorOrigin();
  if (!origin || process.env.NODE_ENV === "test") return null;
  try {
    const response = await fetch(`${origin}/api/v1/stats/public`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return null;
    return (await response.json()) as PublicDeskStats;
  } catch {
    return null;
  }
}

export function clearPublicDeskStatsCache() {
  cache = null;
}

export function clearPublicDeskStatsCacheForTest() {
  clearPublicDeskStatsCache();
}

export async function getPublicDeskStats(options?: {
  fresh?: boolean;
  db?: Awaited<ReturnType<typeof getDb>>;
}): Promise<PublicDeskStats> {
  if (!options?.fresh && cache && cache.expiresAt > Date.now()) {
    return cache.value;
  }

  if (!options?.db) {
    const mirrored = await fetchMirroredPublicDeskStats();
    if (mirrored) {
      cache = { value: mirrored, expiresAt: Date.now() + CACHE_TTL_MS };
      return mirrored;
    }
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

    const [depositRow] = await client
      .select({
        displayCreditCents: sql<number>`coalesce(sum(${accrDeposits.displayCreditCents}), 0)`,
        depositUsdCents: sql<number>`coalesce(sum(${accrDeposits.usdCentsAtDeposit}), 0)`,
      })
      .from(accrDeposits)
      .where(eq(accrDeposits.status, "credited"));

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
          UNION
          SELECT ${accrDeposits.userId} AS uid
          FROM ${accrDeposits}
          WHERE ${accrDeposits.status} = 'credited'
        ) AS combined`,
      );

    const totalVolumeCents = Math.max(
      Number(creditRow?.creditVolumeCents ?? 0),
      Number(scanRow?.scanVolumeCents ?? 0),
    );

    const live: PublicDeskStats = {
      activeWallets: Number(unionRow?.total ?? 0),
      claimedLlmCreditsUsd:
        (Number(llmRow?.claimedLlmCents ?? 0) + Number(depositRow?.displayCreditCents ?? 0)) / 100,
      creditPaidUsd: Math.round(
        (Number(creditRow?.creditPaidCents ?? 0) + Number(depositRow?.depositUsdCents ?? 0)) / 100,
      ),
      swapVolumeUsd: Math.round(totalVolumeCents / 100),
      asOf: new Date().toISOString(),
    };

    const stats = applyPublicStatsFloor(live, floor);
    cache = { value: stats, expiresAt: Date.now() + CACHE_TTL_MS };
    return stats;
  } catch (error) {
    console.error("[stats/public] live query failed", error);
    const stats = statsFromFloorOnly(PRODUCTION_PUBLIC_STATS_FLOOR);
    cache = { value: stats, expiresAt: Date.now() + CACHE_TTL_MS };
    return stats;
  }
}
