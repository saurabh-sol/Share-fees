"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const empty = {
  txHash: "",
  fromChain: "ethereum",
  toChain: "arbitrum",
  fromToken: "ETH",
  toToken: "USDC",
  fromAmount: "0.42",
  toAmount: "764.18",
  notionalUsd: "764.18",
};

export function PaperFillForm() {
  const router = useRouter();
  const [form, setForm] = useState(empty);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("loading");
    setMessage(null);
    const notionalUsdCents = Math.round(Number.parseFloat(form.notionalUsd) * 100);
    const response = await fetch("/api/v1/swaps/confirm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        txHash: form.txHash,
        fromChain: form.fromChain,
        toChain: form.toChain,
        fromToken: form.fromToken,
        toToken: form.toToken,
        fromAmount: form.fromAmount,
        toAmount: form.toAmount,
        notionalUsdCents,
        executedAt: new Date().toISOString(),
      }),
    });
    const data = (await response.json()) as {
      message?: string;
      creditedCents?: number;
      alreadyExists?: boolean;
      status?: string;
    };
    if (!response.ok) {
      setStatus("error");
      setMessage(data.message ?? "Fill was rejected.");
      return;
    }
    setStatus("success");
    setMessage(
      data.alreadyExists
        ? "This tx hash was already booked. No second credit."
        : `Booked ${data.status}. Credited $${((data.creditedCents ?? 0) / 100).toFixed(2)} to website credit.`,
    );
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="max-w-xl space-y-5">
      <label className="block space-y-2">
        <span className="text-sm text-zinc-400">Transaction hash</span>
        <input
          required
          value={form.txHash}
          onChange={(event) => setForm((prev) => ({ ...prev, txHash: event.target.value }))}
          className="w-full border border-white/10 bg-transparent px-3 py-2 font-mono text-sm outline-none focus:border-[#c23a3a]"
          placeholder="0x followed by 64 hex chars"
        />
      </label>
      <div className="grid grid-cols-2 gap-4">
        <label className="block space-y-2">
          <span className="text-sm text-zinc-400">From chain</span>
          <input
            required
            value={form.fromChain}
            onChange={(event) => setForm((prev) => ({ ...prev, fromChain: event.target.value }))}
            className="w-full border border-white/10 bg-transparent px-3 py-2 font-mono text-sm outline-none focus:border-[#c23a3a]"
          />
        </label>
        <label className="block space-y-2">
          <span className="text-sm text-zinc-400">To chain</span>
          <input
            required
            value={form.toChain}
            onChange={(event) => setForm((prev) => ({ ...prev, toChain: event.target.value }))}
            className="w-full border border-white/10 bg-transparent px-3 py-2 font-mono text-sm outline-none focus:border-[#c23a3a]"
          />
        </label>
      </div>
      <label className="block space-y-2">
        <span className="text-sm text-zinc-400">Notional USD</span>
        <input
          required
          inputMode="decimal"
          value={form.notionalUsd}
          onChange={(event) => setForm((prev) => ({ ...prev, notionalUsd: event.target.value }))}
          className="w-full border border-white/10 bg-transparent px-3 py-2 font-mono text-sm outline-none focus:border-[#c23a3a]"
        />
        <span className="block text-xs text-zinc-600">Floor is $250.00. Below that, the swap is stored and the credit is skipped.</span>
      </label>
      <button
        type="submit"
        disabled={status === "loading"}
        className="rounded-full bg-[#c23a3a] px-5 py-2.5 text-sm text-zinc-50 transition-transform active:scale-[0.98] disabled:opacity-40"
      >
        {status === "loading" ? "Booking…" : "Record fill"}
      </button>
      {message ? (
        <p className={status === "error" ? "text-sm text-[#c23a3a]" : "text-sm text-zinc-300"} role="status">
          {message}
        </p>
      ) : null}
    </form>
  );
}
