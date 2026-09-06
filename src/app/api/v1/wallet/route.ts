import { desc, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { creditEvents, ledgerEntries, swaps, wallets } from "@/lib/db/schema";
import { jsonError } from "@/lib/security/origin";

export async function GET(request: Request) {
  const session = await getSession(request);
  if (!session) {
    return jsonError(401, "unauthenticated", "Sign in with a wallet first.");
  }

  const db = await getDb();
  const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, session.user.id)).limit(1);
  const recentSwaps = await db
    .select()
    .from(swaps)
    .where(eq(swaps.userId, session.user.id))
    .orderBy(desc(swaps.createdAt))
    .limit(20);
  const recentCredits = await db
    .select()
    .from(creditEvents)
    .where(eq(creditEvents.userId, session.user.id))
    .orderBy(desc(creditEvents.createdAt))
    .limit(20);
  const recentLedger = await db
    .select()
    .from(ledgerEntries)
    .where(eq(ledgerEntries.userId, session.user.id))
    .orderBy(desc(ledgerEntries.createdAt))
    .limit(40);

  return Response.json({
    creditCents: wallet?.creditCacheCents ?? 0,
    usdtCents: wallet?.usdtCacheCents ?? 0,
    llmCents: wallet?.llmCacheCents ?? 0,
    swaps: recentSwaps,
    credits: recentCredits,
    ledger: recentLedger,
  });
}
