import Link from "next/link";
import { listUnclaimed, listWalletActivity } from "@/lib/indexer/claim";

function money(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export async function ClaimsBanner({ userId }: { userId: string }) {
  const [activity, claims] = await Promise.all([listWalletActivity(userId), listUnclaimed(userId)]);
  if (activity.length === 0) return null;

  const totalCents = activity.reduce((sum, row) => sum + row.notionalUsdCents, 0);

  return (
    <div className="flex flex-col gap-3 border-y border-white/8 py-5 md:flex-row md:items-center md:justify-between">
      <p className="text-sm text-zinc-300">
        {activity.length} wallet transfer{activity.length === 1 ? "" : "s"} totaling {money(totalCents)}.{" "}
        {claims.length} at $500+ waiting to be claimed.
      </p>
      <Link href="/app/claims" className="text-sm text-[#c23a3a]">
        Open activity
      </Link>
    </div>
  );
}
