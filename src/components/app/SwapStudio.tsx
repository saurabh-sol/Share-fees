"use client";

import { erc20Abi, formatUnits, parseUnits } from "viem";
import { useAccount, useBalance, useConnect, useConnectors, useDisconnect, useReadContract } from "wagmi";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { LifiToken } from "@/lib/lifi/http";
import { addressesEqual } from "@/lib/lifi/notional";
import type { UniswapQuoteView } from "@/lib/swap/router";
import { MIN_NOTIONAL_USD_CENTS } from "@/lib/rules/constants";
import { ACCR_TOKEN_LOGO, ROBINHOOD_CHAIN_ID, ROBINHOOD_ACCR, ROBINHOOD_STOCKS, ROBINHOOD_USDG, robinhoodAddressUrl, robinhoodTxUrl } from "@/lib/chains/robinhood";
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

function sanitizeAmount(raw: string) {
  const cleaned = raw.replace(/[^\d.]/g, "");
  const dot = cleaned.indexOf(".");
  if (dot === -1) return cleaned;
  return `${cleaned.slice(0, dot + 1)}${cleaned.slice(dot + 1).replaceAll(".", "")}`;
}

function formatTokenQty(value: bigint, decimals: number) {
  const asNumber = Number(formatUnits(value, decimals));
  if (!Number.isFinite(asNumber) || asNumber === 0) return "0";
  if (asNumber > 0 && asNumber < 0.0001) return "<0.0001";
  return asNumber.toLocaleString("en-US", {
    maximumFractionDigits: asNumber >= 1000 ? 2 : asNumber >= 1 ? 4 : 6,
  });
}

function amountExceedsBalance(amount: string, balance: bigint | undefined, decimals: number) {
  if (balance === undefined || !amount || amount === ".") return false;
  try {
    return parseUnits(amount, decimals) > balance;
  } catch {
    return true;
  }
}

const NATIVE_GAS_RESERVE = parseUnits("0.00008", 18);

