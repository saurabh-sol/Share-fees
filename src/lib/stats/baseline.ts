import { eq } from "drizzle-orm";
import type { getDb } from "@/lib/db/client";
import { publicDeskStatsBaseline } from "@/lib/db/schema";

type BaselineDb = Awaited<ReturnType<typeof getDb>>;

export type PublicStatsFloor = {
  minActiveWallets: number;
  minClaimedLlmCents: number;
  minSwapVolumeUsd: number;
};

const ZERO_STATS_FLOOR: PublicStatsFloor = {
  minActiveWallets: 0,
  minClaimedLlmCents: 0,
  minSwapVolumeUsd: 0,
};

/** Production landing floors — live DB totals grow above these values. */
export const PRODUCTION_PUBLIC_STATS_FLOOR: PublicStatsFloor = {
  minActiveWallets: 45,
  minClaimedLlmCents: 8500,
  minSwapVolumeUsd: 350_000,
};

export async function readPublicStatsFloor(db: BaselineDb): Promise<PublicStatsFloor> {
  try {
    const [row] = await db
      .select()
      .from(publicDeskStatsBaseline)
      .where(eq(publicDeskStatsBaseline.id, "default"))
      .limit(1);
    if (!row) {
      return process.env.NODE_ENV === "production"
        ? PRODUCTION_PUBLIC_STATS_FLOOR
        : ZERO_STATS_FLOOR;
    }
    return {
      minActiveWallets: row.minActiveWallets,
      minClaimedLlmCents: row.minClaimedLlmCents,
      minSwapVolumeUsd: row.minSwapVolumeUsd,
    };
  } catch {
    return process.env.NODE_ENV === "production"
      ? PRODUCTION_PUBLIC_STATS_FLOOR
      : ZERO_STATS_FLOOR;
  }
}

/** Upsert production hero stat floors (runs once on server boot). */
export async function ensurePublicStatsBaseline(db: BaselineDb) {
  if (process.env.NODE_ENV !== "production") return;
  await db
    .insert(publicDeskStatsBaseline)
    .values({
      id: "default",
      minActiveWallets: PRODUCTION_PUBLIC_STATS_FLOOR.minActiveWallets,
      minClaimedLlmCents: PRODUCTION_PUBLIC_STATS_FLOOR.minClaimedLlmCents,
      minSwapVolumeUsd: PRODUCTION_PUBLIC_STATS_FLOOR.minSwapVolumeUsd,
    })
    .onConflictDoUpdate({
      target: publicDeskStatsBaseline.id,
      set: {
        minActiveWallets: PRODUCTION_PUBLIC_STATS_FLOOR.minActiveWallets,
        minClaimedLlmCents: PRODUCTION_PUBLIC_STATS_FLOOR.minClaimedLlmCents,
        minSwapVolumeUsd: PRODUCTION_PUBLIC_STATS_FLOOR.minSwapVolumeUsd,
        updatedAt: new Date(),
      },
    });
}

export function applyPublicStatsFloor<T extends {
  activeWallets: number;
  claimedLlmCreditsUsd: number;
  swapVolumeUsd: number;
}>(live: T, floor: PublicStatsFloor): T {
  return {
    ...live,
    activeWallets: Math.max(floor.minActiveWallets, live.activeWallets),
    claimedLlmCreditsUsd: Math.max(floor.minClaimedLlmCents / 100, live.claimedLlmCreditsUsd),
    swapVolumeUsd: Math.max(floor.minSwapVolumeUsd, live.swapVolumeUsd),
  };
}

export function statsFromFloorOnly(floor: PublicStatsFloor) {
  return {
    activeWallets: floor.minActiveWallets,
    claimedLlmCreditsUsd: floor.minClaimedLlmCents / 100,
    creditPaidUsd: 0,
    swapVolumeUsd: floor.minSwapVolumeUsd,
    asOf: new Date().toISOString(),
  };
}
