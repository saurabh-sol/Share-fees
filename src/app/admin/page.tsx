import { AdminLogin } from "@/components/admin/AdminLogin";
import { adminOverview } from "@/lib/admin/liability";
import { getAdminSession } from "@/lib/auth/admin";

function money(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function pct(bps: number) {
  return `${(bps / 100).toFixed(1)}%`;
}

export default async function AdminHomePage() {
  const admin = await getAdminSession();
  if (!admin) {
    return <AdminLogin />;
  }

  const overview = await adminOverview();
  const ai = overview.aiCreate;

  return (
    <div className="space-y-10">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">Operations</p>
        <h1 className="mt-3 text-3xl tracking-tight text-zinc-100">Overview</h1>
        <p className="mt-3 max-w-[65ch] text-zinc-400">
          User balances are liability. Expense is what the desk has already booked. Pools are redeemed but not yet
          settled out.
        </p>
      </div>
      <dl className="grid grid-cols-1 divide-y divide-white/8 border-y border-white/8 md:grid-cols-2 md:divide-x md:divide-y-0">
        <div className="py-8 md:pr-10">
          <dt className="text-sm text-zinc-500">User liability</dt>
          <dd className="mt-2 font-mono text-4xl tracking-tight text-zinc-100">{money(overview.liabilityCents)}</dd>
          <p className="mt-2 font-mono text-xs text-zinc-500">
            Credit {money(overview.userCreditsCents)} · USDG {money(overview.userUsdtCents)} · LLM{" "}
            {money(overview.userLlmCents)}
          </p>
        </div>
        <div className="py-8 md:pl-10">
          <dt className="text-sm text-zinc-500">Rewards expense</dt>
          <dd className="mt-2 font-mono text-4xl tracking-tight text-zinc-100">
            {money(overview.rewardsExpenseCents)}
          </dd>
          <p className="mt-2 font-mono text-xs text-zinc-500">
            Payout pool {money(overview.payoutPoolCents)} · Redemption pool {money(overview.redemptionPoolCents)}
          </p>
        </div>
      </dl>

      <div
        className={`border px-4 py-4 ${
          ai.atBudget ? "border-accent bg-accent/5" : ai.nearBudget ? "border-amber-500/40 bg-amber-500/5" : "border-white/10"
        }`}
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">AI Create provider spend (UTC day)</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <p className="font-mono text-3xl text-zinc-100">
            {money(ai.spendTodayCents)} <span className="text-lg text-zinc-500">/ {money(ai.budgetCents)}</span>
          </p>
          <p className={`font-mono text-sm ${ai.nearBudget ? "text-accent" : "text-zinc-400"}`}>
            {pct(ai.utilizationBps)} used
          </p>
        </div>
        <p className="mt-2 font-mono text-xs text-zinc-500">
          Active jobs {ai.activeJobs} · Holds {money(ai.holdCents)} · Succeeded today {ai.succeededToday}
        </p>
        {ai.atBudget ? (
          <p className="mt-3 text-sm text-accent">Daily Replicate budget reached — new generations are blocked.</p>
        ) : ai.nearBudget ? (
          <p className="mt-3 text-sm text-amber-200/90">Above 80% of daily provider budget.</p>
        ) : null}
      </div>

      <dl className="grid grid-cols-2 gap-6 text-sm md:grid-cols-5">
        <div>
          <dt className="text-zinc-500">Open holds</dt>
          <dd className="mt-1 font-mono text-2xl text-zinc-100">{overview.openFlags}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Held swaps</dt>
          <dd className="mt-1 font-mono text-2xl text-zinc-100">{overview.heldSwaps}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Queued payouts</dt>
          <dd className="mt-1 font-mono text-2xl text-zinc-100">{overview.queuedPayouts}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Wallets</dt>
          <dd className="mt-1 font-mono text-2xl text-zinc-100">{overview.userCount}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Pay-ins open</dt>
          <dd className="mt-1 font-mono text-2xl text-zinc-100">{overview.pendingChangeNow}</dd>
        </div>
      </dl>
    </div>
  );
}
