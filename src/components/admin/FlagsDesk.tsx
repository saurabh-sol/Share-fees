"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type FlagRow = {
  id: string;
  reason: string;
  rail: string | null;
  detail: string | null;
  createdAt: string | Date;
  swap: {
    txHash: string;
    fromToken: string;
    toToken: string;
    fromChain: string;
    toChain: string;
    notionalUsdCents: number;
    status: string;
  } | null;
};

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export function FlagsDesk({ initialFlags }: { initialFlags: FlagRow[] }) {
  const router = useRouter();
  const [flags, setFlags] = useState(initialFlags);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function resolve(id: string, action: "release" | "reject") {
    setBusyId(id);
    setMessage(null);
    try {
      const response = await fetch(`/api/v1/admin/flags/${id}/resolve`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message ?? "Resolve failed.");
      setFlags((current) => current.filter((row) => row.id !== id));
      router.refresh();
      setMessage(action === "release" ? "Hold released and credited." : "Hold rejected.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Resolve failed.");
    } finally {
      setBusyId(null);
    }
  }

  if (flags.length === 0) {
    return <p className="text-zinc-400">No open holds.</p>;
  }

  return (
    <div className="space-y-6">
      <ul className="divide-y divide-white/8 border-y border-white/8">
        {flags.map((flag) => (
          <li key={flag.id} className="flex flex-col gap-3 py-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-mono text-sm text-zinc-100">{flag.reason}</p>
              <p className="font-mono text-xs text-zinc-500">
                {flag.swap
                  ? `${flag.swap.fromToken} → ${flag.swap.toToken} · ${money(flag.swap.notionalUsdCents)} · ${flag.rail ?? "—"}`
                  : flag.id}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                disabled={busyId === flag.id}
                onClick={() => void resolve(flag.id, "release")}
                className="rounded-full bg-[#c23a3a] px-4 py-2 text-sm text-zinc-50 transition-transform active:scale-[0.98] disabled:opacity-40"
              >
                Release
              </button>
              <button
                type="button"
                disabled={busyId === flag.id}
                onClick={() => void resolve(flag.id, "reject")}
                className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-100 transition-transform active:scale-[0.98] disabled:opacity-40"
              >
                Reject
              </button>
            </div>
          </li>
        ))}
      </ul>
      {message ? <p className="text-sm text-zinc-300">{message}</p> : null}
    </div>
  );
}
