import { desc, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { discoveredSwaps } from "@/lib/db/schema";
import { jsonError } from "@/lib/security/origin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getSession(request);
  if (!session) {
    return jsonError(401, "unauthenticated", "Sign in with a wallet first.");
  }

  const db = await getDb();
  const rows = await db
    .select({
      txHash: discoveredSwaps.txHash,
      fromToken: discoveredSwaps.fromToken,
      toToken: discoveredSwaps.toToken,
      notionalUsdCents: discoveredSwaps.notionalUsdCents,
      executedAt: discoveredSwaps.executedAt,
    })
    .from(discoveredSwaps)
    .where(eq(discoveredSwaps.userId, session.user.id))
    .orderBy(desc(discoveredSwaps.executedAt))
    .limit(50);

  const swaps = rows.map((r) => ({
    txHash: r.txHash,
    fromToken: r.fromToken,
    toToken: r.toToken,
    notionalUsdCents: r.notionalUsdCents,
    executedAt: r.executedAt.toISOString(),
  }));

  return Response.json({ swaps }, { headers: { "Cache-Control": "private, no-store" } });
}
