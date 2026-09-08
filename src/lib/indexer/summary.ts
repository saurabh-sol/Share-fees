import {
  DEFAULT_CONVERSION_BPS,
  MIN_NOTIONAL_USD_CENTS,
  MIN_REWARD_CENTS,
  computeRewardCents,
} from "@/lib/rules/engine";
import { isClaimableKind } from "./types";

export type ActivityVolumeRow = {
  notionalUsdCents: number;
  kind?: string | null;
  status?: string | null;
};

/**
 * Aggregate a wallet's swap activity for display and aggregate-volume rewards.
 *
 * - `totalVolumeCents` — every claimable-kind trade (including in-app swaps that
 *   were already credited individually via `postSwapReward`). This is the
 *   display metric the UI shows as "Swap volume".
 *
 * - `estimatedTotalRewardCents` — only the *rewardable* portion, computed over
 *   trades that have NOT yet been individually credited (i.e. excludes rows
 *   whose status is `booked` or `claimed`). This prevents double-crediting: an
 *   in-app swap keeps its per-swap reward but does not also inflate the
 *   aggregate scan reward.
 */
export function summarizeWalletVolume(
  rows: ActivityVolumeRow[],
  input?: {
    conversionBps?: number;
    minNotionalUsdCents?: number;
  },
) {
  const conversionBps = input?.conversionBps ?? DEFAULT_CONVERSION_BPS;
  const minNotionalUsdCents = input?.minNotionalUsdCents ?? MIN_NOTIONAL_USD_CENTS;

  const trades = rows.filter((row) => isClaimableKind(row.kind));
  const totalVolumeCents = trades.reduce(
    (sum, row) => sum + Math.max(0, row.notionalUsdCents),
    0,
  );

  const rewardableTrades = trades.filter(
    (row) => row.status !== "booked" && row.status !== "claimed",
  );
  const rewardableVolumeCents = rewardableTrades.reduce(
    (sum, row) => sum + Math.max(0, row.notionalUsdCents),
    0,
  );

  const qualifiesVolume = rewardableVolumeCents >= minNotionalUsdCents;
  const rawReward = qualifiesVolume
    ? computeRewardCents(rewardableVolumeCents, conversionBps)
    : 0;
  const estimatedTotalRewardCents = rawReward >= MIN_REWARD_CENTS ? rawReward : 0;

  return {
    transferCount: rows.length,
    totalVolumeCents,
    estimatedTotalRewardCents,
    qualifiesVolume,
    conversionBps,
    minNotionalUsdCents,
  };
}
