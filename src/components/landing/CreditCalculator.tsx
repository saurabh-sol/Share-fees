"use client";

import { useState } from "react";
import { DEFAULT_CONVERSION_BPS, MIN_NOTIONAL_USD_CENTS } from "@/lib/rules/constants";

const MIN_USD = MIN_NOTIONAL_USD_CENTS / 100;
const MAX_USD = 25_000;
const STEP_USD = 50;

function usd(value: number, fractionDigits = 2) {
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}`;
}

/**
 * Live payout math in the hero. No estimate language — the published
 * ratio applied to a swap size the visitor picks.
 */
export function CreditCalculator() {
  const [swapUsd, setSwapUsd] = useState(1_000);
  const creditUsd = (swapUsd * DEFAULT_CONVERSION_BPS) / 10_000;

  return (
    <div className="max-w-md border border-white/10">
      <div className="flex items-center justify-between border-b border-white/8 px-4 py-2.5">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
          Published ratio · {DEFAULT_CONVERSION_BPS} bps
        </p>
        <span aria-hidden className="h-1.5 w-1.5 animate-pulse bg-accent" />
      </div>
      <div className="px-4 py-4">
        <div className="flex items-baseline justify-between gap-4 font-mono tabular-nums">
          <span className="text-sm text-zinc-300">Swap {usd(swapUsd, 0)}</span>
          <span className="text-lg tracking-tight text-accent">→ {usd(creditUsd)} credit</span>
        </div>
        <input
          type="range"
          min={MIN_USD}
          max={MAX_USD}
          step={STEP_USD}
          value={swapUsd}
          onChange={(event) => setSwapUsd(Number(event.target.value))}
          aria-label="Swap size in US dollars"
          className="mt-4 w-full accent-[#c23a3a]"
        />
        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">
          {usd(MIN_USD, 0)} floor · credit posts after the fill confirms
        </p>
      </div>
    </div>
  );
}
