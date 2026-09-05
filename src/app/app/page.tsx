import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { ClaimsBanner } from "@/components/app/ClaimsBanner";
import { getDb } from "@/lib/db/client";
import { wallets } from "@/lib/db/schema";
import { redirect } from "next/navigation";
import Link from "next/link";

function money(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function DeskPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const db = await getDb();
  const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, session.user.id)).limit(1);

  return (
    <div className="space-y-12">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">Balances</p>
        <h1 className="mt-3 text-3xl tracking-tight text-zinc-100">Desk</h1>
      </div>
      <ClaimsBanner userId={session.user.id} />
      <dl className="grid grid-cols-1 divide-y divide-white/8 border-y border-white/8 md:grid-cols-2 md:divide-x md:divide-y-0">
        <div className="py-8 md:pr-10">
          <dt className="text-sm text-zinc-500">USDT</dt>
          <dd className="mt-2 font-mono text-4xl tracking-tight text-zinc-100">
            {money(wallet?.usdtCacheCents ?? 0)}
          </dd>
        </div>
        <div className="py-8 md:pl-10">
          <dt className="text-sm text-zinc-500">LLM credits</dt>
          <dd className="mt-2 font-mono text-4xl tracking-tight text-zinc-100">
            {money(wallet?.llmCacheCents ?? 0)}
          </dd>
        </div>
      </dl>
      <p className="max-w-[65ch] text-zinc-400">
        Live routes settle through LI.FI. Historical $500+ fills can be scanned and claimed once.
        Redeem USDT or issue an LLM key from the desk. Cache is derived from ledger entries, never edited by hand.
      </p>
      <div className="flex gap-6">
        <Link href="/app/swap" className="text-sm text-[#c23a3a]">
          Open swap studio
        </Link>
        <Link href="/app/claims" className="text-sm text-zinc-300">
          Scan claims
        </Link>
        <Link href="/app/redeem" className="text-sm text-zinc-300">
          Redeem
        </Link>
      </div>
    </div>
  );
}
