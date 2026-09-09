import { getSession } from "@/lib/auth/session";
import { listDepositHistory } from "@/lib/deposit/service";
import { jsonError } from "@/lib/security/origin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getSession(request);
  if (!session) {
    return jsonError(401, "unauthenticated", "Sign in with a wallet first.");
  }

  const rows = await listDepositHistory(session.user.id);
  return Response.json(
    {
      deposits: rows.map((row) => ({
        id: row.id,
        usdCents: row.usdCents,
        tokenAmountHuman: row.tokenAmountHuman,
        displayCreditCents: row.displayCreditCents,
        txHash: row.txHash,
        status: row.status,
        createdAt: row.createdAt.toISOString(),
      })),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
