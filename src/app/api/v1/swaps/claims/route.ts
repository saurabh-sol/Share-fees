import { getSession } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { listWalletActivity } from "@/lib/indexer/claim";
import { jsonError } from "@/lib/security/origin";
import { computeRewardCents, getActiveRuleOrNull } from "@/lib/rules/engine";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return jsonError(401, "unauthenticated", "Sign in with a wallet first.");
  }

  const [claims, rule] = await Promise.all([
    listWalletActivity(session.user.id),
    getActiveRuleOrNull(),
  ]);

  return Response.json({
    claims: claims.map((row) => ({
      ...row,
      estimatedRewardCents:
        row.status === "unclaimed" && rule
          ? computeRewardCents(row.notionalUsdCents, rule.conversionBps)
          : 0,
    })),
    paused: !rule,
    rule: rule
      ? {
          conversionBps: rule.conversionBps,
          minNotionalUsdCents: rule.minNotionalUsdCents,
        }
      : null,
    autoScan: Boolean(env.zerionApiKey),
  });
}
