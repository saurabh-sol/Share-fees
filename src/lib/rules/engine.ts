import { and, desc, eq, gte, isNull, lte, or } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { rewardRules, type RewardRule } from "@/lib/db/schema";

export {
  DEFAULT_CONVERSION_BPS,
  DEFAULT_DAILY_CAP_USD_CENTS,
  MAX_CONVERSION_BPS,
  MAX_NOTIONAL_USD_CENTS,
  MIN_CONVERSION_BPS,
  MIN_NOTIONAL_USD_CENTS,
  MIN_REWARD_CENTS,
  assertConversionBps,
  computeRewardCents,
} from "./constants";

export async function getActiveRuleOrNull(db?: Awaited<ReturnType<typeof getDb>>) {
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
  return rows[0] ?? null;
}

export async function getActiveRule(db?: Awaited<ReturnType<typeof getDb>>): Promise<RewardRule> {
  const rule = await getActiveRuleOrNull(db);
  if (!rule) {
    throw new Error("no_active_reward_rule");
  }
  return rule;
}
