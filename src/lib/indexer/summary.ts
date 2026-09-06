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
};

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
  const totalVolumeCents = trades.reduce((sum, row) => sum + Math.max(0, row.notionalUsdCents), 0);
  const qualifiesVolume = totalVolumeCents >= minNotionalUsdCents;
  const rawReward = qualifiesVolume ? computeRewardCents(totalVolumeCents, conversionBps) : 0;
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
