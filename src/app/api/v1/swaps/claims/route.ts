import { getSession } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { listUnclaimed } from "@/lib/indexer/claim";
import { jsonError } from "@/lib/security/origin";
import { computeRewardCents, getActiveRule } from "@/lib/rules/engine";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return jsonError(401, "unauthenticated", "Sign in with a wallet first.");
  }

  const [claims, rule] = await Promise.all([
    listUnclaimed(session.user.id),
    getActiveRule(),
  ]);

  return Response.json({
    claims: claims.map((row) => ({
      ...row,
      estimatedRewardCents: computeRewardCents(row.notionalUsdCents, rule.conversionBps),
    })),
    rule: {
      conversionBps: rule.conversionBps,
      minNotionalUsdCents: rule.minNotionalUsdCents,
    },
    autoScan: Boolean(env.zerionApiKey),
  });
}
