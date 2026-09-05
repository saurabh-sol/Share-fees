import Link from "next/link";
import { listUnclaimed } from "@/lib/indexer/claim";

export async function ClaimsBanner({ userId }: { userId: string }) {
  const claims = await listUnclaimed(userId);
  if (claims.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 border-y border-white/8 py-5 md:flex-row md:items-center md:justify-between">
      <p className="text-sm text-zinc-300">
        {claims.length} qualifying historical fill{claims.length === 1 ? "" : "s"} waiting to be claimed.
      </p>
      <Link href="/app/claims" className="text-sm text-[#c23a3a]">
        Open claims
      </Link>
    </div>
  );
}
