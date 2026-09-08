"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/ui/EmptyState";
import { NotchedButton } from "@/components/ui/NotchedButton";
import { TokenIcon } from "./TokenIcon";

type Claim = {
  id: string;
  txHash: string;
  fromChain: string;
  toChain: string;
  fromToken: string;
  toToken: string;
  notionalUsdCents: number;
  estimatedRewardCents: number;
  executedAt: string;
  provider: string;
  status: string;
  kind?: string;
};

type VolumeSummary = {
  transferCount: number;
  totalVolumeCents: number;
  estimatedTotalRewardCents: number;
  qualifiesVolume: boolean;
  conversionBps: number;
  minNotionalUsdCents: number;
};

function money(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function kindLabel(kind: string | undefined) {
  if (!kind || kind === "trade") return "Swap";
  if (kind === "execute") return "Execute";
  if (kind === "send") return "Send";
  if (kind === "receive") return "Receive";
  if (kind === "deposit") return "Deposit";
  if (kind === "withdraw") return "Withdraw";
  if (kind === "approve") return "Approve";
  return "Transfer";
}

function statusLabel(row: Claim, minNotionalUsdCents: number) {
  if (row.status === "unclaimed") return `Claim ${money(row.estimatedRewardCents)}`;
  if (row.status === "claimed" || row.status === "booked" || row.status === "volume_settled") {
    return "Already credited";
  }
  if (row.status === "below_threshold" && row.kind && row.kind !== "trade" && row.kind !== "execute") {
    return "Listed";
  }
  if (row.status === "below_threshold") return `Under ${money(minNotionalUsdCents)}`;
  return row.status;
}

function formatWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

async function readJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: "include",
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = (await response.json()) as T & { message?: string; error?: string };
  if (!response.ok) {
    throw new Error(data.message ?? data.error ?? "request_failed");
  }
  return data;
}

