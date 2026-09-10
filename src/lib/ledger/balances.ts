import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { ledgerEntries, wallets } from "@/lib/db/schema";

export type LedgerAccount =
  | "user_credits"
  | "user_usdt"
  | "user_llm"
  | "user_ai_create"
  | "payout_pool";

export async function lockWalletRow(
  db: Awaited<ReturnType<typeof getDb>>,
  userId: string,
) {
  await db.execute(sql`SELECT user_id FROM wallets WHERE user_id = ${userId} FOR UPDATE`);
}

export async function sumAccountCents(
  db: Awaited<ReturnType<typeof getDb>>,
  userId: string,
  account: LedgerAccount,
): Promise<number> {
  const rows = await db
    .select({
      total: sql<number>`coalesce(sum(case when ${ledgerEntries.type} = 'credit' then ${ledgerEntries.amountCents} else -${ledgerEntries.amountCents} end), 0)`,
    })
    .from(ledgerEntries)
    .where(and(eq(ledgerEntries.userId, userId), eq(ledgerEntries.account, account)));

  return Number(rows[0]?.total ?? 0);
}

export async function syncWalletCache(
  db: Awaited<ReturnType<typeof getDb>>,
  userId: string,
) {
  const creditCents = await sumAccountCents(db, userId, "user_credits");
  const usdtCents = await sumAccountCents(db, userId, "user_usdt");
  const llmCents = await sumAccountCents(db, userId, "user_llm");
  const aiCreateCents = await sumAccountCents(db, userId, "user_ai_create");
  await db
    .insert(wallets)
    .values({
      userId,
      creditCacheCents: creditCents,
      usdtCacheCents: usdtCents,
      llmCacheCents: llmCents,
      aiCreateCacheCents: aiCreateCents,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: wallets.userId,
      set: {
        creditCacheCents: creditCents,
        usdtCacheCents: usdtCents,
        llmCacheCents: llmCents,
        aiCreateCacheCents: aiCreateCents,
        updatedAt: new Date(),
      },
    });
  return { creditCents, usdtCents, llmCents, aiCreateCents };
}
