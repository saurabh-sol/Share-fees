"use client";

import { parseUnits } from "viem";
import { useAccount, useConnect, useConnectors, useDisconnect } from "wagmi";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ChangeNowQuoteView } from "@/lib/changenow/types";
import type { LifiChain, LifiQuote, LifiToken } from "@/lib/lifi/http";
import { addressesEqual } from "@/lib/lifi/notional";
import { ROBINHOOD_CHAIN_ID } from "@/lib/chains/robinhood";
import { MIN_NOTIONAL_USD_CENTS } from "@/lib/rules/constants";
import { TokenIcon } from "./TokenIcon";
import { TokenSelect } from "./TokenSelect";

type Provider = "lifi" | "changenow";

type QuotePayload = {
  provider: Provider;
  quote: LifiQuote | ChangeNowQuoteView;
  fromAmountUsdCents: number;
  estimatedRewardCents: number;
  qualifies: boolean;
  rule: { conversionBps: number; minNotionalUsdCents: number } | null;
};

type OpenedPayin = {
  exchangeId: string;
  payinAddress: `0x${string}`;
  fromAmount: string;
  toAmount: string;
  fromCurrency: string;
  toCurrency: string;
  fromNetwork: string;
  toNetwork: string;
  tokenAddress: string;
  isNative: boolean;
  validUntil: string | null;
};

const NATIVE = "0x0000000000000000000000000000000000000000";

function money(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function isChangeNowQuote(quote: LifiQuote | ChangeNowQuoteView): quote is ChangeNowQuoteView {
  return "provider" in quote && quote.provider === "changenow";
}

async function readJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = (await response.json()) as T & { message?: string; error?: string };
  if (!response.ok && response.status !== 202) {
    throw new Error(data.message ?? data.error ?? "request_failed");
  }
  return Object.assign(data, { httpStatus: response.status }) as T;
}

