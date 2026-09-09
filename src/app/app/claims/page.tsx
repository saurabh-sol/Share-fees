import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { listWalletActivity } from "@/lib/indexer/claim";
import { summarizeWalletVolume } from "@/lib/indexer/summary";
import { MIN_NOTIONAL_USD_CENTS, MIN_REWARD_CENTS, computeRewardCents, getActiveRuleOrNull } from "@/lib/rules/engine";
import { ClaimsInbox } from "@/components/app/ClaimsInbox";

function money(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default async function ClaimsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [rows, rule] = await Promise.all([listWalletActivity(session.user.id), getActiveRuleOrNull()]);
  const floor = rule?.minNotionalUsdCents ?? MIN_NOTIONAL_USD_CENTS;
  const summary = summarizeWalletVolume(rows, {
    conversionBps: rule?.conversionBps,
    minNotionalUsdCents: floor,
  });

  return (
    <div className="space-y-8">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">Activity</p>
        <h1 className="mt-3 text-3xl tracking-tight text-zinc-100">Wallet transfers</h1>
        <p className="mt-3 max-w-[65ch] text-zinc-400">
          Scan lists every confirmed transfer and sums swaps plus send/receive volume (including USDG).
          If that total clears {money(floor)}, the estimated reward at {summary.conversionBps} bps is shown.
          A single imported fill still has to be a {money(floor)}+ swap to claim on its own.
        </p>
      </div>
      <ClaimsInbox
        autoScan={Boolean(env.zerionApiKey)}
        minNotionalUsdCents={floor}
        conversionBps={summary.conversionBps}
        initialSummary={summary}
        initialClaims={rows.map((row) => ({
          id: row.id,
          txHash: row.txHash,
          fromChain: row.fromChain,
          toChain: row.toChain,
          fromToken: row.fromToken,
          toToken: row.toToken,
          fromAmount: row.fromAmount,
          toAmount: row.toAmount,
          notionalUsdCents: row.notionalUsdCents,
          estimatedRewardCents:
            row.status === "unclaimed" && rule
              ? (() => {
                  const estimated = computeRewardCents(row.notionalUsdCents, rule.conversionBps);
                  return estimated >= MIN_REWARD_CENTS ? estimated : 0;
                })()
              : 0,
          executedAt: new Date(row.executedAt).toISOString(),
          provider: row.provider,
          status: row.status,
          kind: row.kind,
        }))}
      />
    </div>
  );
}
