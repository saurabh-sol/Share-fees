import Link from "next/link";
import { listUnclaimed, listWalletActivity } from "@/lib/indexer/claim";
import { summarizeWalletVolume } from "@/lib/indexer/summary";
import { getActiveRuleOrNull } from "@/lib/rules/engine";

function money(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export async function ClaimsBanner({ userId }: { userId: string }) {
  const [activity, claims, rule] = await Promise.all([
    listWalletActivity(userId),
    listUnclaimed(userId),
    getActiveRuleOrNull(),
  ]);
  if (activity.length === 0) return null;

  const summary = summarizeWalletVolume(activity, {
    conversionBps: rule?.conversionBps,
    minNotionalUsdCents: rule?.minNotionalUsdCents,
  });

  return (
    <div className="flex flex-col gap-3 border-y border-white/8 py-5 md:flex-row md:items-center md:justify-between">
      <p className="text-sm text-zinc-300">
        {summary.transferCount} transfer{summary.transferCount === 1 ? "" : "s"} · swap volume{" "}
        {money(summary.totalVolumeCents)}
        {summary.qualifiesVolume
          ? ` · reward ${money(summary.estimatedTotalRewardCents)} at ${summary.conversionBps} bps`
          : ` · reward listed after ${money(summary.minNotionalUsdCents)} swap volume`}
        . {claims.length} swap{claims.length === 1 ? "" : "s"} ready to claim.
      </p>
      <Link href="/app/claims" className="text-sm text-accent">
        Open activity
      </Link>
    </div>
  );
}
