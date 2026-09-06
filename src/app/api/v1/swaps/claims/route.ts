import { getSession } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { listWalletActivity } from "@/lib/indexer/claim";
import { summarizeWalletVolume } from "@/lib/indexer/summary";
import { jsonError } from "@/lib/security/origin";
import { MIN_REWARD_CENTS, computeRewardCents, getActiveRuleOrNull } from "@/lib/rules/engine";

export async function GET(request: Request) {
  const session = await getSession(request);
  if (!session) {
    return jsonError(401, "unauthenticated", "Sign in with a wallet first.");
  }

  const [claims, rule] = await Promise.all([
    listWalletActivity(session.user.id),
    getActiveRuleOrNull(),
  ]);

  const summary = summarizeWalletVolume(claims, {
    conversionBps: rule?.conversionBps,
    minNotionalUsdCents: rule?.minNotionalUsdCents,
  });

  return Response.json({
    claims: claims.map((row) => ({
      ...row,
      estimatedRewardCents:
        row.status === "unclaimed" && rule
          ? (() => {
              const estimated = computeRewardCents(row.notionalUsdCents, rule.conversionBps);
              return estimated >= MIN_REWARD_CENTS ? estimated : 0;
            })()
          : 0,
    })),
    summary,
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
