export const MIN_NOTIONAL_USD_CENTS = 25_000;
export const MAX_NOTIONAL_USD_CENTS = 1_000_000_000;
export const MIN_CONVERSION_BPS = 25;
export const MAX_CONVERSION_BPS = 100;
export const DEFAULT_CONVERSION_BPS = 50;
export const MIN_REWARD_CENTS = 100;
export const DEFAULT_DAILY_CAP_USD_CENTS = 250_000;
/** Flat website credit once scan volume clears the floor. */
export const VOLUME_COMPLETION_REWARD_CENTS = 100;

export function assertConversionBps(conversionBps: number) {
  if (
    !Number.isInteger(conversionBps) ||
    conversionBps < MIN_CONVERSION_BPS ||
    conversionBps > MAX_CONVERSION_BPS
  ) {
    throw new Error("invalid_conversion_bps");
  }
}

export function computeRewardCents(
  notionalUsdCents: number,
  conversionBps: number,
): number {
  if (!Number.isInteger(notionalUsdCents) || notionalUsdCents < 0) {
    throw new Error("invalid_notional");
  }
  assertConversionBps(conversionBps);
  return Math.floor((notionalUsdCents * conversionBps) / 10_000);
}
