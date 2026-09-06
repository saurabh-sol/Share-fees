import { desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { changenowExchanges, fraudFlags, ledgerEntries, payoutOutbox, swaps, users } from "@/lib/db/schema";

export async function accountTotals(db?: Awaited<ReturnType<typeof getDb>>) {
  const client = db ?? (await getDb());
  const rows = await client
    .select({
      account: ledgerEntries.account,
      total: sql<number>`coalesce(sum(case when ${ledgerEntries.type} = 'credit' then ${ledgerEntries.amountCents} else -${ledgerEntries.amountCents} end), 0)`,
    })
    .from(ledgerEntries)
    .groupBy(ledgerEntries.account);

  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(row.account, Number(row.total ?? 0));
  }
  return {
    userCreditsCents: map.get("user_credits") ?? 0,
    userUsdtCents: map.get("user_usdt") ?? 0,
    userLlmCents: map.get("user_llm") ?? 0,
    rewardsExpenseCents: -(map.get("rewards_expense") ?? 0),
    payoutPoolCents: map.get("payout_pool") ?? 0,
    redemptionPoolCents: map.get("redemption_pool") ?? 0,
  };
}

export async function adminOverview(db?: Awaited<ReturnType<typeof getDb>>) {
  const client = db ?? (await getDb());
  const [totals, openFlags, queuedPayouts, heldSwaps, userCount, pendingNow] = await Promise.all([
    accountTotals(client),
    client
      .select({ count: sql<number>`count(*)` })
      .from(fraudFlags)
      .where(eq(fraudFlags.status, "open"))
      .then((rows) => Number(rows[0]?.count ?? 0)),
    client
      .select({ count: sql<number>`count(*)` })
      .from(payoutOutbox)
      .where(eq(payoutOutbox.status, "queued"))
      .then((rows) => Number(rows[0]?.count ?? 0)),
    client
      .select({ count: sql<number>`count(*)` })
      .from(swaps)
      .where(eq(swaps.status, "held"))
      .then((rows) => Number(rows[0]?.count ?? 0)),
    client.select({ count: sql<number>`count(*)` }).from(users).then((rows) => Number(rows[0]?.count ?? 0)),
    client
      .select({ count: sql<number>`count(*)` })
      .from(changenowExchanges)
      .where(inArray(changenowExchanges.status, ["new", "waiting", "confirming", "exchanging", "sending"]))
      .then((rows) => Number(rows[0]?.count ?? 0)),
  ]);

  const liabilityCents = totals.userCreditsCents + totals.userUsdtCents + totals.userLlmCents;
  return {
    ...totals,
    liabilityCents,
    openFlags,
    queuedPayouts,
    heldSwaps,
    userCount,
    pendingChangeNow: pendingNow,
  };
}

export async function listChangeNowExchanges(db?: Awaited<ReturnType<typeof getDb>>) {
  const client = db ?? (await getDb());
  return client.select().from(changenowExchanges).orderBy(desc(changenowExchanges.createdAt)).limit(40);
}

export async function adminLedger(db?: Awaited<ReturnType<typeof getDb>>) {
  const client = db ?? (await getDb());
  const [totals, entries, recentSwaps] = await Promise.all([
    accountTotals(client),
    client.select().from(ledgerEntries).orderBy(desc(ledgerEntries.createdAt)).limit(50),
    client.select().from(swaps).orderBy(desc(swaps.createdAt)).limit(20),
  ]);
  return { totals, entries, swaps: recentSwaps };
}

export async function listOpenFlags(db?: Awaited<ReturnType<typeof getDb>>) {
  const client = db ?? (await getDb());
  const flags = await client
    .select()
    .from(fraudFlags)
    .where(eq(fraudFlags.status, "open"))
    .orderBy(desc(fraudFlags.createdAt))
    .limit(50);

  const swapIds = flags.map((row) => row.swapId).filter((id): id is string => Boolean(id));
  const related =
    swapIds.length === 0 ? [] : await client.select().from(swaps).where(inArray(swaps.id, swapIds));
  const byId = new Map(related.map((row) => [row.id, row]));
  return flags.map((flag) => ({
    ...flag,
    swap: flag.swapId ? (byId.get(flag.swapId) ?? null) : null,
  }));
}
