import { and, desc, eq, gte, isNull, lte, or } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { rewardRules, type RewardRule } from "@/lib/db/schema";

export const MIN_NOTIONAL_USD_CENTS = 50_000;
export const MAX_NOTIONAL_USD_CENTS = 1_000_000_000;

export function computeRewardCents(
  notionalUsdCents: number,
  conversionBps: number,
): number {
  if (!Number.isInteger(notionalUsdCents) || notionalUsdCents < 0) {
    throw new Error("invalid_notional");
  }
  if (!Number.isInteger(conversionBps) || conversionBps < 0 || conversionBps > 10_000) {
    throw new Error("invalid_conversion_bps");
  }
  return Math.floor((notionalUsdCents * conversionBps) / 10_000);
}

export async function getActiveRule(db?: Awaited<ReturnType<typeof getDb>>): Promise<RewardRule> {
  const client = db ?? (await getDb());
  const now = new Date();
  const rows = await client
    .select()
    .from(rewardRules)
    .where(
      and(
        eq(rewardRules.enabled, 1),
        lte(rewardRules.activeFrom, now),
        or(isNull(rewardRules.activeTo), gte(rewardRules.activeTo, now)),
      ),
    )
    .orderBy(desc(rewardRules.version))
    .limit(1);

  const rule = rows[0];
  if (!rule) {
    throw new Error("no_active_reward_rule");
  }
  return rule;
}
