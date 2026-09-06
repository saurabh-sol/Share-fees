"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Payout = {
  id: string;
  destination: string;
  amountCents: number;
  chain: string;
  status: string;
  txHash: string | null;
};

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export function PayoutsDesk({ initialPayouts }: { initialPayouts: Payout[] }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "working" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function processQueue() {
    setStatus("working");
    setMessage(null);
    try {
      const response = await fetch("/api/v1/admin/payouts/process", {
        method: "POST",
        credentials: "same-origin",
      });
      const data = (await response.json()) as { message?: string; processed?: Array<{ status: string }> };
      if (!response.ok) throw new Error(data.message ?? "Process failed.");
      router.refresh();
      setStatus("idle");
      const sent = data.processed?.filter((row) => row.status === "sent").length ?? 0;
      const queued = data.processed?.filter((row) => row.status === "queued").length ?? 0;
      setMessage(
        sent
          ? `Broadcast ${sent} payout(s).`
          : queued
            ? "Treasury is locked. Rows stay queued."
            : "Outbox is empty.",
      );
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Process failed.");
    }
  }

  return (
    <div className="space-y-6">
      <button
        type="button"
        disabled={status === "working"}
        onClick={() => void processQueue()}
        className="bg-accent px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-50 transition-colors hover:bg-accent-press active:scale-[0.98] disabled:opacity-40"
      >
        {status === "working" ? "Processing…" : "Process outbox"}
      </button>
      {initialPayouts.length === 0 ? (
        <p className="text-zinc-400">No payout rows.</p>
      ) : (
        <ul className="divide-y divide-white/8 border-y border-white/8">
          {initialPayouts.map((row) => (
            <li key={row.id} className="flex items-center justify-between py-4">
              <div>
                <p className="font-mono text-sm text-zinc-100">
                  {money(row.amountCents)} · {row.chain}
                </p>
                <p className="font-mono text-xs text-zinc-500">{row.destination.slice(0, 12)}…</p>
              </div>
              <p className="font-mono text-sm text-zinc-400">{row.status}</p>
            </li>
          ))}
        </ul>
      )}
      {message ? (
        <p className={status === "error" ? "text-sm text-accent" : "text-sm text-zinc-300"}>{message}</p>
      ) : null}
    </div>
  );
}
