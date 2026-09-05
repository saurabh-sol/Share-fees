"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy } from "@phosphor-icons/react";

type Rail = "usdt" | "llm_credits";

type Redemption = {
  id: string;
  rail: string;
  amountCents: number;
  status: string;
  destination: string;
  createdAt: string | Date;
};

type VirtualKey = {
  id: string;
  prefix: string;
  spendCapCents: number;
  spendUsedCents: number;
  remainingCents: number;
  status: string;
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

export function RedeemDesk({
  usdtCents,
  llmCents,
  chainNamespace,
  gatewayBaseUrl,
  initialRedemptions,
  initialKeys,
}: {
  usdtCents: number;
  llmCents: number;
  chainNamespace: "eip155" | "solana";
  gatewayBaseUrl: string;
  initialRedemptions: Redemption[];
  initialKeys: VirtualKey[];
}) {
  const router = useRouter();
  const evmOnly = chainNamespace === "eip155";
  const [rail, setRail] = useState<Rail>(evmOnly ? "usdt" : "llm_credits");
  const [amount, setAmount] = useState("5.00");
  const [status, setStatus] = useState<"idle" | "working" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [issuedKey, setIssuedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState<"key" | "url" | null>(null);
  const [redemptions, setRedemptions] = useState(initialRedemptions);
  const [keys, setKeys] = useState(initialKeys);
  const [balances, setBalances] = useState({ usdtCents, llmCents });

  const available = rail === "usdt" ? balances.usdtCents : balances.llmCents;

  async function refreshLists() {
    const [redeemData, keyData] = await Promise.all([
      readJson<{ redemptions: Redemption[] }>("/api/v1/redeem"),
      readJson<{ keys: VirtualKey[] }>("/api/v1/virtual-keys"),
    ]);
    setRedemptions(redeemData.redemptions);
    setKeys(keyData.keys);
  }

  async function onRedeem(event: React.FormEvent) {
    event.preventDefault();
    setStatus("working");
    setMessage(null);
    setIssuedKey(null);
    try {
      const amountCents = Math.round(Number(amount) * 100);
      if (!Number.isFinite(amountCents) || amountCents < 100) {
        throw new Error("Minimum redeem is $1.00.");
      }
      const result = await readJson<{
        alreadyExists: boolean;
        status: string;
        plaintextKey: string | null;
        usdtCents: number;
        llmCents: number;
      }>("/api/v1/redeem", {
        method: "POST",
        body: JSON.stringify({
          rail,
          amountCents,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      setBalances({ usdtCents: result.usdtCents, llmCents: result.llmCents });
      if (result.plaintextKey) {
        setIssuedKey(result.plaintextKey);
      }
      await refreshLists();
      router.refresh();
      setStatus("idle");
      setMessage(
        result.alreadyExists
          ? "That idempotency key already posted. The plaintext key is not shown again."
          : rail === "usdt"
            ? `Queued ${money(amountCents)} USDT to this wallet on Arbitrum. It stays queued until treasury is unlocked.`
            : `Issued a ${money(amountCents)} LLM key. Copy it now — it is not stored in plaintext.`,
      );
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Redeem failed.");
    }
  }

  async function onRevoke(id: string) {
    setStatus("working");
    setMessage(null);
    try {
      await readJson(`/api/v1/virtual-keys/${id}/revoke`, { method: "POST" });
      await refreshLists();
      router.refresh();
      setStatus("idle");
      setMessage("Key revoked. The gateway will reject it on the next request.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Revoke failed.");
    }
  }

  async function copy(value: string, which: "key" | "url") {
    await navigator.clipboard.writeText(value);
    setCopied(which);
  }

  return (
    <div className="space-y-12">
      <dl className="grid grid-cols-1 divide-y divide-white/8 border-y border-white/8 md:grid-cols-2 md:divide-x md:divide-y-0">
        <div className="py-8 md:pr-10">
          <dt className="text-sm text-zinc-500">USDT available</dt>
          <dd className="mt-2 font-mono text-3xl tracking-tight text-zinc-100">
            {money(balances.usdtCents)}
          </dd>
        </div>
        <div className="py-8 md:pl-10">
          <dt className="text-sm text-zinc-500">LLM credits available</dt>
          <dd className="mt-2 font-mono text-3xl tracking-tight text-zinc-100">
            {money(balances.llmCents)}
          </dd>
        </div>
      </dl>

      <form onSubmit={(event) => void onRedeem(event)} className="max-w-xl space-y-6">
        <fieldset className="space-y-2">
          <legend className="text-sm text-zinc-400">Rail</legend>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm text-zinc-200">
              <input
                type="radio"
                name="redeem-rail"
                checked={rail === "usdt"}
                disabled={!evmOnly}
                onChange={() => setRail("usdt")}
              />
              USDT on Arbitrum
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-200">
              <input
                type="radio"
                name="redeem-rail"
                checked={rail === "llm_credits"}
                onChange={() => setRail("llm_credits")}
              />
              LLM credits
            </label>
          </div>
          {!evmOnly ? (
            <p className="text-sm text-zinc-500">USDT withdraw is EVM-only. This session is Solana.</p>
          ) : null}
        </fieldset>

        <label className="block space-y-2">
          <span className="text-sm text-zinc-400">Amount (USD)</span>
          <input
            required
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="w-full border border-white/10 bg-transparent px-3 py-2 font-mono text-sm outline-none focus:border-[#c23a3a]"
          />
          <span className="block text-xs text-zinc-500">
            Available on this rail: {money(available)}. Minimum $1.00. Pays only to the signed-in wallet.
          </span>
        </label>

        <button
          type="submit"
          disabled={status === "working" || available < 100}
          className="rounded-full bg-[#c23a3a] px-5 py-2.5 text-sm text-zinc-50 transition-transform active:scale-[0.98] disabled:opacity-40"
        >
          {status === "working" ? "Working…" : "Redeem"}
        </button>
      </form>

      <section className="max-w-[65ch] space-y-3 border-y border-white/8 py-8">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">OpenAI-compatible setup</p>
        <p className="text-sm text-zinc-400">
          Base URL for any OpenAI-compatible client. Paste a virtual key issued below. The pool key never leaves the server.
        </p>
        <div className="flex items-center justify-between gap-4">
          <code className="font-mono text-sm text-zinc-100">{gatewayBaseUrl}</code>
          <button
            type="button"
            onClick={() => void copy(gatewayBaseUrl, "url")}
            className="inline-flex items-center gap-2 text-sm text-zinc-300"
          >
            {copied === "url" ? <Check size={16} /> : <Copy size={16} />}
            {copied === "url" ? "Copied" : "Copy"}
          </button>
        </div>
      </section>

      {issuedKey ? (
        <section className="space-y-3 border-y border-white/8 py-8">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#c23a3a]">Show once</p>
          <p className="text-sm text-zinc-400">
            This plaintext key is not stored. If you leave the page, redeem again for a new key.
          </p>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <code className="break-all font-mono text-sm text-zinc-100">{issuedKey}</code>
            <button
              type="button"
              onClick={() => void copy(issuedKey, "key")}
              className="inline-flex items-center gap-2 text-sm text-zinc-300"
            >
              {copied === "key" ? <Check size={16} /> : <Copy size={16} />}
              {copied === "key" ? "Copied" : "Copy key"}
            </button>
          </div>
        </section>
      ) : null}

      {message ? (
        <p className={status === "error" ? "text-sm text-[#c23a3a]" : "text-sm text-zinc-300"} role="status">
          {message}
        </p>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-xl tracking-tight text-zinc-100">Virtual keys</h2>
        {keys.length === 0 ? (
          <p className="text-zinc-400">No keys yet. Redeem LLM credits to issue one.</p>
        ) : (
          <ul className="divide-y divide-white/8 border-y border-white/8">
            {keys.map((key) => (
              <li key={key.id} className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-mono text-sm text-zinc-100">{key.prefix}…</p>
                  <p className="font-mono text-xs text-zinc-500">
                    {money(key.remainingCents)} left of {money(key.spendCapCents)} · {key.status}
                  </p>
                </div>
                {key.status === "active" ? (
                  <button
                    type="button"
                    onClick={() => void onRevoke(key.id)}
                    disabled={status === "working"}
                    className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-100 transition-transform active:scale-[0.98] disabled:opacity-40"
                  >
                    Revoke
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-xl tracking-tight text-zinc-100">Redemptions</h2>
        {redemptions.length === 0 ? (
          <p className="text-zinc-400">Nothing withdrawn yet.</p>
        ) : (
          <ul className="divide-y divide-white/8 border-y border-white/8">
            {redemptions.map((row) => (
              <li key={row.id} className="flex items-center justify-between py-4">
                <div>
                  <p className="font-mono text-sm text-zinc-100">
                    {row.rail === "usdt" ? "USDT" : "LLM"} · {money(row.amountCents)}
                  </p>
                  <p className="font-mono text-xs text-zinc-500">{row.id.slice(0, 18)}…</p>
                </div>
                <p className="font-mono text-sm text-zinc-400">{row.status}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
