"use client";

import { erc20Abi, formatUnits } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ROBINHOOD_ACCR, ROBINHOOD_CHAIN_ID, robinhoodTxUrl } from "@/lib/chains/robinhood";
import { depositMinUsdCents } from "@/lib/deposit/credit";
import { sendAccrDeposit } from "@/lib/deposit/browser";
import { TokenIcon } from "./TokenIcon";
import { NotchedButton } from "@/components/ui/NotchedButton";
import { EmptyState } from "@/components/ui/EmptyState";

type PreparePayload = {
  intentId: string;
  tokenSymbol: "ACCR";
  logoURI: string;
  priceUsd: string;
  usdCents: number;
  tokenAmountHuman: string;
  tokenAmountRaw: string;
  displayCreditCents: number;
  quoteExpiresAt: string;
};

type HistoryRow = {
  id: string;
  usdCents: number;
  tokenAmountHuman: string;
  displayCreditCents: number;
  txHash: string | null;
  status: string;
  createdAt: string;
};

function money(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function sanitizeUsd(raw: string) {
  const cleaned = raw.replace(/[^\d.]/g, "");
  const dot = cleaned.indexOf(".");
  if (dot === -1) return cleaned;
  return `${cleaned.slice(0, dot + 1)}${cleaned.slice(dot + 1).replaceAll(".", "")}`;
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

export function DepositDesk({
  initialHistory,
  minUsdCents = depositMinUsdCents(),
}: {
  initialHistory: HistoryRow[];
  minUsdCents?: number;
}) {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const [usdAmount, setUsdAmount] = useState("5.00");
  const [quote, setQuote] = useState<PreparePayload | null>(null);
  const [history, setHistory] = useState(initialHistory);
  const [phase, setPhase] = useState<"idle" | "quoting" | "confirming" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const accrBalance = useReadContract({
    address: ROBINHOOD_ACCR as `0x${string}`,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: ROBINHOOD_CHAIN_ID,
    query: { enabled: Boolean(address) },
  });

  const usdCents = useMemo(() => {
    const parsed = Number.parseFloat(usdAmount);
    if (!Number.isFinite(parsed) || parsed <= 0) return 0;
    return Math.round(parsed * 100);
  }, [usdAmount]);

  const balanceLabel = accrBalance.data
    ? formatUnits(accrBalance.data, 18)
    : "—";

  const fetchQuote = useCallback(async () => {
    if (usdCents < minUsdCents) {
      setQuote(null);
      return;
    }
    setPhase("quoting");
    setMessage(null);
    try {
      const data = await readJson<PreparePayload>("/api/v1/deposits/prepare", {
        method: "POST",
        body: JSON.stringify({ usdAmount }),
      });
      setQuote(data);
      setPhase("idle");
    } catch (error) {
      setQuote(null);
      setPhase("error");
      setMessage(error instanceof Error ? error.message : "Could not fetch live price.");
    }
  }, [usdAmount, usdCents, minUsdCents]);

  useEffect(() => {
    if (usdCents < minUsdCents) {
      setQuote(null);
      return;
    }
    const timer = window.setTimeout(() => {
      void fetchQuote();
    }, 450);
    return () => window.clearTimeout(timer);
  }, [usdCents, minUsdCents, fetchQuote]);

  async function onConfirm() {
    if (!quote || !isConnected) return;
    setPhase("confirming");
    setMessage(null);
    try {
      const execute = await readJson<{
        tokenAddress: `0x${string}`;
        recipient: `0x${string}`;
        amountRaw: string;
      }>("/api/v1/deposits/execute", {
        method: "POST",
        body: JSON.stringify({ intentId: quote.intentId }),
      });

      const txHash = await sendAccrDeposit({
        tokenAddress: execute.tokenAddress,
        recipient: execute.recipient,
        amount: BigInt(execute.amountRaw),
      });

      const result = await readJson<{
        displayCreditCents: number;
        txHash: string;
        alreadyExists: boolean;
      }>("/api/v1/deposits/confirm", {
        method: "POST",
        body: JSON.stringify({ intentId: quote.intentId, txHash }),
      });

      const historyData = await readJson<{ deposits: HistoryRow[] }>("/api/v1/deposits/history");
      setHistory(historyData.deposits);
      setPhase("success");
      setMessage(
        result.alreadyExists
          ? "This deposit was already recorded."
          : `Deposit confirmed. ${money(result.displayCreditCents)} LLM credit bonus applied.`,
      );
      setQuote(null);
      void accrBalance.refetch();
      router.refresh();
    } catch (error) {
      setPhase("error");
      setMessage(error instanceof Error ? error.message : "Deposit failed.");
    }
  }

  function fillMax() {
    if (!quote || !accrBalance.data) return;
    const maxTokens = formatUnits(accrBalance.data, 18);
    const price = Number(quote.priceUsd);
    if (!Number.isFinite(price) || price <= 0) return;
    const maxUsd = Number(maxTokens) * price;
    setUsdAmount(maxUsd.toFixed(2));
  }

  const insufficientAccr =
    quote && accrBalance.data != null && accrBalance.data < BigInt(quote.tokenAmountRaw);

  return (
    <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="space-y-6">
        <div className="border border-white/10 bg-raised/40 px-4 py-4">
          <div className="flex items-center gap-3">
            <TokenIcon symbol="ACCR" logoURI={quote?.logoURI} size={28} />
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">Deposit</p>
              <p className="mt-1 text-lg tracking-tight text-zinc-100">$ACCR → LLM credit bonus</p>
            </div>
          </div>
          <p className="mt-4 max-w-[65ch] text-sm text-zinc-400">
            Deposit $ACCR on Robinhood Chain. Live pricing via DexScreener. Minimum{" "}
            {money(minUsdCents)}. LLM credit bonus is credited after on-chain confirmation.
          </p>
        </div>

        <div className="border border-white/10 bg-raised/40 px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">
              Amount (USD)
            </span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] tabular-nums text-zinc-400">
                Balance {balanceLabel} ACCR
              </span>
              <button
                type="button"
                disabled={!accrBalance.data || accrBalance.data === 0n}
                onClick={fillMax}
                className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent transition-colors hover:text-accent-press disabled:opacity-30"
              >
                Max
              </button>
            </div>
          </div>
          <input
            value={usdAmount}
            onChange={(event) => setUsdAmount(sanitizeUsd(event.target.value))}
            className="mt-3 w-full bg-transparent font-mono text-3xl tabular-nums text-zinc-100 outline-none placeholder:text-zinc-600"
            inputMode="decimal"
            placeholder="5.00"
            aria-label="Deposit amount in USD"
          />
          {usdCents > 0 && usdCents < minUsdCents ? (
            <p className="mt-2 font-mono text-[11px] text-accent">
              Minimum deposit is {money(minUsdCents)}.
            </p>
          ) : null}
        </div>

        {quote ? (
          <div className="border border-white/10 bg-raised/30 px-4 py-4">
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-zinc-500">Live price</dt>
                <dd className="mt-1 font-mono tabular-nums text-zinc-200">${quote.priceUsd}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">You send</dt>
                <dd className="mt-1 font-mono tabular-nums text-zinc-200">
                  {quote.tokenAmountHuman} ACCR
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-zinc-500">LLM credit bonus</dt>
                <dd className="mt-1 font-mono text-2xl tabular-nums text-accent">
                  {money(quote.displayCreditCents)}
                </dd>
              </div>
            </dl>
            {insufficientAccr ? (
              <p className="mt-3 font-mono text-[11px] text-accent">Insufficient ACCR balance.</p>
            ) : null}
          </div>
        ) : null}

        {!isConnected ? (
          <p className="text-sm text-zinc-400">Connect your wallet on Robinhood Chain to deposit.</p>
        ) : (
          <NotchedButton
            disabled={
              !quote ||
              phase === "confirming" ||
              phase === "quoting" ||
              insufficientAccr ||
              usdCents < minUsdCents
            }
            onClick={() => void onConfirm()}
          >
            {phase === "confirming" ? "Confirm in wallet…" : "Confirm deposit"}
          </NotchedButton>
        )}

        {message ? (
          <p
            role="status"
            className={phase === "error" ? "text-sm text-accent" : "text-sm text-zinc-300"}
          >
            {message}
          </p>
        ) : null}

        <p className="text-xs text-zinc-500">
          <Link href="/app/deposit/stats" className="text-zinc-400 underline-offset-2 hover:text-zinc-200 hover:underline">
            View deposit stats
          </Link>
          {" · "}
          Redeem LLM credits on the{" "}
          <Link href="/app/redeem" className="text-zinc-400 underline-offset-2 hover:text-zinc-200 hover:underline">
            Redeem desk
          </Link>
          .
        </p>
      </section>

      <section className="space-y-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">History</p>
          <h2 className="mt-2 text-xl tracking-tight text-zinc-100">Your deposits</h2>
        </div>
        {history.length === 0 ? (
          <EmptyState
            eyebrow="History"
            title="No deposits yet."
            body="Confirmed ACCR transfers appear here with on-chain transaction links."
          />
        ) : (
          <div className="overflow-x-auto border border-white/10">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-white/8 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">USD</th>
                  <th className="px-4 py-3">ACCR</th>
                  <th className="px-4 py-3">Bonus</th>
                  <th className="px-4 py-3">Tx</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6">
                {history.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                      {new Date(row.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums">{money(row.usdCents)}</td>
                    <td className="px-4 py-3 font-mono tabular-nums text-zinc-300">
                      {Number(row.tokenAmountHuman).toLocaleString(undefined, {
                        maximumFractionDigits: 4,
                      })}
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums text-accent">
                      {money(row.displayCreditCents)}
                    </td>
                    <td className="px-4 py-3">
                      {row.txHash ? (
                        <a
                          href={robinhoodTxUrl(row.txHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-xs text-zinc-400 underline-offset-2 hover:text-zinc-200 hover:underline"
                        >
                          {row.txHash.slice(0, 8)}…
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
