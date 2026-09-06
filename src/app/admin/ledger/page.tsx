import { redirect } from "next/navigation";
import { adminLedger } from "@/lib/admin/liability";
import { getAdminSession } from "@/lib/auth/admin";

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function AdminLedgerPage() {
  const admin = await getAdminSession();
  if (!admin) redirect("/admin");
  const { totals, entries, swaps } = await adminLedger();

  return (
    <div className="space-y-12">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">Pool vs liability</p>
        <h1 className="mt-3 text-3xl tracking-tight text-zinc-100">Ledger</h1>
      </div>
      <dl className="grid grid-cols-2 gap-6 text-sm md:grid-cols-3">
        <div>
          <dt className="text-zinc-500">Website credit</dt>
          <dd className="mt-1 font-mono text-zinc-100">{money(totals.userCreditsCents)}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">User USDT</dt>
          <dd className="mt-1 font-mono text-zinc-100">{money(totals.userUsdtCents)}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">User LLM</dt>
          <dd className="mt-1 font-mono text-zinc-100">{money(totals.userLlmCents)}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Expense</dt>
          <dd className="mt-1 font-mono text-zinc-100">{money(totals.rewardsExpenseCents)}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Payout pool</dt>
          <dd className="mt-1 font-mono text-zinc-100">{money(totals.payoutPoolCents)}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Redemption pool</dt>
          <dd className="mt-1 font-mono text-zinc-100">{money(totals.redemptionPoolCents)}</dd>
        </div>
      </dl>
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
      <div>
        <h2 className="text-xl tracking-tight text-zinc-100">Recent fills</h2>
        <ul className="mt-4 divide-y divide-white/8 border-y border-white/8">
          {swaps.map((fill) => (
            <li key={fill.id} className="flex items-center justify-between py-4">
              <p className="font-mono text-sm text-zinc-100">
                {fill.fromChain} → {fill.toChain}
              </p>
              <p className="font-mono text-sm text-zinc-400">{fill.status}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
