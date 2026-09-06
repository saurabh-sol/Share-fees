"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RulesForm({
  latest,
}: {
  latest: {
    conversionBps: number;
    minNotionalUsdCents: number;
    dailyCapUsdCents: number;
    enabled: number;
  } | null;
}) {
  const router = useRouter();
  const [conversionBps, setConversionBps] = useState(String(latest?.conversionBps ?? 50));
  const [minNotional, setMinNotional] = useState(String((latest?.minNotionalUsdCents ?? 25_000) / 100));
  const [dailyCap, setDailyCap] = useState(String((latest?.dailyCapUsdCents ?? 250_000) / 100));
  const [enabled, setEnabled] = useState(latest ? latest.enabled === 1 : true);
  const [status, setStatus] = useState<"idle" | "working" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("working");
    setMessage(null);
    try {
      const response = await fetch("/api/v1/admin/reward-rules", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          conversionBps: Number(conversionBps),
          minNotionalUsdCents: Math.round(Number(minNotional) * 100),
          dailyCapUsdCents: Math.round(Number(dailyCap) * 100),
          enabled,
        }),
      });
      const data = (await response.json()) as { message?: string; version?: number };
      if (!response.ok) throw new Error(data.message ?? "Rule write failed.");
      router.refresh();
      setStatus("idle");
      setMessage(`Published rule v${data.version}.`);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Rule write failed.");
    }
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="max-w-xl space-y-5">
      <p className="text-sm text-zinc-400">
        A new version is appended. Disable to pause all new credits (kill switch). Old ledger rows stay.
      </p>
      <label className="block space-y-2">
        <span className="text-sm text-zinc-400">Conversion (bps, 25–100)</span>
        <input
          required
          min={25}
          max={100}
          value={conversionBps}
          onChange={(event) => setConversionBps(event.target.value)}
          className="w-full border border-white/10 bg-transparent px-3 py-2 font-mono text-sm outline-none focus:border-[#c23a3a]"
        />
      </label>
      <label className="block space-y-2">
        <span className="text-sm text-zinc-400">Minimum notional (USD)</span>
        <input
          required
          value={minNotional}
          onChange={(event) => setMinNotional(event.target.value)}
          className="w-full border border-white/10 bg-transparent px-3 py-2 font-mono text-sm outline-none focus:border-[#c23a3a]"
        />
      </label>
      <label className="block space-y-2">
        <span className="text-sm text-zinc-400">Daily cap (USD)</span>
        <input
          required
          value={dailyCap}
          onChange={(event) => setDailyCap(event.target.value)}
          className="w-full border border-white/10 bg-transparent px-3 py-2 font-mono text-sm outline-none focus:border-[#c23a3a]"
        />
      </label>
      <label className="flex items-center gap-2 text-sm text-zinc-200">
        <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
        Rewards enabled
      </label>
      <button
        type="submit"
        disabled={status === "working"}
        className="rounded-full bg-[#c23a3a] px-5 py-2.5 text-sm text-zinc-50 transition-transform active:scale-[0.98] disabled:opacity-40"
      >
        {status === "working" ? "Publishing…" : "Publish version"}
      </button>
      {message ? (
        <p className={status === "error" ? "text-sm text-[#c23a3a]" : "text-sm text-zinc-300"}>{message}</p>
      ) : null}
    </form>
  );
}
