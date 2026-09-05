import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { ledgerEntries, wallets } from "@/lib/db/schema";

export async function sumAccountCents(
  db: Awaited<ReturnType<typeof getDb>>,
  userId: string,
  account: "user_usdt" | "user_llm",
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
  const usdtCents = await sumAccountCents(db, userId, "user_usdt");
  const llmCents = await sumAccountCents(db, userId, "user_llm");
  await db
    .insert(wallets)
    .values({
      userId,
      usdtCacheCents: usdtCents,
      llmCacheCents: llmCents,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: wallets.userId,
      set: {
        usdtCacheCents: usdtCents,
        llmCacheCents: llmCents,
        updatedAt: new Date(),
      },
    });
  return { usdtCents, llmCents };
}
