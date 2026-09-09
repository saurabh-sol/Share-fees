"use client";

import { useEffect, useState } from "react";
import type { PublicDeskStats } from "@/lib/stats/public";

function formatCount(value: number | null) {
  if (value == null) return "—";
  return value.toLocaleString("en-US");
}

function formatUsd(value: number | null, precise = false) {
  if (value == null) return "—";
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: precise ? 2 : 0,
    maximumFractionDigits: precise ? 2 : 0,
  })}`;
}

const POLL_MS = 30_000;

const LIVE_METRICS = [
  { key: "activeWallets" as const, label: "Active wallets" },
  { key: "claimedLlmCreditsUsd" as const, label: "Claimed LLM credits" },
  { key: "creditPaidUsd" as const, label: "Credit posted" },
  { key: "swapVolumeUsd" as const, label: "Swap volume" },
] as const;

export function DeskStats({ initialStats }: { initialStats?: PublicDeskStats | null }) {
  const [stats, setStats] = useState<PublicDeskStats | null>(initialStats ?? null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/v1/stats/public", { cache: "no-store" });
        if (!response.ok) throw new Error("stats_unavailable");
        const data = (await response.json()) as PublicDeskStats;
        if (!cancelled) setStats(data);
      } catch {
        /* keep last stats or server-provided initialStats */
      }
    }

    void load();
    const timer = window.setInterval(() => void load(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <dl className="mt-4 grid grid-cols-2 divide-x divide-white/8 border-y border-white/8 sm:grid-cols-4">
      {LIVE_METRICS.map((item) => {
        const raw = stats?.[item.key] ?? null;
        const display =
          item.key === "creditPaidUsd" || item.key === "swapVolumeUsd"
            ? formatUsd(raw)
            : item.key === "claimedLlmCreditsUsd"
              ? formatUsd(raw, true)
              : formatCount(raw);
        return (
          <div key={item.key} className="flex flex-col px-3 py-4 text-center md:py-5">
            <dt className="flex min-h-[2em] items-start justify-center font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">
              {item.label}
            </dt>
            <dd className="mt-auto pt-1.5 font-mono text-lg tabular-nums tracking-tight text-accent sm:text-xl">
              {display}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

export function AccountStripStats() {
  const [stats, setStats] = useState<PublicDeskStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/v1/stats/public")
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as PublicDeskStats;
      })
      .then((data) => {
        if (!cancelled && data) setStats(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!stats || stats.activeWallets === 0) return null;

  return (
    <p className="mt-6 font-mono text-sm text-zinc-400">
      <span className="tabular-nums text-zinc-200">{stats.activeWallets.toLocaleString("en-US")}</span>{" "}
      wallet{stats.activeWallets === 1 ? "" : "s"} have earned credit on the desk.
    </p>
  );
}
