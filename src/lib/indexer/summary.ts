import {
  DEFAULT_CONVERSION_BPS,
  MIN_NOTIONAL_USD_CENTS,
  MIN_REWARD_CENTS,
  computeRewardCents,
} from "@/lib/rules/engine";
import { isVolumeKind } from "./types";

export type ActivityVolumeRow = {
  notionalUsdCents: number;
  kind?: string | null;
  status?: string | null;
};

/**
 * Aggregate wallet activity for display and aggregate-volume rewards.
 *
 * Volume is every trade, execute, send, and receive (USDG transfers included).
 * Approves and other noise stay out. The $250 floor applies to that total.
 * Ledger settle posts only the unpaid delta so a credited fill is not paid twice.
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

  const trades = rows.filter((row) => isVolumeKind(row.kind));
  const totalVolumeCents = trades.reduce(
    (sum, row) => sum + Math.max(0, row.notionalUsdCents),
    0,
  );

  const qualifiesVolume = totalVolumeCents >= minNotionalUsdCents;
  const rawReward = qualifiesVolume
    ? computeRewardCents(totalVolumeCents, conversionBps)
    : 0;
  const estimatedTotalRewardCents = rawReward >= MIN_REWARD_CENTS ? rawReward : 0;

  const unpaidVolumeCents = trades
    .filter((row) => row.status !== "booked" && row.status !== "claimed" && row.status !== "volume_settled")
    .reduce((sum, row) => sum + Math.max(0, row.notionalUsdCents), 0);
  const unpaidRaw = qualifiesVolume ? computeRewardCents(unpaidVolumeCents, conversionBps) : 0;
  const unpaidRewardCents = unpaidRaw >= MIN_REWARD_CENTS ? unpaidRaw : 0;

  return {
    transferCount: rows.length,
    totalVolumeCents,
    estimatedTotalRewardCents,
    unpaidRewardCents,
    qualifiesVolume,
    conversionBps,
    minNotionalUsdCents,
  };
}
