"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Rail = "usdt" | "llm_credits";

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
};

function money(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

async function readJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...init,
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
  autoScan,
}: {
  initialClaims: Claim[];
  autoScan: boolean;
}) {
  const router = useRouter();
  const [claims, setClaims] = useState(initialClaims);
  const [rail, setRail] = useState<Rail>("usdt");
  const [status, setStatus] = useState<"idle" | "working" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [importHash, setImportHash] = useState("");
  const [fromChain, setFromChain] = useState("8453");
  const [toChain, setToChain] = useState("8453");

  async function load() {
    const data = await readJson<{ claims: Claim[] }>("/api/v1/swaps/claims");
    setClaims(data.claims);
    setStatus("idle");
  }

  async function onScan() {
    setStatus("working");
    setMessage(null);
    try {
      const result = await readJson<{ inserted: number; scanned: number; providers: string[] }>(
        "/api/v1/swaps/scan",
        { method: "POST" },
      );
      await load();
      setMessage(
        result.providers.length === 0
          ? "No history provider is configured. Import a hash LI.FI can verify, or set ZERION_API_KEY."
          : `Scanned ${result.scanned} trades. ${result.inserted} new claims.`,
      );
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
        body: JSON.stringify({ txHash: importHash, fromChain, toChain }),
      });
      await load();
      setMessage(result.inserted ? "Hash verified and added to the inbox." : "Already in the inbox or already booked.");
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
        { method: "POST", body: JSON.stringify({ rail }) },
      );
      await load();
      router.refresh();
      setMessage(
        result.alreadyExists
          ? "That hash was already on the ledger."
          : `Claimed ${money(result.creditedCents)} to ${rail === "usdt" ? "USDT" : "LLM credits"}.`,
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
            ? "Scan pulls confirmed trades from the last 90 days. Claim re-verifies the hash before the ledger writes."
            : "Automatic scan needs ZERION_API_KEY. You can still import a hash that LI.FI (or Zerion) can prove is yours."}
        </p>
        <button
          type="button"
          onClick={() => void onScan()}
          disabled={status === "working"}
          className="rounded-full bg-[#c23a3a] px-5 py-2.5 text-sm text-zinc-50 transition-transform active:scale-[0.98] disabled:opacity-40"
        >
          {status === "working" ? "Working…" : "Scan wallet"}
        </button>
      </div>

      {claims.length === 0 ? (
        <p className="border-y border-white/8 py-8 text-zinc-400">No unclaimed qualifying fills yet.</p>
      ) : (
        <ul className="divide-y divide-white/8 border-y border-white/8">
          {claims.map((claim) => (
            <li key={claim.id} className="flex flex-col gap-3 py-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-mono text-sm text-zinc-100">
                  {claim.fromToken} → {claim.toToken}
                </p>
                <p className="font-mono text-xs text-zinc-500">
                  {claim.fromChain} · {claim.txHash.slice(0, 10)}… · {money(claim.notionalUsdCents)}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <p className="font-mono text-sm text-[#c23a3a]">{money(claim.estimatedRewardCents)}</p>
                <button
                  type="button"
                  onClick={() => void onClaim(claim.id)}
                  disabled={status === "working"}
                  className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-100 transition-transform active:scale-[0.98] disabled:opacity-40"
                >
                  Claim
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <fieldset className="space-y-2">
        <legend className="text-sm text-zinc-400">Claim rail</legend>
        <div className="flex gap-6">
          {(["usdt", "llm_credits"] as const).map((value) => (
            <label key={value} className="flex items-center gap-2 text-sm text-zinc-200">
              <input type="radio" name="claim-rail" checked={rail === value} onChange={() => setRail(value)} />
              {value === "usdt" ? "USDT" : "LLM credits"}
            </label>
          ))}
        </div>
      </fieldset>

      <form onSubmit={(event) => void onImport(event)} className="max-w-xl space-y-4 border-t border-white/8 pt-8">
        <p className="text-sm text-zinc-400">Import a source-chain hash. We verify ownership before it enters the inbox.</p>
        <label className="block space-y-2">
          <span className="text-sm text-zinc-400">Transaction hash</span>
          <input
            required
            value={importHash}
            onChange={(event) => setImportHash(event.target.value)}
            className="w-full border border-white/10 bg-transparent px-3 py-2 font-mono text-sm outline-none focus:border-[#c23a3a]"
            placeholder="0x followed by 64 hex chars"
          />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="block space-y-2">
            <span className="text-sm text-zinc-400">From chain id</span>
            <input
              required
              value={fromChain}
              onChange={(event) => setFromChain(event.target.value)}
              className="w-full border border-white/10 bg-transparent px-3 py-2 font-mono text-sm outline-none focus:border-[#c23a3a]"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm text-zinc-400">To chain id</span>
            <input
              required
              value={toChain}
              onChange={(event) => setToChain(event.target.value)}
              className="w-full border border-white/10 bg-transparent px-3 py-2 font-mono text-sm outline-none focus:border-[#c23a3a]"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={status === "working"}
          className="rounded-full border border-white/10 px-5 py-2.5 text-sm text-zinc-100 transition-transform active:scale-[0.98] disabled:opacity-40"
        >
          Verify hash
        </button>
      </form>

      {message ? (
        <p className={status === "error" ? "text-sm text-[#c23a3a]" : "text-sm text-zinc-300"} role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
