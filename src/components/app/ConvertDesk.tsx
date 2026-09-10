"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Rail } from "@/lib/redeem/rails";
import { NotchedButton } from "@/components/ui/NotchedButton";

function money(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function newIdempotencyKey() {
  return `cnv_${crypto.randomUUID().replaceAll("-", "")}`;
}

const RAIL_LABELS: Record<Rail, string> = {
  llm_credits: "LLM credits",
  ai_create_credits: "Create credits",
  usdt: "USDG",
  stock_nvda: "NVDA",
  stock_aapl: "AAPL",
  stock_msft: "MSFT",
};

type Step =
  | { kind: "form" }
  | { kind: "review"; rail: Rail; amountCents: number; reference: string }
  | { kind: "working"; rail: Rail; amountCents: number; reference: string }
  | { kind: "success"; rail: Rail; amountCents: number; reference: string }
  | { kind: "error"; rail: Rail; amountCents: number; reference: string; reason: string };

export function ConvertDesk({
  creditCents,
  conversionBps,
  minNotionalUsdCents,
  dailyCapUsdCents,
  usdgPaused = false,
  usdgPauseMessage = "Rewards are paused due to version upgrade.",
}: {
  creditCents: number;
  conversionBps: number;
  minNotionalUsdCents: number;
  dailyCapUsdCents: number;
  usdgPaused?: boolean;
  usdgPauseMessage?: string;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState((creditCents / 100).toFixed(2));
  const [step, setStep] = useState<Step>({ kind: "form" });
  const [formError, setFormError] = useState<string | null>(null);

  function review(rail: Rail) {
    setFormError(null);
    const parsed = Number.parseFloat(amount);
    const amountCents = Math.round(parsed * 100);
    if (!Number.isFinite(amountCents) || amountCents < 100) {
      setFormError("Minimum move is $1.00.");
      return;
    }
    if (amountCents > creditCents) {
      setFormError(`Only ${money(creditCents)} of website credit is available.`);
      return;
    }
    setStep({ kind: "review", rail, amountCents, reference: newIdempotencyKey() });
  }

  // The reference (idempotency key) is minted once per review session and
  // reused on retry, so a retried request can never double-post.
  async function confirm(rail: Rail, amountCents: number, reference: string) {
    setStep({ kind: "working", rail, amountCents, reference });
    try {
      const response = await fetch("/api/v1/credits/convert", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rail, amountCents, idempotencyKey: reference }),
      });
      const data = (await response.json()) as { message?: string; amountCents?: number };
      if (!response.ok) {
        throw new Error(data.message ?? "The ledger did not accept the move.");
      }
      setStep({
        kind: "success",
        rail,
        amountCents: data.amountCents ?? amountCents,
        reference,
      });
      router.refresh();
    } catch (error) {
      setStep({
        kind: "error",
        rail,
        amountCents,
        reference,
        reason: error instanceof Error ? error.message : "The ledger did not accept the move.",
      });
    }
  }

  return (
    <section className="space-y-6 border-t border-white/8 pt-10">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">Convert</p>
        <h2 className="mt-3 text-2xl tracking-tight text-zinc-100">Website credit to a rail</h2>
        <p className="mt-3 max-w-[65ch] text-sm text-zinc-400">
          Move volume reward to USDG, Create credits (AI Create / Replicate), or LLM credits (chat and
          acc_ API). You can also allocate on the Redeem page.
        </p>
      </div>

      {step.kind === "form" ? (
        <>
          <label className="block max-w-sm space-y-2">
            <span className="text-sm text-zinc-400">Amount (max {money(creditCents)})</span>
            <input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              inputMode="decimal"
              aria-invalid={formError ? true : undefined}
              className="w-full border border-white/10 bg-transparent px-3 py-2 font-mono text-sm tabular-nums outline-none focus:border-accent"
            />
          </label>
          {formError ? (
            <p role="alert" className="text-sm text-accent">
              {formError}
            </p>
          ) : null}
          {usdgPaused ? (
            <p role="status" className="max-w-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-200/90">
              {usdgPauseMessage}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <NotchedButton disabled={creditCents <= 0 || usdgPaused} onClick={() => review("usdt")}>
              To USDG rail
            </NotchedButton>
            <NotchedButton disabled={creditCents <= 0} onClick={() => review("ai_create_credits")}>
              To Create rail
            </NotchedButton>
            <NotchedButton disabled={creditCents <= 0} onClick={() => review("llm_credits")}>
              To LLM rail
            </NotchedButton>
          </div>
        </>
      ) : null}

      {step.kind === "review" ? (
        <div className="max-w-xl border border-white/10">
          <p className="border-b border-white/8 px-5 py-3 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">
            Review before it posts
          </p>
          <dl className="divide-y divide-white/8 px-5 text-sm">
            <div className="flex justify-between py-3">
              <dt className="text-zinc-500">Move</dt>
              <dd className="font-mono tabular-nums text-zinc-100">{money(step.amountCents)}</dd>
            </div>
            <div className="flex justify-between py-3">
              <dt className="text-zinc-500">From</dt>
              <dd className="text-zinc-100">Website credit</dd>
            </div>
            <div className="flex justify-between py-3">
              <dt className="text-zinc-500">To</dt>
              <dd className="text-zinc-100">{RAIL_LABELS[step.rail]}</dd>
            </div>
            <div className="flex justify-between py-3">
              <dt className="text-zinc-500">Rate</dt>
              <dd className="text-zinc-100">1:1 — no further fee; {conversionBps} bps already ran at claim</dd>
            </div>
            <div className="flex justify-between py-3">
              <dt className="text-zinc-500">Timing</dt>
              <dd className="text-zinc-100">Posts to your desk balance immediately</dd>
            </div>
          </dl>
          <div className="flex flex-wrap gap-3 border-t border-white/8 px-5 py-4">
            <NotchedButton onClick={() => void confirm(step.rail, step.amountCents, step.reference)}>
              Confirm move
            </NotchedButton>
            <NotchedButton variant="ghost" onClick={() => setStep({ kind: "form" })}>
              Back
            </NotchedButton>
          </div>
        </div>
      ) : null}

      {step.kind === "working" ? (
        <div role="status" className="max-w-xl border border-white/10 px-5 py-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">Posting</p>
          <p className="mt-2 text-sm text-zinc-300">
            Moving {money(step.amountCents)} to {RAIL_LABELS[step.rail]}. This is a ledger write — it usually
            completes in under a second.
          </p>
        </div>
      ) : null}

      {step.kind === "success" ? (
        <div role="status" className="max-w-xl border border-white/10">
          <p className="border-b border-white/8 px-5 py-3 font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
            Posted
          </p>
          <div className="space-y-2 px-5 py-4 text-sm text-zinc-300">
            <p>
              {money(step.amountCents)} moved to {RAIL_LABELS[step.rail]}. The balance above already reflects it.
            </p>
            <p className="font-mono text-xs text-zinc-500">Reference {step.reference.slice(0, 22)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-4 border-t border-white/8 px-5 py-4">
            <Link
              href="/app/redeem"
              className="inline-flex items-center justify-center bg-accent px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-50 transition-colors hover:bg-accent-press active:scale-[0.98]"
            >
              Redeem it
            </Link>
            <NotchedButton variant="ghost" onClick={() => setStep({ kind: "form" })}>
              Move more
            </NotchedButton>
          </div>
        </div>
      ) : null}

      {step.kind === "error" ? (
        <div role="alert" className="max-w-xl border border-accent/40">
          <p className="border-b border-accent/30 px-5 py-3 font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
            Did not post
          </p>
          <div className="space-y-2 px-5 py-4 text-sm">
            <p className="text-zinc-100">No credit left your balance.</p>
            <p className="text-zinc-400">{step.reason}</p>
          </div>
          <div className="flex flex-wrap gap-3 border-t border-accent/30 px-5 py-4">
            <NotchedButton onClick={() => void confirm(step.rail, step.amountCents, step.reference)}>
              Try again
            </NotchedButton>
            <NotchedButton variant="ghost" onClick={() => setStep({ kind: "form" })}>
              Change amount
            </NotchedButton>
          </div>
        </div>
      ) : null}
    </section>
  );
}
