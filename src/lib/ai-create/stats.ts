import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { aiGenerations, ledgerEntries } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { AI_CREATE_HOLD_ACCOUNT } from "./constants";

function startOfUtcDay() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function aiCreateProviderSpendToday(db?: Awaited<ReturnType<typeof getDb>>) {
  const client = db ?? (await getDb());
  const dayStart = startOfUtcDay();
  const [row] = await client
    .select({
      spentCents: sql<number>`coalesce(sum(coalesce(${aiGenerations.finalCostCents}, 0)), 0)`,
    })
    .from(aiGenerations)
    .where(and(eq(aiGenerations.status, "succeeded"), gte(aiGenerations.completedAt, dayStart)));

  return Number(row?.spentCents ?? 0);
}

export async function aiCreateOverview(db?: Awaited<ReturnType<typeof getDb>>) {
  const client = db ?? (await getDb());
  const dayStart = startOfUtcDay();

  const [spendToday, activeJobs, holdCents, succeededToday] = await Promise.all([
    aiCreateProviderSpendToday(client),
    client
      .select({ count: sql<number>`count(*)` })
      .from(aiGenerations)
      .where(inArray(aiGenerations.status, ["pending", "processing"]))
      .then((rows) => Number(rows[0]?.count ?? 0)),
    client
      .select({
        total: sql<number>`coalesce(sum(case when ${ledgerEntries.type} = 'credit' then ${ledgerEntries.amountCents} else -${ledgerEntries.amountCents} end), 0)`,
      })
      .from(ledgerEntries)
      .where(eq(ledgerEntries.account, AI_CREATE_HOLD_ACCOUNT))
      .then((rows) => Number(rows[0]?.total ?? 0)),
    client
      .select({ count: sql<number>`count(*)` })
      .from(aiGenerations)
      .where(and(eq(aiGenerations.status, "succeeded"), gte(aiGenerations.completedAt, dayStart)))
      .then((rows) => Number(rows[0]?.count ?? 0)),
  ]);

  const budgetCents = env.replicateDailyBudgetCents;
  const utilizationBps =
    budgetCents > 0 ? Math.min(Math.round((spendToday / budgetCents) * 10_000), 10_000) : 0;

  return {
    spendTodayCents: spendToday,
    budgetCents,
    utilizationBps,
    activeJobs,
    holdCents,
    succeededToday,
    nearBudget: utilizationBps >= 8000,
    atBudget: spendToday >= budgetCents,
  };
}