export function SwapStudio({
  sessionAddress,
  chainNamespace,
}: {
  sessionAddress: string;
  chainNamespace: string;
}) {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { connectAsync } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const connectors = useConnectors();

  const [chains, setChains] = useState<LifiChain[]>([]);
  const [fromTokens, setFromTokens] = useState<LifiToken[]>([]);
  const [toTokens, setToTokens] = useState<LifiToken[]>([]);
  const [fromChainId, setFromChainId] = useState(8453);
  const [toChainId, setToChainId] = useState(ROBINHOOD_CHAIN_ID);
  const [fromToken, setFromToken] = useState(NATIVE);
  const [toToken, setToToken] = useState(NATIVE);
  const [amount, setAmount] = useState("0.25");
  const [quote, setQuote] = useState<QuotePayload | null>(null);
  const [payin, setPayin] = useState<OpenedPayin | null>(null);
  const [phase, setPhase] = useState<"idle" | "quoting" | "executing" | "settling" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  const walletMatches = Boolean(address && addressesEqual(address, sessionAddress));
  const fromMeta = fromTokens.find((token) => token.address.toLowerCase() === fromToken.toLowerCase());
  const robinhoodLeg = fromChainId === ROBINHOOD_CHAIN_ID || toChainId === ROBINHOOD_CHAIN_ID;

  useEffect(() => {
    if (chainNamespace !== "eip155") return;
    void readJson<{ chains: LifiChain[] }>("/api/v1/swaps/chains")
      .then((data) => setChains(data.chains))
      .catch((error: unknown) => {
        setPhase("error");
        setMessage(error instanceof Error ? error.message : "Could not load chains.");
      });
  }, [chainNamespace]);

  useEffect(() => {
    if (chainNamespace !== "eip155") return;
    void readJson<{ tokens: LifiToken[] }>(`/api/v1/swaps/tokens?chainId=${fromChainId}`)
      .then((data) => {
        setFromTokens(data.tokens);
        setFromToken((current) => {
          if (data.tokens.some((token) => token.address.toLowerCase() === current.toLowerCase())) {
            return current;
          }
          return data.tokens[0]?.address ?? NATIVE;
        });
      })
      .catch((error: unknown) => {
        setPhase("error");
        setMessage(error instanceof Error ? error.message : "Could not load tokens.");
      });
  }, [fromChainId, chainNamespace]);

  useEffect(() => {
    if (chainNamespace !== "eip155") return;
    void readJson<{ tokens: LifiToken[] }>(`/api/v1/swaps/tokens?chainId=${toChainId}`)
      .then((data) => {
        setToTokens(data.tokens);
        setToToken((current) => {
          if (data.tokens.some((token) => token.address.toLowerCase() === current.toLowerCase())) {
            return current;
          }
          return data.tokens.find((token) => token.symbol === "ETH")?.address ?? data.tokens[0]?.address ?? NATIVE;
        });
      })
      .catch((error: unknown) => {
        setPhase("error");
        setMessage(error instanceof Error ? error.message : "Could not load tokens.");
      });
  }, [toChainId, chainNamespace]);

  const toMeta = toTokens.find((token) => token.address.toLowerCase() === toToken.toLowerCase());

  async function onQuote() {
    setPhase("quoting");
    setMessage(null);
    setQuote(null);
    setPayin(null);
    try {
      const decimals = fromMeta?.decimals ?? 18;
      const fromAmount = parseUnits(amount, decimals).toString();
      const data = await readJson<QuotePayload>("/api/v1/swaps/quote", {
        method: "POST",
        body: JSON.stringify({
          fromChainId,
          toChainId,
          fromToken,
          toToken,
          fromAmount,
        }),
      });
      setQuote(data);
      setPhase("idle");
    } catch (error) {
      setPhase("error");
      setMessage(error instanceof Error ? error.message : "Quote failed.");
    }
  }

  async function settle(txHash: string, provider: Provider, exchangeId?: string) {
    setPhase("settling");
    setProgress(
      provider === "changenow"
        ? "Waiting for the payout to finish…"
        : "Waiting for the swap router to confirm the fill…",
    );
    for (let attempt = 0; attempt < 24; attempt += 1) {
      const response = await fetch("/api/v1/swaps/settle", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider,
          txHash,
          fromChain: String(fromChainId),
          toChain: String(toChainId),
          exchangeId,
        }),
      });
      const data = (await response.json()) as {
        status?: string;
        creditedCents?: number;
        alreadyExists?: boolean;
        message?: string;
        nowStatus?: string;
      };
      if (response.status === 202) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        continue;
      }
      if (!response.ok) {
        throw new Error(data.message ?? "Settle failed.");
      }
      setPhase("success");
      setProgress(null);
      setMessage(
        data.alreadyExists
          ? "This hash was already booked. No second credit."
          : `Booked. Credited ${money(data.creditedCents ?? 0)} to website credit. Convert it on the desk.`,
      );
      router.refresh();
      return;
    }
    throw new Error("The route is still pending. Retry settle from the hash in a minute.");
  }

  async function onSwap() {
    if (!quote) return;
    setPhase("executing");
    setMessage(null);
    try {
      if (quote.provider === "changenow" || isChangeNowQuote(quote.quote)) {
        setProgress("Opening a pay-in…");
        const decimals = fromMeta?.decimals ?? 18;
        const fromAmount = parseUnits(amount, decimals).toString();
        const opened = await readJson<OpenedPayin>("/api/v1/swaps/changenow/create", {
          method: "POST",
          body: JSON.stringify({
            fromChainId,
            toChainId,
            fromToken,
            toToken,
            fromAmount,
          }),
        });
        setPayin(opened);
        setProgress("Check your wallet — send the deposit to the pay-in address.");
        const { sendChangeNowDeposit } = await import("@/lib/changenow/browser");
        const txHash = await sendChangeNowDeposit({
          fromChainId,
          tokenAddress: opened.tokenAddress,
          payinAddress: opened.payinAddress,
          humanAmount: opened.fromAmount,
          decimals,
        });
        await settle(txHash, "changenow", opened.exchangeId);
        return;
      }

      setProgress("Check your wallet for allowance and swap signatures.");
      const { executeQuotedSwap, firstExecutionHash } = await import("@/lib/lifi/browser");
      const executed = await executeQuotedSwap(quote.quote as unknown as import("@lifi/sdk").LiFiStep, (route) => {
        const latest = route.steps.flatMap((step) => step.execution?.actions ?? []).at(-1);
        if (latest?.type) {
          setProgress(`${latest.type.replaceAll("_", " ").toLowerCase()} · ${latest.status}`);
        }
      });
      const txHash = firstExecutionHash(executed);
      if (!txHash) {
        throw new Error("Wallet signed, but no source hash was returned.");
      }
      await settle(txHash, "lifi");
    } catch (error) {
      setPhase("error");
      setProgress(null);
      setMessage(error instanceof Error ? error.message : "Swap failed.");
    }
  }

  async function reconnect() {
    const connector = connectors.find((item) => item.name.toLowerCase().includes("metamask")) ?? connectors[0];
    if (!connector) return;
    await disconnectAsync().catch(() => undefined);
    await connectAsync({ connector });
  }

  if (chainNamespace !== "eip155") {
    return (
      <p className="max-w-[65ch] text-zinc-400">
        Swap Studio is EVM-only. Sign out and connect MetaMask or Coinbase to run a live route, including
        Robinhood Chain ETH.
      </p>
    );
  }

  const receiveUsd = quote?.quote.estimate.toAmountUSD
    ? `$${Number(quote.quote.estimate.toAmountUSD).toFixed(2)}`
    : quote
      ? `${quote.quote.estimate.toAmount} ${quote.quote.action.toToken.symbol}`
      : "—";

  return (
    <div className="grid grid-cols-1 gap-12 md:grid-cols-[1.15fr_0.85fr]">
      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          void onQuote();
        }}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-sm text-zinc-400">From chain</span>
            <select
              value={fromChainId}
              onChange={(event) => setFromChainId(Number(event.target.value))}
              className="w-full border border-white/10 bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            >
              {chains.map((chain) => (
                <option key={chain.id} value={chain.id}>
                  {chain.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-2">
            <span className="text-sm text-zinc-400">To chain</span>
            <select
              value={toChainId}
              onChange={(event) => setToChainId(Number(event.target.value))}
              className="w-full border border-white/10 bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            >
              {chains.map((chain) => (
                <option key={chain.id} value={chain.id}>
                  {chain.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TokenSelect label="From token" tokens={fromTokens} value={fromToken} onChange={setFromToken} />
          <TokenSelect label="To token" tokens={toTokens} value={toToken} onChange={setToToken} />
        </div>
        <label className="block space-y-2">
          <span className="text-sm text-zinc-400">Amount</span>
          <input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="w-full border border-white/10 bg-transparent px-3 py-2 font-mono text-sm outline-none focus:border-accent"
            inputMode="decimal"
            required
          />
        </label>
        <button
          type="submit"
          disabled={phase === "quoting" || phase === "executing" || phase === "settling"}
          className="border border-white/12 px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-200 transition-colors hover:border-white/25 hover:text-zinc-50 active:scale-[0.98] disabled:opacity-40"
        >
          {phase === "quoting" ? "Quoting…" : "Get route"}
        </button>
      </form>

      <aside className="space-y-6 border-t border-white/8 pt-6 md:border-l md:border-t-0 md:pl-10 md:pt-0">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">Route</p>
        <p className="font-mono text-xs text-zinc-500">
          {quote
            ? quote.provider === "changenow"
              ? "Desk pay-in"
              : "Swap router"
            : robinhoodLeg
              ? "Desk pay-in"
              : "Swap router picks the best path for this pair."}
        </p>
        {!isConnected || !walletMatches ? (
          <div className="space-y-3">
            <p className="text-sm text-zinc-400">
              Reconnect the signed-in address to execute. Session {sessionAddress.slice(0, 6)}…{sessionAddress.slice(-4)}
            </p>
            <button
              type="button"
              onClick={() => void reconnect()}
              className="bg-accent px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-50 transition-colors hover:bg-accent-press active:scale-[0.98]"
            >
              Reconnect wallet
            </button>
          </div>
        ) : null}

        {quote ? (
          <dl className="divide-y divide-white/8 border-y border-white/8 text-sm">
            <div className="flex justify-between py-3">
              <dt className="text-zinc-500">Notional</dt>
              <dd className="font-mono tabular-nums">{money(quote.fromAmountUsdCents)}</dd>
            </div>
            <div className="flex justify-between py-3">
              <dt className="text-zinc-500">Receive</dt>
              <dd className="flex items-center gap-2 font-mono tabular-nums">
                <TokenIcon
                  symbol={quote.quote.action.toToken.symbol}
                  logoURI={quote.quote.action.toToken.logoURI ?? toMeta?.logoURI}
                />
                {receiveUsd}
              </dd>
            </div>
            <div className="flex justify-between py-3">
              <dt className="text-zinc-500">Reward at {quote.rule?.conversionBps ?? 0} bps</dt>
              <dd className="font-mono tabular-nums text-accent">{money(quote.estimatedRewardCents)}</dd>
            </div>
            <div className="flex justify-between py-3">
              <dt className="text-zinc-500">{money(quote.rule?.minNotionalUsdCents ?? MIN_NOTIONAL_USD_CENTS)} floor</dt>
              <dd className="font-mono">{quote.qualifies ? "Clears" : "Held"}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-zinc-500">Quote a route to see USD notional and the credit that would post.</p>
        )}

        {payin ? (
          <dl className="divide-y divide-white/8 border-y border-white/8 text-sm">
            <div className="flex justify-between gap-4 py-3">
              <dt className="shrink-0 text-zinc-500">Pay-in</dt>
              <dd className="break-all font-mono text-xs">{payin.payinAddress}</dd>
            </div>
            <div className="flex justify-between py-3">
              <dt className="text-zinc-500">Send</dt>
              <dd className="font-mono tabular-nums">
                {payin.fromAmount} {payin.fromCurrency.toUpperCase()}
              </dd>
            </div>
            <div className="flex justify-between py-3">
              <dt className="text-zinc-500">Payout</dt>
              <dd className="font-mono">
                {payin.toAmount} {payin.toCurrency.toUpperCase()} on {payin.toNetwork}
              </dd>
            </div>
          </dl>
        ) : null}

        <button
          type="button"
          disabled={!quote || !walletMatches || phase === "executing" || phase === "settling"}
          onClick={() => void onSwap()}
          className="bg-accent px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-50 transition-colors hover:bg-accent-press active:scale-[0.98] disabled:opacity-40"
        >
          {phase === "executing" ? "Signing…" : phase === "settling" ? "Settling…" : "Swap"}
        </button>
        {progress ? <p className="font-mono text-xs text-zinc-500">{progress}</p> : null}
        {message ? (
          <p className={phase === "error" ? "text-sm text-accent" : "text-sm text-zinc-300"} role="status">
            {message}
          </p>
        ) : null}
        {quote && !quote.qualifies ? (
          <p className="text-sm text-zinc-500">
            Below {money(quote.rule?.minNotionalUsdCents ?? MIN_NOTIONAL_USD_CENTS)} the swap still runs. The credit is stored as
            below_threshold.
          </p>
        ) : null}
      </aside>
    </div>
  );
}
