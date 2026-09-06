"use client";

import { memo } from "react";
import { motion } from "framer-motion";

const ROWS = [
  { pair: "ETH / USDC", chain: "Base → Arb", usd: "$1,842.60", bps: "50 bps", out: "$9.21" },
  { pair: "SOL / USDT", chain: "Sol → Eth", usd: "$764.18", bps: "50 bps", out: "$3.82" },
  { pair: "WBTC / USDC", chain: "Eth → Base", usd: "$4,210.04", bps: "50 bps", out: "$21.05" },
  { pair: "OP / USDT", chain: "Op → Pol", usd: "$512.77", bps: "50 bps", out: "$2.56" },
  { pair: "ETH / USDC", chain: "Base → Arb", usd: "$1,842.60", bps: "50 bps", out: "$9.21" },
  { pair: "SOL / USDT", chain: "Sol → Eth", usd: "$764.18", bps: "50 bps", out: "$3.82" },
];

export const RatioTape = memo(function RatioTape() {
  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-raised shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
      <div className="flex items-center justify-between border-b border-white/8 px-6 py-4">
        <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Live conversion tape</p>
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
      </div>
      <div className="relative h-[340px] overflow-hidden">
        <motion.div
          className="flex flex-col"
          animate={{ y: ["0%", "-50%"] }}
          transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
        >
          {ROWS.map((row, index) => (
            <div
              key={`${row.pair}-${index}`}
              className="grid grid-cols-[1.2fr_1fr_0.8fr] gap-3 border-b border-white/6 px-6 py-4"
            >
              <div>
                <p className="font-mono text-sm text-zinc-100">{row.pair}</p>
                <p className="text-xs text-zinc-500">{row.chain}</p>
              </div>
              <p className="font-mono text-sm text-zinc-300">{row.usd}</p>
              <p className="text-right font-mono text-sm text-accent">{row.out}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
});
