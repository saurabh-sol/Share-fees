import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/ui/EmptyState";
import { getSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { ledgerEntries, swaps } from "@/lib/db/schema";

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function RewardsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const db = await getDb();
  const entries = await db
    .select()
    .from(ledgerEntries)
    .where(eq(ledgerEntries.userId, session.user.id))
    .orderBy(desc(ledgerEntries.createdAt))
    .limit(40);
  const fills = await db
    .select()
    .from(swaps)
    .where(eq(swaps.userId, session.user.id))
    .orderBy(desc(swaps.createdAt))
    .limit(20);

  return (
    <div className="space-y-12">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">Immutable log</p>
        <h1 className="mt-3 text-3xl tracking-tight text-zinc-100">Ledger</h1>
      </div>

      {entries.length === 0 ? (
        <EmptyState
          eyebrow="Immutable log"
          title="No ledger rows yet."
          body="Every credit, convert, and redeem posts a row here. Claim a qualifying $250+ fill and the first entry appears."
          ctaHref="/app/swap"
          ctaLabel="Claim a fill"
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-white/8 font-mono text-xs uppercase tracking-[0.12em] text-zinc-500">
              <tr>
                <th className="py-3 font-normal">Account</th>
                <th className="py-3 font-normal">Type</th>
                <th className="py-3 font-normal">Amount</th>
                <th className="py-3 font-normal">Ref</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/8">
              {entries.map((row) => (
                <tr key={row.id}>
                  <td className="py-3 font-mono text-zinc-200">{row.account}</td>
                  <td className="py-3 text-zinc-400">{row.type}</td>
                  <td className="py-3 font-mono">{money(row.amountCents)}</td>
                  <td className="py-3 font-mono text-zinc-500">{row.referenceId.slice(0, 18)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div>
        <h2 className="text-xl tracking-tight text-zinc-100">Fills</h2>
        {fills.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              eyebrow="Fills"
              title="No fills booked to this address."
              body="Swap on the desk or import a confirmed transaction from Activity — booked fills and their status land here."
              ctaHref="/app/claims"
              ctaLabel="Scan wallet activity"
            />
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-white/8 border-y border-white/8">
            {fills.map((fill) => (
              <li key={fill.id} className="flex items-center justify-between py-4">
                <div>
                  <p className="font-mono text-sm text-zinc-100">
                    {fill.fromChain} → {fill.toChain}
                  </p>
                  <p className="font-mono text-xs text-zinc-500">{fill.txHash.slice(0, 18)}…</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm">{money(fill.notionalUsdCents)}</p>
                  <p className="text-xs text-zinc-500">{fill.status}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
