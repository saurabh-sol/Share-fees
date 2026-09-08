"use client";

import { useMemo, useState } from "react";
import { DEFAULT_CONVERSION_BPS, MIN_NOTIONAL_USD_CENTS } from "@/lib/rules/constants";

const MIN_USD = MIN_NOTIONAL_USD_CENTS / 100;
const MAX_USD = 25_000;
const STEP_USD = 25;
const PRESETS = [250, 1_000, 2_500, 5_000, 10_000] as const;

function usd(value: number, fractionDigits = 2) {
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}`;
}

/**
 * Live payout math in the hero. The published ratio applied to a swap size
 * the visitor picks — concrete numbers, no estimate language.
 */
export function CreditCalculator() {
  const [swapUsd, setSwapUsd] = useState(1_000);
  const [dragging, setDragging] = useState(false);
  const creditUsd = useMemo(() => (swapUsd * DEFAULT_CONVERSION_BPS) / 10_000, [swapUsd]);
  const pct = ((swapUsd - MIN_USD) / (MAX_USD - MIN_USD)) * 100;

  return (
    <div className="relative max-w-lg border border-white/10 bg-raised/50">
      <span aria-hidden className="absolute -left-px -top-px h-3 w-3 border-l border-t border-accent" />
      <span aria-hidden className="absolute -right-px -top-px h-3 w-3 border-r border-t border-accent" />
      <span aria-hidden className="absolute -bottom-px -left-px h-3 w-3 border-b border-l border-accent" />
      <span aria-hidden className="absolute -bottom-px -right-px h-3 w-3 border-b border-r border-accent" />

      <div className="flex items-center justify-between gap-3 border-b border-white/8 px-4 py-3 sm:px-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
          Published ratio · {DEFAULT_CONVERSION_BPS} bps
        </p>
        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">
          <span aria-hidden className="h-1.5 w-1.5 animate-pulse bg-accent" />
          Live math
        </span>
      </div>

      <div className="px-4 py-5 sm:px-5 sm:py-6">
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-[1fr_auto_1fr] sm:items-end sm:gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">Swap notional</p>
            <p className="mt-1 font-mono text-2xl tabular-nums tracking-tight text-zinc-100 transition-[opacity] duration-150 sm:text-3xl">
              {usd(swapUsd, 0)}
            </p>
          </div>
          <p className="hidden font-mono text-xl text-zinc-600 sm:block" aria-hidden>
            →
          </p>
          <div className="sm:text-right">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">Reward</p>
            <p className="mt-1 font-mono text-2xl tabular-nums tracking-tight text-accent transition-[opacity] duration-150 sm:text-3xl">
              {usd(creditUsd)}
            </p>
          </div>
        </div>

        <div className="mt-6">
          <div className="relative flex h-11 items-center touch-none">
            <div className="pointer-events-none absolute inset-x-0 h-1.5 bg-white/8" />
            <div
              className={`pointer-events-none absolute left-0 h-1.5 bg-accent ${
                dragging ? "" : "transition-[width] duration-200 ease-out"
              }`}
              style={{ width: `${pct}%` }}
            />
            <input
              type="range"
              min={MIN_USD}
              max={MAX_USD}
              step={STEP_USD}
              value={swapUsd}
              onInput={(event) => setSwapUsd(Number(event.currentTarget.value))}
              onPointerDown={() => setDragging(true)}
              onPointerUp={() => setDragging(false)}
              onPointerCancel={() => setDragging(false)}
              onLostPointerCapture={() => setDragging(false)}
              aria-label="Swap size in US dollars"
              aria-valuetext={`${usd(swapUsd, 0)} swap notional, ${usd(creditUsd)} reward`}
              className="hero-range absolute inset-0 w-full"
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {PRESETS.map((amount) => (
            <button
              key={amount}
              type="button"
              onClick={() => setSwapUsd(amount)}
              aria-pressed={swapUsd === amount}
              className={
                swapUsd === amount
                  ? "border border-accent/40 bg-accent/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-100"
                  : "border border-white/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 transition-colors hover:border-white/20 hover:text-zinc-200"
              }
            >
              {usd(amount, 0)}
            </button>
          ))}
        </div>

        <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">
          {usd(MIN_USD, 0)} floor · reward posts after the fill confirms · {usd(10_000)} swap →{" "}
          {usd((10_000 * DEFAULT_CONVERSION_BPS) / 10_000)} reward
        </p>
      </div>
    </div>
  );
}
