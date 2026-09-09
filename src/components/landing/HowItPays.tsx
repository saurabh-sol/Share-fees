"use client";

import { motion } from "framer-motion";
import { LLM_PROVIDER_SUMMARY } from "@/lib/gateway/catalog";
import {
  ArrowsLeftRight,
  Coins,
  HashStraight,
  Percent,
  Scales,
  Wallet,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";

const spring = { type: "spring" as const, stiffness: 100, damping: 20 };

const STEPS: {
  id: string;
  title: string;
  body: string;
  Icon: Icon;
  span: string;
}[] = [
  {
    id: "01",
    title: "Connect the wallet",
    body: "Sign SIWE or SIWS. There is no email account. The address that signs is the desk.",
    Icon: Wallet,
    span: "md:col-span-7",
  },
  {
    id: "02",
    title: "Swap live, or scan history",
    body: "Run a fill in Swap Studio (swap router or Robinhood ETH) or scan the same wallet. Both paths hit one rule engine.",
    Icon: ArrowsLeftRight,
    span: "md:col-span-5",
  },
  {
    id: "03",
    title: "Clear the $250 floor",
    body: "Once the connected wallet's confirmed volume clears $250, BPS is listed. Each swap at or above $250 can credit. Smaller transfers stay visible. They do not pay.",
    Icon: Scales,
    span: "md:col-span-5",
  },
  {
    id: "04",
    title: "Convert at 50 bps",
    body: "Qualifying notional × 0.50% writes the credit. Changing the rule never rewrites old rows.",
    Icon: Percent,
    span: "md:col-span-7",
  },
  {
    id: "05",
    title: "Claim, then convert",
    body: "BPS posts website credit first. Convert 1:1 to LLM or USDG any time. Redeem an acc_ key or queue Robinhood USDG after that.",
    Icon: Coins,
    span: "md:col-span-7",
  },
  {
    id: "06",
    title: "One hash, one credit",
    body: "Each tx hash is booked once. Re-scan, retry, and a second claim on the same fill do not pay twice.",
    Icon: HashStraight,
    span: "md:col-span-5",
  },
];

export function HowItPays() {
  return (
    <section id="mechanics" className="scroll-mt-16 border-t border-white/8">
      <div className="mx-auto grid max-w-[1400px] grid-cols-1 items-end gap-10 px-4 py-16 md:grid-cols-[1.2fr_0.8fr] md:px-8 md:py-24">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent">[04] How it pays</p>
          <h2 className="mt-5 max-w-[14ch] text-4xl tracking-tighter leading-none text-zinc-100 md:text-6xl">
            Wallet in. Credit out.
          </h2>
        </div>
        <p className="max-w-[42ch] text-base leading-relaxed text-zinc-400">
          A qualifying swap is priced once. You take USDG or LLM credits. Six steps, same ledger, no second
          balance.
        </p>
      </div>

      <motion.div
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-80px" }}
        className="mx-auto grid max-w-[1400px] grid-cols-1 border-t border-white/8 md:grid-cols-12"
      >
        {STEPS.map((step, index) => (
          <motion.article
            key={step.id}
            variants={{
              hidden: { opacity: 0, y: 18 },
              show: { opacity: 1, y: 0, transition: { ...spring, delay: index * 0.05 } },
            }}
            whileHover={{ y: -3 }}
            transition={spring}
            className={`group relative overflow-hidden border-b border-white/8 px-4 py-12 md:px-8 md:py-14 ${step.span} ${
              index % 2 === 0 ? "md:border-r" : ""
            }`}
          >
            <span
              aria-hidden
              className="pointer-events-none absolute -right-2 top-4 font-mono text-7xl tracking-tighter text-white/[0.04] transition-transform duration-500 group-hover:translate-x-[-6px] md:text-8xl"
            >
              {step.id}
            </span>
            <div className="relative flex items-center gap-3">
              <step.Icon size={18} className="text-accent" />
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent">{step.id}</p>
            </div>
            <h3 className="relative mt-5 max-w-[16ch] text-2xl tracking-tight text-zinc-100">{step.title}</h3>
            <p className="relative mt-3 max-w-[46ch] text-base leading-relaxed text-zinc-400">{step.body}</p>
            <span className="absolute bottom-0 left-0 h-px w-16 origin-left scale-x-0 bg-accent transition-transform group-hover:scale-x-100" />
          </motion.article>
        ))}
      </motion.div>

      <div className="border-t border-white/8">
        <div className="mx-auto grid max-w-[1400px] grid-cols-1 md:grid-cols-[1.35fr_0.65fr]">
          <div className="border-b border-white/8 px-4 py-16 md:border-b-0 md:border-r md:px-8 md:py-20">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">Worked example</p>
            <p className="mt-6 font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">$1,842.60 notional × 50 bps</p>
            <p className="mt-3 font-mono text-5xl tabular-nums tracking-tighter text-accent sm:text-6xl md:text-8xl">
              $9.21
            </p>
            <p className="mt-6 max-w-[54ch] text-base leading-relaxed text-zinc-400">
              Notional is the USD value of the fill, not the token amount. Below $250 the swap can still run; the
              ledger stores it as below_threshold and no credit posts.
            </p>
          </div>
          <div className="grid grid-rows-2">
            <div className="border-b border-white/8 px-4 py-10 md:px-8">
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">USDG rail</p>
              <p className="mt-3 text-xl tracking-tight text-zinc-100">Same wallet. Robinhood.</p>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                Redeem from the desk. Destination is the session EVM address only.
              </p>
            </div>
            <div className="px-4 py-10 md:px-8">
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">LLM rail</p>
              <p className="mt-3 text-xl tracking-tight text-zinc-100">A metered acc_ key.</p>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                Paste into {LLM_PROVIDER_SUMMARY}-compatible clients. Usage burns the balance.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
