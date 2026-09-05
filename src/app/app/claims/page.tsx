import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { listUnclaimed } from "@/lib/indexer/claim";
import { computeRewardCents, getActiveRule } from "@/lib/rules/engine";
import { ClaimsInbox } from "@/components/app/ClaimsInbox";

export default async function ClaimsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [rows, rule] = await Promise.all([listUnclaimed(session.user.id), getActiveRule()]);

  return (
    <div className="space-y-8">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">Phase 2</p>
        <h1 className="mt-3 text-3xl tracking-tight text-zinc-100">Claims</h1>
        <p className="mt-3 max-w-[65ch] text-zinc-400">
          Qualifying $500+ trades from the last 90 days can be claimed once. The same tx hash never pays twice.
        </p>
      </div>
      <ClaimsInbox
        autoScan={Boolean(env.zerionApiKey)}
        initialClaims={rows.map((row) => ({
          id: row.id,
          txHash: row.txHash,
          fromChain: row.fromChain,
          toChain: row.toChain,
          fromToken: row.fromToken,
          toToken: row.toToken,
          notionalUsdCents: row.notionalUsdCents,
          estimatedRewardCents: computeRewardCents(row.notionalUsdCents, rule.conversionBps),
          executedAt: row.executedAt.toISOString(),
          provider: row.provider,
        }))}
      />
    </div>
  );
}
