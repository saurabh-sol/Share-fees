import { desc, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { creditEvents, ledgerEntries, swaps } from "@/lib/db/schema";
import { syncWalletCache } from "@/lib/ledger/balances";
import { jsonError } from "@/lib/security/origin";

export async function GET(request: Request) {
  const session = await getSession(request);
  if (!session) {
    return jsonError(401, "unauthenticated", "Sign in with a wallet first.");
  }

  const db = await getDb();
  const wallet = await syncWalletCache(db, session.user.id);
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
    creditCents: wallet.creditCents,
    usdtCents: wallet.usdtCents,
    llmCents: wallet.llmCents,
    swaps: recentSwaps,
    credits: recentCredits,
    ledger: recentLedger,
  });
}
