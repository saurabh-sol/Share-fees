import { and, eq, gte, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { aiGenerations } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { AiCreateError } from "./errors";
import { countActiveAiJobs } from "./ledger";
import { aiCreateProviderSpendToday } from "./stats";

function startOfUtcDay() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function assertAiCreateGuards(userId: string) {
  if (!env.aiCreateEnabled || !env.replicateApiToken) {
    throw new AiCreateError("ai_create_disabled", 503);
  }

  const active = await countActiveAiJobs(userId);
  if (active >= env.aiCreateMaxConcurrent) {
    throw new AiCreateError("concurrent_jobs_limit", 429);
  }

  const db = await getDb();
  const dayStart = startOfUtcDay();

  const [userRow] = await db
    .select({
      spentCents: sql<number>`coalesce(sum(coalesce(${aiGenerations.finalCostCents}, ${aiGenerations.reservedCreditCents})), 0)`,
    })
    .from(aiGenerations)
    .where(
      and(
        eq(aiGenerations.userId, userId),
        gte(aiGenerations.createdAt, dayStart),
        sql`${aiGenerations.status} != 'failed'`,
      ),
    );

  const userSpentToday = Number(userRow?.spentCents ?? 0);
  if (userSpentToday >= env.aiCreateDailyCapCents) {
    throw new AiCreateError("daily_user_cap", 429);
  }

  const globalSpentToday = await aiCreateProviderSpendToday(db);
  if (globalSpentToday >= env.replicateDailyBudgetCents) {
    throw new AiCreateError("provider_daily_budget", 503);
  }
}
