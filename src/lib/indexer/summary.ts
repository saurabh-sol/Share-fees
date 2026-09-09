import {
  DEFAULT_CONVERSION_BPS,
  MIN_NOTIONAL_USD_CENTS,
  MIN_REWARD_CENTS,
  VOLUME_COMPLETION_REWARD_CENTS,
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
  const estimatedTotalRewardCents =
    qualifiesVolume && VOLUME_COMPLETION_REWARD_CENTS >= MIN_REWARD_CENTS
      ? VOLUME_COMPLETION_REWARD_CENTS
      : 0;

  const hasUnpaidVolume = trades.some(
    (row) =>
      row.status !== "booked" && row.status !== "claimed" && row.status !== "volume_settled",
  );
  const unpaidRewardCents =
    qualifiesVolume && hasUnpaidVolume ? VOLUME_COMPLETION_REWARD_CENTS : 0;

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
