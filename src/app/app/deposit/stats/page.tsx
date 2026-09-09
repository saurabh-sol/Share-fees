import { redirect } from "next/navigation";
import Link from "next/link";
import { formatUnits } from "viem";
import { getSession } from "@/lib/auth/session";
import { getDepositStats, listDepositLeaderboard } from "@/lib/deposit/service";
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

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export default async function DepositStatsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  let stats: Awaited<ReturnType<typeof getDepositStats>> = {
    uniqueDepositors: 0,
    totalDeposits: 0,
    totalAccrRaw: "0",
    totalUsdCents: 0,
    totalDisplayCreditCents: 0,
    lastDepositAt: null,
  };
  let leaderboard: Awaited<ReturnType<typeof listDepositLeaderboard>> = [];
  try {
    [stats, leaderboard] = await Promise.all([getDepositStats(), listDepositLeaderboard()]);
  } catch (error) {
    console.error("[deposit/stats] load failed", error);
  }
  const totalAccrHuman = formatUnits(BigInt(stats.totalAccrRaw || "0"), 18);

  return (
    <div className="space-y-10">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">Accrued v2</p>
        <h1 className="mt-3 text-3xl tracking-tight text-zinc-100">Deposit stats</h1>
        <p className="mt-3 max-w-[65ch] text-zinc-400">
          Public leaderboard for all signed-in desk users. See who deposited ACCR and how much bonus
          credit was issued.
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

      <section className="space-y-4">
        <div>
          <h2 className="text-xl tracking-tight text-zinc-100">Depositor leaderboard</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Every connected wallet can see credited ACCR deposits ranked by USD value.
          </p>
        </div>

        {leaderboard.length === 0 ? (
          <p className="font-mono text-sm text-zinc-500">No deposits to show yet.</p>
        ) : (
          <div className="overflow-x-auto border border-white/8">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/8 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                  <th className="px-4 py-3 font-normal">#</th>
                  <th className="px-4 py-3 font-normal">Wallet</th>
                  <th className="px-4 py-3 font-normal text-right">Deposits</th>
                  <th className="px-4 py-3 font-normal text-right">ACCR</th>
                  <th className="px-4 py-3 font-normal text-right">USD</th>
                  <th className="px-4 py-3 font-normal text-right">Bonus</th>
                  <th className="px-4 py-3 font-normal text-right">Last</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/8">
                {leaderboard.map((row, index) => {
                  const isYou =
                    row.address.toLowerCase() === session.user.address.toLowerCase();
                  return (
                    <tr key={row.address} className={isYou ? "bg-accent/5" : undefined}>
                      <td className="px-4 py-3 font-mono tabular-nums text-zinc-500">{index + 1}</td>
                      <td className="px-4 py-3 font-mono text-zinc-200">
                        {shortAddress(row.address)}
                        {isYou ? (
                          <span className="ml-2 text-[10px] uppercase tracking-wider text-accent">You</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-zinc-300">
                        {row.depositCount}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-zinc-300">
                        {Number(row.totalAccrHuman).toLocaleString(undefined, {
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-accent">
                        {money(row.totalUsdCents)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-zinc-200">
                        {money(row.totalDisplayCreditCents)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-zinc-500">
                        {row.lastDepositAt
                          ? new Date(row.lastDepositAt).toLocaleDateString()
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
