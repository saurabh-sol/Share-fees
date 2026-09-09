"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { NotchedButton } from "@/components/ui/NotchedButton";
import {
  HOLDER_MIN_TOKENS,
  HOLDER_REWARD_CENTS,
  holderHoldLabel,
} from "@/lib/holder/constants";

type Verification = {
  id: string;
  status: string;
  remainingMs: number;
  holdComplete: boolean;
  rewardCents: number;
  failureReason: string | null;
  creditedAt: string | null;
};

type HolderStatus = {
  walletAddress: string;
  requiredTokens: number;
  rewardCents: number;
  holdMs: number;
  balance: { human: string; meetsRequirement: boolean } | null;
  verification: Verification | null;
  alreadyCredited: boolean;
  creditedAt: string | null;
  checks: Array<{ balanceRaw: string; meetsRequirement: boolean; checkedAt: string }>;
};

function money(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatCountdown(ms: number) {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function formatTokens(value: string) {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function HolderVerifyDesk({ initial }: { initial: HolderStatus }) {
  const [state, setState] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/v1/holder/status", { cache: "no-store" });
    if (!res.ok) return;
    setState((await res.json()) as HolderStatus);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setTick((v) => v + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const pending = state.verification?.status === "pending";
    if (!pending && !state.alreadyCredited) return;
    const id = window.setInterval(() => void refresh(), 15_000);
    return () => window.clearInterval(id);
  }, [refresh, state.verification?.status, state.alreadyCredited]);

  async function startVerification() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/holder/verify", { method: "POST" });
      const body = (await res.json()) as { error?: string; message?: string; verification?: Verification };
      if (!res.ok) {
        setError(body.message ?? body.error ?? "Could not start verification.");
        return;
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const verification = state.verification;
  const remainingMs = verification
    ? Math.max(0, verification.remainingMs - tick * 1000)
    : 0;
  const isPending = verification?.status === "pending";
  const isCredited = state.alreadyCredited || verification?.status === "credited";
  const isFailed = verification?.status === "failed";

  return (
    <div className="space-y-10">
      <section className="max-w-[65ch] space-y-4 border-y border-white/8 py-8">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">$ACCR holder check</p>
        <h1 className="text-3xl tracking-tight text-zinc-100">Verify holder</h1>
        <p className="text-sm leading-relaxed text-zinc-400">
          Hold at least {HOLDER_MIN_TOKENS.toLocaleString()} $ACCR in your connected wallet on Robinhood Chain
          for {holderHoldLabel()}. When the timer completes and your balance still qualifies, the desk credits{" "}
          {money(HOLDER_REWARD_CENTS)} website credit automatically.
        </p>
        <p className="font-mono text-xs text-zinc-500">
          Wallet · {state.walletAddress.slice(0, 6)}…{state.walletAddress.slice(-4)}
        </p>
      </section>

      <section className="grid gap-6 border border-white/8 md:grid-cols-3">
        <div className="border-b border-white/8 px-4 py-6 md:border-b-0 md:border-r">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500">Your balance</p>
          <p className="mt-2 font-mono text-2xl tabular-nums text-zinc-100">
            {state.balance ? formatTokens(state.balance.human) : "—"}
          </p>
          <p className="mt-1 text-sm text-zinc-400">$ACCR on Robinhood Chain</p>
        </div>
        <div className="border-b border-white/8 px-4 py-6 md:border-b-0 md:border-r">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500">Required</p>
          <p className="mt-2 font-mono text-2xl tabular-nums text-zinc-100">
            {state.requiredTokens.toLocaleString()}
          </p>
          <p className="mt-1 text-sm text-zinc-400">Minimum hold</p>
        </div>
        <div className="px-4 py-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500">Reward</p>
          <p className="mt-2 font-mono text-2xl tabular-nums text-accent">{money(state.rewardCents)}</p>
          <p className="mt-1 text-sm text-zinc-400">Website credit</p>
        </div>
      </section>

      {isCredited ? (
        <section className="space-y-4 border border-accent/30 bg-accent/5 px-4 py-6 md:px-6">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">Eligible · credited</p>
          <p className="text-sm leading-relaxed text-zinc-300">
            {money(HOLDER_REWARD_CENTS)} is on your desk balance. Convert to USDG on Balances, then Redeem and
            claim to your wallet — same path as scan rewards.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/app" className="font-mono text-sm text-accent underline underline-offset-4">
              Balances
            </Link>
            <Link href="/app/redeem" className="font-mono text-sm text-zinc-300 underline underline-offset-4">
              Redeem
            </Link>
            <Link href="/app/claims" className="font-mono text-sm text-zinc-300 underline underline-offset-4">
              Activity
            </Link>
          </div>
        </section>
      ) : isFailed ? (
        <section className="space-y-4 border border-red-500/30 bg-red-500/5 px-4 py-6 md:px-6">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-red-300">Verification failed</p>
          <p className="text-sm text-zinc-300">
            Balance dropped below {HOLDER_MIN_TOKENS.toLocaleString()} $ACCR during the hold window. Start again when you qualify.
          </p>
          <NotchedButton type="button" onClick={() => void startVerification()} disabled={busy}>
            {busy ? "Checking…" : "Retry verification"}
          </NotchedButton>
        </section>
      ) : isPending ? (
        <section className="space-y-4 border border-white/8 px-4 py-6 md:px-6">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">Hold timer</p>
          <p className="font-mono text-5xl tabular-nums tracking-tight text-zinc-100">
            {formatCountdown(remainingMs)}
          </p>
          <p className="text-sm text-zinc-400">
            Keep at least {HOLDER_MIN_TOKENS.toLocaleString()} $ACCR in this wallet. The desk re-checks your balance until the timer hits
            zero, then posts {money(HOLDER_REWARD_CENTS)} credit.
          </p>
        </section>
      ) : (
        <section className="space-y-4 border border-white/8 px-4 py-6 md:px-6">
          <p className="text-sm text-zinc-400">
            {state.balance?.meetsRequirement
              ? `You qualify. Start the ${holderHoldLabel()} hold to lock in your reward.`
              : `You need at least ${HOLDER_MIN_TOKENS.toLocaleString()} $ACCR in the connected wallet on Robinhood Chain.`}
          </p>
          {error ? <p className="text-sm text-red-300">{error}</p> : null}
          <NotchedButton
            type="button"
            onClick={() => void startVerification()}
            disabled={busy || !state.balance?.meetsRequirement}
          >
            {busy ? "Starting…" : `Start ${holderHoldLabel()} hold`}
          </NotchedButton>
        </section>
      )}

      {state.checks.length > 0 ? (
        <section className="space-y-3">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">Balance snapshots</p>
          <ul className="divide-y divide-white/8 border border-white/8">
            {state.checks.map((check) => (
              <li
                key={check.checkedAt}
                className="flex items-center justify-between gap-4 px-4 py-3 font-mono text-xs text-zinc-400"
              >
                <span>{new Date(check.checkedAt).toLocaleString()}</span>
                <span className={check.meetsRequirement ? "text-zinc-200" : "text-red-300"}>
                  {check.meetsRequirement ? "Qualified" : "Below minimum"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
