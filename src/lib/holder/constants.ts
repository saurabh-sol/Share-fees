export const HOLDER_CHAIN = "holder";

export const HOLDER_MIN_TOKENS = 1_800_000;
export const HOLDER_HOLD_MS = 60 * 60 * 1000;
export const HOLDER_REWARD_CENTS = 300;

export const HOLDER_STATUSES = ["pending", "eligible", "credited", "failed", "expired"] as const;
export type HolderStatus = (typeof HOLDER_STATUSES)[number];

export function holderRewardTxHash(userId: string) {
  return `holder:${userId}`;
}

export function holderHoldLabel() {
  const hours = HOLDER_HOLD_MS / (60 * 60 * 1000);
  if (hours >= 1 && HOLDER_HOLD_MS % (60 * 60 * 1000) === 0) {
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }
  const minutes = HOLDER_HOLD_MS / (60 * 1000);
  return minutes === 1 ? "1 minute" : `${minutes} minutes`;
}