function maxSpendable(balance: bigint, decimals: number, native: boolean) {
  if (!native) return formatUnits(balance, decimals);
  const spendable = balance > NATIVE_GAS_RESERVE ? balance - NATIVE_GAS_RESERVE : 0n;
  return formatUnits(spendable, decimals);
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

type TokenBalanceView = {
  value: bigint;
  decimals: number;
  symbol: string;
};

function useRobinhoodTokenBalance(input: {
  wallet?: `0x${string}`;
  tokenAddress: string;
  isNative: boolean;
  symbol?: string;
  decimals?: number;
}) {
  const enabled = Boolean(input.wallet && input.tokenAddress);

  const native = useBalance({
    address: input.wallet,
    chainId: ROBINHOOD_CHAIN_ID,
    query: { enabled: enabled && input.isNative },
  });

  const erc20 = useReadContract({
    address: input.isNative ? undefined : (input.tokenAddress as `0x${string}`),
    abi: erc20Abi,
    functionName: "balanceOf",
    args: input.wallet ? [input.wallet] : undefined,
    chainId: ROBINHOOD_CHAIN_ID,
    query: { enabled: enabled && !input.isNative },
  });

  if (input.isNative) {
    return {
      data: native.data as TokenBalanceView | undefined,
      isLoading: native.isLoading,
      isError: native.isError,
      refetch: native.refetch,
    };
  }

  const value = erc20.data as bigint | undefined;
  return {
    data:
      value !== undefined
        ? {
            value,
            decimals: input.decimals ?? 18,
            symbol: input.symbol ?? "TOKEN",
          }
        : undefined,
    isLoading: erc20.isLoading,
    isError: erc20.isError,
    refetch: erc20.refetch,
  };
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
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);

  type HistoryEntry = { txHash: string; fromToken: string; toToken: string; notionalUsdCents: number; executedAt: string };
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const walletMatches = Boolean(address && addressesEqual(address, sessionAddress));
  const balanceAddress = (walletMatches && address ? address : sessionAddress) as `0x${string}`;
  const fromIsNative = fromToken.toLowerCase() === NATIVE.toLowerCase();
  const toIsNative = toToken.toLowerCase() === NATIVE.toLowerCase();
  const fromMeta = tokens.find((t) => t.address.toLowerCase() === fromToken.toLowerCase());
  const toMeta = tokens.find((t) => t.address.toLowerCase() === toToken.toLowerCase());
  const fromBalance = useRobinhoodTokenBalance({
    wallet: balanceAddress,
    tokenAddress: fromToken,
    isNative: fromIsNative,
    symbol: fromMeta?.symbol,
    decimals: fromMeta?.decimals,
  });
  const toBalance = useRobinhoodTokenBalance({
    wallet: balanceAddress,
    tokenAddress: toToken,
    isNative: toIsNative,
    symbol: toMeta?.symbol,
    decimals: toMeta?.decimals,
  });
  const sameChain = true; // Robinhood Chain only — always same-chain.
  const fromDecimals = fromMeta?.decimals ?? fromBalance.data?.decimals ?? 18;
  const insufficient = amountExceedsBalance(amount, fromBalance.data?.value, fromDecimals);
  const amountReady = Boolean(amount) && amount !== "." && Number(amount) > 0;

  const fromBalanceLabel = useMemo(() => {
    if (fromBalance.isLoading) return "Reading balance…";
    if (fromBalance.data) {
      const symbol = fromMeta?.symbol ?? fromBalance.data.symbol;
      return `Balance ${formatTokenQty(fromBalance.data.value, fromBalance.data.decimals)} ${symbol}`;
    }
    if (fromBalance.isError) return "Balance unavailable";
    return "Balance —";
  }, [fromBalance.data, fromBalance.isError, fromBalance.isLoading, fromMeta?.symbol]);

  const toBalanceLabel = useMemo(() => {
    if (toBalance.isLoading) return "Reading balance…";
    if (toBalance.data) {
      const symbol = toMeta?.symbol ?? toBalance.data.symbol;
      return `Balance ${formatTokenQty(toBalance.data.value, toBalance.data.decimals)} ${symbol}`;
    }
    if (toBalance.isError) return "Balance unavailable";
    return "Balance —";
  }, [toBalance.data, toBalance.isError, toBalance.isLoading, toMeta?.symbol]);

  useEffect(() => {
    if (chainNamespace !== "eip155") return;
    void readJson<{ tokens: LifiToken[] }>(`/api/v1/swaps/tokens?chainId=${ROBINHOOD_CHAIN_ID}`)
      .then((data) => setTokens(data.tokens))
      .catch((error: unknown) => {
        setPhase("error");
        setMessage(error instanceof Error ? error.message : "Could not load tokens.");
      });
    void readJson<{ swaps: HistoryEntry[] }>("/api/v1/swaps/history")
      .then((data) => setHistory(data.swaps ?? []))
      .catch(() => {});
  }, [chainNamespace]);

  function importToken(token: LifiToken) {
    setTokens((prev) => {
      if (prev.some((t) => t.address.toLowerCase() === token.address.toLowerCase())) return prev;
      return [...prev, token];
    });
  }

  function setSellAmount(next: string) {
    setAmount(sanitizeAmount(next));
    setQuote(null);
    if (phase === "error" || phase === "success") {
      setPhase("idle");
      setMessage(null);
    }
  }

  function setSellToken(next: string) {
    setFromToken(next);
    setQuote(null);
  }

  function setBuyToken(next: string) {
    setToToken(next);
    setQuote(null);
  }

  function fillMax() {
    if (!fromBalance.data) return;
    setSellAmount(maxSpendable(fromBalance.data.value, fromBalance.data.decimals, fromIsNative));
  }

  function setAccrPair(direction: "buy" | "sell") {
    if (direction === "buy") {
      setSellToken(ROBINHOOD_USDG);
      setBuyToken(ROBINHOOD_ACCR);
    } else {
      setSellToken(ROBINHOOD_ACCR);
      setBuyToken(ROBINHOOD_USDG);
    }
    setSellAmount("");
    setQuote(null);
    if (phase === "error" || phase === "success") {
      setPhase("idle");
      setMessage(null);
    }
  }

  async function onQuote() {
    if (!amountReady || insufficient) return;
    setPhase("quoting");
    setMessage(null);
    setQuote(null);
    try {
      const decimals = fromMeta?.decimals ?? fromBalance.data?.decimals ?? 18;
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
      void fromBalance.refetch();
      void toBalance.refetch();
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
          route: uniQuote.route as Parameters<typeof executeUniswapSwap>[0]["route"],
          poolKey: uniQuote.poolKey as Parameters<typeof executeUniswapSwap>[0]["poolKey"],
          zeroForOne: uniQuote.zeroForOne,
          amountIn: uniQuote.action.fromAmount,
          amountOutMinimum: amountOutMin.toString(),
          recipient: address as `0x${string}`,
          isNativeIn: uniQuote.isNativeIn,
          isNativeOut: uniQuote.isNativeOut,
          needsWrapIn: uniQuote.needsWrapIn,
          needsUnwrapOut: uniQuote.needsUnwrapOut,
        },
        (step) => setProgress(step),
      );

      setLastTxHash(txHash);

      await settle(txHash, {
        fromToken: quote.quote.action.fromToken.address,
        toToken: quote.quote.action.toToken.address,
        notionalUsdCents: quote.fromAmountUsdCents,
      });

      setHistory((prev) => [
        {
          txHash,
          fromToken: quote.quote.action.fromToken.symbol ?? fromToken,
          toToken: quote.quote.action.toToken.symbol ?? toToken,
          notionalUsdCents: quote.fromAmountUsdCents,
          executedAt: new Date().toISOString(),
        },
        ...prev,
      ]);
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
    ? formatTokenQty(BigInt(quote.quote.estimate.toAmount), toMeta?.decimals ?? 18)
    : "";

  const accrInPair =
    addressesEqual(fromToken, ROBINHOOD_ACCR) || addressesEqual(toToken, ROBINHOOD_ACCR);

  return (
    <div className="grid grid-cols-1 gap-12 md:grid-cols-[1.15fr_0.85fr]">
      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          void onQuote();
        }}
      >
        <div className="flex flex-wrap items-center gap-3 border border-white/8 bg-raised/30 px-4 py-3">
          <div className="flex items-center gap-2">
            <TokenIcon symbol="ACCR" logoURI={ACCR_TOKEN_LOGO} />
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-300">$ACCR</span>
          </div>
          <button
            type="button"
            onClick={() => setAccrPair("buy")}
            className="border border-white/12 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-200 transition-colors hover:border-white/25 hover:text-zinc-50 active:scale-[0.98]"
          >
            Buy ACCR
          </button>
          <button
            type="button"
            onClick={() => setAccrPair("sell")}
            className="border border-white/12 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-200 transition-colors hover:border-white/25 hover:text-zinc-50 active:scale-[0.98]"
          >
            Sell ACCR
          </button>
          <a
            href={robinhoodAddressUrl(ROBINHOOD_ACCR)}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
          >
            {ROBINHOOD_ACCR.slice(0, 6)}…{ROBINHOOD_ACCR.slice(-4)}
          </a>
        </div>
        {accrInPair ? (
          <p className="border border-amber-500/20 bg-amber-500/5 px-4 py-3 font-mono text-[11px] leading-relaxed text-amber-200/90">
            $ACCR swaps need an on-chain Uniswap pool with liquidity. No ACCR/USDG or ACCR/WETH pool exists yet — create one at{" "}
            <a
              href="https://pools.trade"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-amber-100"
            >
              pools.trade
            </a>{" "}
            and add liquidity, then quote again.
          </p>
        ) : null}
        <div className="space-y-3">
          <div className="border border-white/10 bg-raised/40 px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">Sell</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] tabular-nums text-zinc-400">{fromBalanceLabel}</span>
                <button
                  type="button"
                  disabled={!fromBalance.data || fromBalance.data.value === 0n}
                  onClick={fillMax}
                  className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent transition-colors hover:text-accent-press disabled:opacity-30"
                >
                  Max
                </button>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <input
                value={amount}
                onChange={(event) => setSellAmount(event.target.value)}
                className="min-w-0 flex-1 bg-transparent font-mono text-2xl tabular-nums text-zinc-100 outline-none placeholder:text-zinc-600"
                inputMode="decimal"
                placeholder="0"
                required
                aria-label="Sell amount"
              />
              <TokenSelect
                label="From token"
                tokens={tokens}
                value={fromToken}
                onChange={setSellToken}
                onImportToken={importToken}
                compact
              />
            </div>
            {insufficient ? (
              <p className="mt-2 font-mono text-[11px] text-accent">Amount is above the wallet balance.</p>
            ) : null}
          </div>

          <div className="border border-white/10 bg-raised/40 px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">Buy</span>
              <span className="font-mono text-[11px] tabular-nums text-zinc-400">{toBalanceLabel}</span>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <input
                value={quote ? receiveAmount : ""}
                readOnly
                tabIndex={-1}
                className="min-w-0 flex-1 bg-transparent font-mono text-2xl tabular-nums text-zinc-100 outline-none placeholder:text-zinc-600"
                placeholder="0"
                aria-label="Buy amount"
              />
              <TokenSelect
                label="To token"
                tokens={tokens}
                value={toToken}
                onChange={setBuyToken}
                onImportToken={importToken}
                compact
              />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={
              !amountReady ||
              insufficient ||
              phase === "quoting" ||
              phase === "executing" ||
              phase === "settling"
            }
            className="border border-white/12 px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-200 transition-colors hover:border-white/25 hover:text-zinc-50 active:scale-[0.98] disabled:opacity-40"
          >
            {phase === "quoting" ? "Quoting…" : "Get route"}
          </button>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">
            {sameChain ? "Same-chain" : "Cross-chain"}
          </span>
        </div>
      </form>

      <aside className="space-y-6 border-t border-white/8 pt-6 md:border-l md:border-t-0 md:pl-10 md:pt-0">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">Route</p>
        <p className="font-mono text-xs text-zinc-500">
          {quote
            ? (() => {
                const rt = quote.quote.route?.type;
                if (rt === "v3-multi") return "Uniswap · multi-hop on Robinhood Chain";
                if (rt === "v3-single") return "Uniswap · direct on Robinhood Chain";
                if (rt === "multi") return `Uniswap · multi-hop (${(quote.quote.route as { path: unknown[] }).path?.length ?? 2} pools) on Robinhood Chain`;
                return "Uniswap · direct on Robinhood Chain";
              })()
            : "The desk finds the best pool for this pair."}
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
          disabled={!quote || !walletMatches || insufficient || phase === "executing" || phase === "settling"}
          onClick={() => void onSwap()}
          className="bg-accent px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-50 transition-colors hover:bg-accent-press active:scale-[0.98] disabled:opacity-40"
        >
          {phase === "executing" ? "Signing…" : phase === "settling" ? "Settling…" : "Swap"}
        </button>
        {phase === "success" ? (
          <div className="animate-in fade-in slide-in-from-bottom-2 rounded-sm border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
            <p className="flex items-center gap-2 font-mono text-sm text-emerald-400">
              <span className="text-lg">✓</span> Swap successful!
            </p>
            {message ? <p className="mt-1 text-sm text-zinc-300">{message}</p> : null}
            {lastTxHash ? (
              <a
                href={robinhoodTxUrl(lastTxHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 font-mono text-xs text-emerald-400 underline underline-offset-2 hover:text-emerald-300"
              >
                View on Blockscout · {lastTxHash.slice(0, 10)}…{lastTxHash.slice(-6)}
                <span aria-hidden>↗</span>
              </a>
            ) : null}
          </div>
        ) : (
          <>
            {progress ? <p className="font-mono text-xs text-zinc-500">{progress}</p> : null}
            {message ? (
              <p className={phase === "error" ? "text-sm text-accent" : "text-sm text-zinc-300"} role="status">
                {message}
              </p>
            ) : null}
          </>
        )}
        {quote && !quote.qualifies ? (
          <p className="text-sm text-zinc-500">
            Below {money(quote.rule?.minNotionalUsdCents ?? MIN_NOTIONAL_USD_CENTS)} the swap still runs. The credit is stored as
            below_threshold.
          </p>
        ) : null}
      </aside>

      {/* ── Swap History ── */}
      <section className="col-span-full border-t border-white/8 pt-8">
        <button
          type="button"
          onClick={() => setShowHistory((v) => !v)}
          className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-zinc-400 hover:text-zinc-200"
        >
          <span>{showHistory ? "▾" : "▸"}</span> Swap history ({history.length})
        </button>

        {showHistory && (
          <div className="mt-4">
            {history.length === 0 ? (
              <p className="text-sm text-zinc-500">No swaps yet. Your swaps will appear here after completion.</p>
            ) : (
              <div className="space-y-2">
                {history.map((entry) => (
                  <div
                    key={entry.txHash}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border border-white/6 bg-white/[0.02] px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-zinc-300">
                        {entry.fromToken} → {entry.toToken}
                      </span>
                      <span className="font-mono text-xs tabular-nums text-zinc-500">
                        {money(entry.notionalUsdCents)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[10px] text-zinc-600">
                        {new Date(entry.executedAt).toLocaleString()}
                      </span>
                      <a
                        href={robinhoodTxUrl(entry.txHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-xs text-accent underline underline-offset-2 hover:text-accent-press"
                      >
                        {entry.txHash.slice(0, 8)}…{entry.txHash.slice(-4)} ↗
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
