"use client";

import { parseUnits } from "viem";
import { useAccount, useConnect, useConnectors, useDisconnect } from "wagmi";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { LifiToken } from "@/lib/lifi/http";
import { addressesEqual } from "@/lib/lifi/notional";
import type { UniswapQuoteView } from "@/lib/swap/router";
import { MIN_NOTIONAL_USD_CENTS } from "@/lib/rules/constants";
import { ROBINHOOD_CHAIN_ID, ROBINHOOD_STOCKS, ROBINHOOD_USDG } from "@/lib/chains/robinhood";
import { TokenIcon } from "./TokenIcon";
import { TokenSelect } from "./TokenSelect";

type QuotePayload = {
  provider: "uniswap";
  quote: UniswapQuoteView;
  fromAmountUsdCents: number;
  estimatedRewardCents: number;
  qualifies: boolean;
  rule: { conversionBps: number; minNotionalUsdCents: number } | null;
};

const NATIVE = "0x0000000000000000000000000000000000000000";

// Default pair: NVDA → USDG (users land on stock trading by default).
const DEFAULT_FROM = ROBINHOOD_STOCKS[0]?.address ?? NATIVE;
const DEFAULT_TO = ROBINHOOD_USDG;

const STOCK_SYMBOLS = new Set(ROBINHOOD_STOCKS.map((s) => s.symbol));

function money(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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

  const [tokens, setTokens] = useState<LifiToken[]>([]);
  const [fromToken, setFromToken] = useState(DEFAULT_FROM);
  const [toToken, setToToken] = useState(DEFAULT_TO);
  const [amount, setAmount] = useState("1");
  const [quote, setQuote] = useState<QuotePayload | null>(null);
  const [phase, setPhase] = useState<"idle" | "quoting" | "executing" | "settling" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  const walletMatches = Boolean(address && addressesEqual(address, sessionAddress));
  const fromMeta = tokens.find((t) => t.address.toLowerCase() === fromToken.toLowerCase());
  const toMeta = tokens.find((t) => t.address.toLowerCase() === toToken.toLowerCase());

  useEffect(() => {
    if (chainNamespace !== "eip155") return;
    void readJson<{ tokens: LifiToken[] }>(`/api/v1/swaps/tokens?chainId=${ROBINHOOD_CHAIN_ID}`)
      .then((data) => setTokens(data.tokens))
      .catch((error: unknown) => {
        setPhase("error");
        setMessage(error instanceof Error ? error.message : "Could not load tokens.");
      });
  }, [chainNamespace]);

  async function onQuote() {
    setPhase("quoting");
    setMessage(null);
    setQuote(null);
    try {
      const decimals = fromMeta?.decimals ?? 18;
      const fromAmount = parseUnits(amount, decimals).toString();
      const data = await readJson<QuotePayload>("/api/v1/swaps/quote", {
        method: "POST",
        body: JSON.stringify({
          fromChainId: ROBINHOOD_CHAIN_ID,
          toChainId: ROBINHOOD_CHAIN_ID,
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

  async function settle(txHash: string, extras?: Record<string, unknown>) {
    setPhase("settling");
    setProgress("Waiting for on-chain confirmation…");
    for (let attempt = 0; attempt < 24; attempt += 1) {
      const response = await fetch("/api/v1/swaps/settle", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: "uniswap",
          txHash,
          fromChain: String(ROBINHOOD_CHAIN_ID),
          toChain: String(ROBINHOOD_CHAIN_ID),
          ...extras,
        }),
      });
      const data = (await response.json()) as {
        status?: string;
        creditedCents?: number;
        alreadyExists?: boolean;
        message?: string;
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
          : `Booked. Credited ${money(data.creditedCents ?? 0)} to website credit. Volume tracked on your activity.`,
      );
      router.refresh();
      return;
    }
    throw new Error("Confirmation is still pending. Retry in a minute.");
  }

  async function onSwap() {
    if (!quote) return;
    setPhase("executing");
    setMessage(null);
    try {
      setProgress("Check your wallet for approval and swap…");
      const { executeUniswapSwap } = await import("@/lib/uniswap/browser");
      const uniQuote = quote.quote;

      const slippageBps = 50n; // 0.50%
      const amountOutMin = (BigInt(uniQuote.amountOut) * (10000n - slippageBps)) / 10000n;

      const txHash = await executeUniswapSwap(
        {
          chainId: ROBINHOOD_CHAIN_ID as Parameters<typeof executeUniswapSwap>[0]["chainId"],
          poolKey: uniQuote.poolKey as Parameters<typeof executeUniswapSwap>[0]["poolKey"],
          zeroForOne: uniQuote.zeroForOne,
          amountIn: uniQuote.action.fromAmount,
          amountOutMinimum: amountOutMin.toString(),
          recipient: address as `0x${string}`,
          isNativeIn: uniQuote.isNativeIn,
          isNativeOut: uniQuote.isNativeOut,
        },
        (step) => setProgress(step),
      );

      await settle(txHash, {
        fromToken: quote.quote.action.fromToken.address,
        toToken: quote.quote.action.toToken.address,
        notionalUsdCents: quote.fromAmountUsdCents,
      });
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
        Swap Studio is EVM-only. Sign out and connect MetaMask or Coinbase to run a live route.
      </p>
    );
  }

  const receiveAmount = quote
    ? (Number(quote.quote.estimate.toAmount) / 10 ** (toMeta?.decimals ?? 18)).toFixed(6)
    : "—";

  const isStockPair = STOCK_SYMBOLS.has(fromMeta?.symbol ?? "") || STOCK_SYMBOLS.has(toMeta?.symbol ?? "");

  return (
    <div className="grid grid-cols-1 gap-12 md:grid-cols-[1.15fr_0.85fr]">
      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          void onQuote();
        }}
      >
        <div className="flex items-center gap-2 border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-300">
          <span>📈</span>
          <span>Robinhood Chain · Uniswap V4</span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TokenSelect label="From token" tokens={tokens} value={fromToken} onChange={setFromToken} />
          <TokenSelect label="To token" tokens={tokens} value={toToken} onChange={setToToken} />
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
        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={phase === "quoting" || phase === "executing" || phase === "settling"}
            className="border border-white/12 px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-200 transition-colors hover:border-white/25 hover:text-zinc-50 active:scale-[0.98] disabled:opacity-40"
          >
            {phase === "quoting" ? "Quoting…" : "Get route"}
          </button>
          <span className="font-mono text-[10px] uppercase tracking-wider text-emerald-400">
            ⚡ {isStockPair ? "Stock swap" : "On-chain swap"}
          </span>
        </div>
      </form>

      <aside className="space-y-6 border-t border-white/8 pt-6 md:border-l md:border-t-0 md:pl-10 md:pt-0">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">Route</p>
        <p className="font-mono text-xs text-zinc-500">
          {quote
            ? "Uniswap V4 — direct on-chain swap on Robinhood Chain"
            : "Uniswap V4 finds the best pool for this pair on Robinhood Chain."}
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
                {receiveAmount} {toMeta?.symbol ?? "TOKEN"}
              </dd>
            </div>
            <div className="flex justify-between py-3">
              <dt className="text-zinc-500">Pool fee</dt>
              <dd className="font-mono tabular-nums">{(quote.quote.fee / 10000).toFixed(2)}%</dd>
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
