import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { listWalletActivity } from "@/lib/indexer/claim";
import { MIN_NOTIONAL_USD_CENTS, computeRewardCents, getActiveRuleOrNull } from "@/lib/rules/engine";
import { ClaimsInbox } from "@/components/app/ClaimsInbox";

export default async function ClaimsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [rows, rule] = await Promise.all([listWalletActivity(session.user.id), getActiveRuleOrNull()]);
  const floor = rule?.minNotionalUsdCents ?? MIN_NOTIONAL_USD_CENTS;

  return (
    <div className="space-y-8">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">Activity</p>
        <h1 className="mt-3 text-3xl tracking-tight text-zinc-100">Wallet transfers</h1>
        <p className="mt-3 max-w-[65ch] text-zinc-400">
          Every scanned transfer shows its USD value. Rewards only post on $500+ swaps, and the same hash never pays
          twice.
        </p>
      </div>
      <ClaimsInbox
        autoScan={Boolean(env.zerionApiKey)}
        minNotionalUsdCents={floor}
        initialClaims={rows.map((row) => ({
          id: row.id,
          txHash: row.txHash,
          fromChain: row.fromChain,
          toChain: row.toChain,
          fromToken: row.fromToken,
          toToken: row.toToken,
          notionalUsdCents: row.notionalUsdCents,
          estimatedRewardCents:
            row.status === "unclaimed" && rule
              ? computeRewardCents(row.notionalUsdCents, rule.conversionBps)
              : 0,
          executedAt: row.executedAt.toISOString(),
          provider: row.provider,
          status: row.status,
          kind: row.kind,
        }))}
      />
    </div>
  );
}
