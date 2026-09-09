export const HOLDER_CHAIN = "holder";

export const HOLDER_MIN_TOKENS = 1_000_000;
export const HOLDER_HOLD_MS = 30 * 60 * 1000;
export const HOLDER_REWARD_CENTS = 1500;

export const HOLDER_STATUSES = ["pending", "eligible", "credited", "failed", "expired"] as const;
export type HolderStatus = (typeof HOLDER_STATUSES)[number];

export function holderRewardTxHash(userId: string) {
  return `holder:${userId}`;
}
