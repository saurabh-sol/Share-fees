"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Rail } from "@/lib/ledger/post-swap-reward";

function money(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function newIdempotencyKey() {
  return `cnv_${crypto.randomUUID().replaceAll("-", "")}`;
}

export function ConvertDesk({
  creditCents,
  conversionBps,
  minNotionalUsdCents,
  dailyCapUsdCents,
}: {
  creditCents: number;
  conversionBps: number;
  minNotionalUsdCents: number;
  dailyCapUsdCents: number;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState((creditCents / 100).toFixed(2));
  const [status, setStatus] = useState<"idle" | "working" | "error" | "success">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function convert(rail: Rail) {
    setStatus("working");
    setMessage(null);
    const amountCents = Math.round(Number.parseFloat(amount) * 100);
    try {
      const response = await fetch("/api/v1/credits/convert", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          rail,
          amountCents,
          idempotencyKey: newIdempotencyKey(),
        }),
      });
      const data = (await response.json()) as { message?: string; amountCents?: number };
      if (!response.ok) {
        throw new Error(data.message ?? "Convert failed.");
      }
      setStatus("success");
      setMessage(
        `Moved ${money(data.amountCents ?? amountCents)} to ${rail === "usdt" ? "USDT" : "LLM credits"}. Redeem from those balances.`,
      );
      router.refresh();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Convert failed.");
    }
  }

  return (
    <section className="space-y-6 border-t border-white/8 pt-10">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">Convert</p>
        <h2 className="mt-3 text-2xl tracking-tight text-zinc-100">Website credit to a rail</h2>
        <p className="mt-3 max-w-[65ch] text-sm text-zinc-400">
          1:1 move. BPS already ran at claim ({conversionBps} bps · {money(minNotionalUsdCents)} floor · $1.00 min
          credit · {money(dailyCapUsdCents)} daily cap).
        </p>
      </div>
      <label className="block max-w-sm space-y-2">
        <span className="text-sm text-zinc-400">Amount (max {money(creditCents)})</span>
        <input
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          inputMode="decimal"
          className="w-full border border-white/10 bg-transparent px-3 py-2 font-mono text-sm outline-none focus:border-[#c23a3a]"
        />
      </label>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={status === "working" || creditCents <= 0}
          onClick={() => void convert("llm_credits")}
          className="rounded-full bg-[#c23a3a] px-5 py-2.5 text-sm text-zinc-50 transition-transform active:scale-[0.98] disabled:opacity-40"
        >
          {status === "working" ? "Moving…" : "To LLM credits"}
        </button>
        <button
          type="button"
          disabled={status === "working" || creditCents <= 0}
          onClick={() => void convert("usdt")}
          className="rounded-full border border-white/10 px-5 py-2.5 text-sm text-zinc-100 transition-transform active:scale-[0.98] disabled:opacity-40"
        >
          To USDT
        </button>
      </div>
      {message ? (
        <p className={status === "error" ? "text-sm text-[#c23a3a]" : "text-sm text-zinc-300"}>{message}</p>
      ) : null}
    </section>
  );
}
