import { redirect } from "next/navigation";
import Link from "next/link";
import { formatUnits } from "viem";
import { getSession } from "@/lib/auth/session";
import { getDepositStats } from "@/lib/deposit/service";
import { pageTitle } from "@/lib/brand";

export const metadata = {
  title: pageTitle("Deposit stats"),
  description: "Aggregate ACCR deposit statistics for Accrued desk users.",
};

function money(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default async function DepositStatsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const stats = await getDepositStats();
  const totalAccrHuman = formatUnits(BigInt(stats.totalAccrRaw || "0"), 18);

  return (
    <div className="space-y-10">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">Accrued v2</p>
        <h1 className="mt-3 text-3xl tracking-tight text-zinc-100">Deposit stats</h1>
        <p className="mt-3 max-w-[65ch] text-zinc-400">
          Aggregate desk deposits across all users. Authenticated view only.
        </p>
        <Link
          href="/app/deposit"
          className="mt-4 inline-block text-sm text-accent underline-offset-2 hover:underline"
        >
          ← Back to deposit
        </Link>
      </div>

      <dl className="grid grid-cols-2 divide-x divide-white/8 border-y border-white/8 sm:grid-cols-3 lg:grid-cols-5">
        <div className="px-4 py-8">
          <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">Depositors</dt>
          <dd className="mt-2 font-mono text-2xl tabular-nums text-zinc-100">
            {stats.uniqueDepositors.toLocaleString()}
          </dd>
        </div>
        <div className="px-4 py-8">
          <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">Deposits</dt>
          <dd className="mt-2 font-mono text-2xl tabular-nums text-zinc-100">
            {stats.totalDeposits.toLocaleString()}
          </dd>
        </div>
        <div className="px-4 py-8">
          <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">Total ACCR</dt>
          <dd className="mt-2 font-mono text-2xl tabular-nums text-zinc-100">
            {Number(totalAccrHuman).toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </dd>
        </div>
        <div className="px-4 py-8">
          <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">Total USD</dt>
          <dd className="mt-2 font-mono text-2xl tabular-nums text-accent">{money(stats.totalUsdCents)}</dd>
        </div>
        <div className="col-span-2 px-4 py-8 sm:col-span-1 lg:col-span-1">
          <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">Bonus issued</dt>
          <dd className="mt-2 font-mono text-2xl tabular-nums text-zinc-100">
            {money(stats.totalDisplayCreditCents)}
          </dd>
        </div>
      </dl>

      {stats.lastDepositAt ? (
        <p className="font-mono text-xs text-zinc-500">
          Last deposit: {new Date(stats.lastDepositAt).toLocaleString()}
        </p>
      ) : (
        <p className="font-mono text-xs text-zinc-500">No credited deposits yet.</p>
      )}
    </div>
  );
}
