import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { swaps } from "@/lib/db/schema";

export async function HeldBanner({ userId }: { userId: string }) {
  const db = await getDb();
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(swaps)
    .where(and(eq(swaps.userId, userId), eq(swaps.status, "held")));
  const count = Number(row?.count ?? 0);
  if (count === 0) return null;

  return (
    <p className="border-y border-white/8 py-5 text-sm text-zinc-300">
      {count} fill{count === 1 ? "" : "s"} held for review. The swap went through; the reward did not.
    </p>
  );
}