export function ClaimsInbox({
  initialClaims,
  initialSummary,
  autoScan,
  minNotionalUsdCents,
  conversionBps,
}: {
  initialClaims: Claim[];
  initialSummary: VolumeSummary;
  autoScan: boolean;
  minNotionalUsdCents: number;
  conversionBps: number;
}) {
  const router = useRouter();
  const [claims, setClaims] = useState(initialClaims);
  const [summary, setSummary] = useState(initialSummary);
  const [status, setStatus] = useState<"idle" | "working" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [importHash, setImportHash] = useState("");

  async function load() {
    const data = await readJson<{ claims: Claim[]; summary: VolumeSummary }>("/api/v1/swaps/claims");
    setClaims(data.claims);
    setSummary(data.summary);
    setStatus("idle");
  }

  async function onScan() {
    setStatus("working");
    setMessage(null);
    try {
      const result = await readJson<{
        inserted: number;
        scanned: number;
        updated?: number;
        providers: string[];
        cooldown?: boolean;
        cached?: boolean;
        retryAfterSec?: number;
      }>("/api/v1/swaps/scan", { method: "POST" });
      await load();
      if (result.cached) {
        setMessage(
          "History provider is busy. Showing the last scan. Import a hash if you need a new fill now.",
        );
      } else if (result.cooldown) {
        setMessage(
          `Last scan is still fresh. Try again in ${Math.max(1, result.retryAfterSec ?? 60)}s.`,
        );
      } else {
        setMessage(
          result.providers.length === 0
            ? "Wallet history is not configured. Import a transaction hash the desk can verify."
            : `Listed ${result.scanned} transfers. ${result.inserted} new · ${result.updated ?? 0} refreshed.`,
        );
      }
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Scan failed.");
    }
  }

  async function onImport(event: React.FormEvent) {
    event.preventDefault();
    setStatus("working");
    setMessage(null);
    try {
      const result = await readJson<{ inserted: number }>("/api/v1/swaps/import", {
        method: "POST",
        body: JSON.stringify({ txHash: importHash, fromChain: "4663", toChain: "4663" }),
      });
      await load();
      setMessage(result.inserted ? "Hash verified and added to the activity list." : "Already in the list or already booked.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Import failed.");
    }
  }

  async function onClaim(id: string) {
    setStatus("working");
    setMessage(null);
    try {
      const result = await readJson<{ creditedCents: number; alreadyExists?: boolean }>(
        `/api/v1/swaps/claims/${id}/claim`,
        { method: "POST", body: JSON.stringify({}) },
      );
      await load();
      router.refresh();
      setMessage(
        result.alreadyExists
          ? "That hash was already on the ledger."
          : `Claimed ${money(result.creditedCents)} to website credit. Convert it on the desk.`,
      );
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Claim failed.");
    }
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-[65ch] text-sm text-zinc-400">
          {autoScan
            ? `Scan lists 90 days of transfers and sums swaps plus send/receive volume. Import a hash if you need one fill now. Reward shows after volume clears ${money(minNotionalUsdCents)}.`
            : "Wallet scan is temporarily unavailable. You can still import a verified transaction hash."}
        </p>
        <NotchedButton disabled={status === "working"} onClick={() => void onScan()}>
          {status === "working" ? "Working…" : "Scan wallet"}
        </NotchedButton>
      </div>

      <dl className="grid grid-cols-1 divide-y divide-white/8 border-y border-white/8 md:grid-cols-3 md:divide-x md:divide-y-0">
        <div className="py-6 md:pr-8">
          <dt className="text-sm text-zinc-500">Transfers</dt>
          <dd className="mt-2 font-mono text-3xl tracking-tight text-zinc-100">{summary.transferCount}</dd>
        </div>
        <div className="py-6 md:px-8">
          <dt className="text-sm text-zinc-500">Swap volume</dt>
          <dd className="mt-2 font-mono text-3xl tracking-tight text-zinc-100">
            {money(summary.totalVolumeCents)}
          </dd>
        </div>
        <div className="py-6 md:pl-8">
          <dt className="text-sm text-zinc-500">
            {summary.qualifiesVolume ? `Total reward · ${conversionBps} bps` : "Total reward"}
          </dt>
          <dd className="mt-2 font-mono text-3xl tracking-tight text-zinc-100">
            {summary.qualifiesVolume ? money(summary.estimatedTotalRewardCents) : "—"}
          </dd>
          {!summary.qualifiesVolume ? (
            <p className="mt-2 text-sm text-zinc-500">
              Shown after volume clears {money(minNotionalUsdCents)}.
            </p>
          ) : null}
        </div>
      </dl>

      {claims.length === 0 ? (
        <EmptyState
          eyebrow="Activity"
          title="No wallet transfers in this scan yet."
          body="Run Scan wallet above to pull 90 days of history, or import a single transaction hash below — verified fills appear here with their claim status."
        />
      ) : (
        <ul className="divide-y divide-white/8 border-y border-white/8">
          {claims.map((claim) => (
            <li key={claim.id} className="flex flex-col gap-3 py-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="flex flex-wrap items-center gap-2 font-mono text-sm text-zinc-100">
                  <span>{kindLabel(claim.kind)}</span>
                  <span className="inline-flex items-center gap-1.5">
                    <TokenIcon symbol={claim.fromToken} />
                    {claim.fromToken}
                  </span>
                  {claim.toToken && claim.toToken !== claim.fromToken ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="text-zinc-500">→</span>
                      <TokenIcon symbol={claim.toToken} />
                      {claim.toToken}
                    </span>
                  ) : null}
                </p>
                <p className="font-mono text-xs text-zinc-500">
                  {formatWhen(claim.executedAt)} · {claim.fromChain} · {claim.txHash.slice(0, 10)}…
                </p>
              </div>
              <div className="flex items-center gap-4">
                <p className="font-mono text-sm tabular-nums text-zinc-100">{money(claim.notionalUsdCents)}</p>
                {claim.status === "unclaimed" ? (
                  <NotchedButton
                    variant="ghost"
                    disabled={status === "working"}
                    onClick={() => void onClaim(claim.id)}
                  >
                    {statusLabel(claim, minNotionalUsdCents)}
                  </NotchedButton>
                ) : (
                  <p className="text-sm text-zinc-500">{statusLabel(claim, minNotionalUsdCents)}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={(event) => void onImport(event)} className="max-w-xl space-y-4 border-t border-white/8 pt-8">
        <p className="text-sm text-zinc-400">
          Import a Robinhood Chain transaction hash. We verify ownership before it enters the list.
        </p>
        <label className="block space-y-2">
          <span className="text-sm text-zinc-400">Transaction hash</span>
          <input
            required
            value={importHash}
            onChange={(event) => setImportHash(event.target.value)}
            className="w-full border border-white/10 bg-transparent px-3 py-2 font-mono text-sm outline-none focus:border-accent"
            placeholder="0x followed by 64 hex chars"
          />
        </label>
        <p className="font-mono text-xs text-zinc-500">Robinhood Chain · 4663</p>
        <NotchedButton type="submit" variant="ghost" disabled={status === "working"}>
          Verify hash
        </NotchedButton>
      </form>

      {message ? (
        <p className={status === "error" ? "text-sm text-accent" : "text-sm text-zinc-300"} role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
