import { getSession } from "@/lib/auth/session";
import { getDepositStats } from "@/lib/deposit/service";
import { formatUnits } from "viem";
import { jsonError } from "@/lib/security/origin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getSession(request);
  if (!session) {
    return jsonError(401, "unauthenticated", "Sign in with a wallet first.");
  }

  const stats = await getDepositStats();
  return Response.json(
    {
      uniqueDepositors: stats.uniqueDepositors,
      totalDeposits: stats.totalDeposits,
      totalAccrHuman: formatUnits(BigInt(stats.totalAccrRaw || "0"), 18),
      totalUsdCents: stats.totalUsdCents,
      totalDisplayCreditCents: stats.totalDisplayCreditCents,
      lastDepositAt: stats.lastDepositAt,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
