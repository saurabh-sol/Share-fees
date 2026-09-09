"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowsClockwise,
  ArrowsLeftRight,
  ChartLineUp,
  Coins,
  UsersThree,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";

const spring = { type: "spring" as const, stiffness: 100, damping: 20 };

const LOOP: {
  id: string;
  title: string;
  body: string;
  Icon: Icon;
  span: string;
}[] = [
  {
    id: "01",
    title: "Swap through Accrued",
    body: "Every fill in Swap Studio routes through the desk. Live Uniswap on Robinhood Chain, one session, one ledger.",
    Icon: ArrowsLeftRight,
    span: "md:col-span-7",
  },
  {
    id: "02",
    title: "Net fees pool",
    body: "A share of protocol fees from each swap stays with Accrued. The net remainder is earmarked for holder distribution.",
    Icon: Coins,
    span: "md:col-span-5",
  },
  {
    id: "03",
    title: "Pro rata to $ACCR",
    body: "Eligible $ACCR holders receive distribution based on holdings. More tokens on the snapshot, larger your share of the pool.",
    Icon: UsersThree,
    span: "md:col-span-5",
  },
  {
    id: "04",
    title: "Volume compounds",
    body: "More swaps through Accrued means more net fees flowing back. Holders have a direct reason to route volume here.",
    Icon: ChartLineUp,
    span: "md:col-span-7",
  },
];

export function Flywheel() {
  return (
    <section id="flywheel" className="scroll-mt-16 border-t border-white/8">
      <div className="mx-auto grid max-w-[1400px] grid-cols-1 items-end gap-10 px-4 py-16 md:grid-cols-[1.15fr_0.85fr] md:px-8 md:py-24">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent">[05] Flywheel</p>
          <h2 className="mt-5 max-w-[14ch] text-4xl tracking-tighter leading-none text-zinc-100 md:text-6xl">
            Swap fees flow to holders.
          </h2>
        </div>
        <div className="space-y-4">
          <p className="max-w-[44ch] text-base leading-relaxed text-zinc-400">
            A share of the net protocol fees from every Accrued Swap Studio fill is distributed pro rata to eligible
            $ACCR holders — effective immediately.
          </p>
          <p className="inline-flex items-center gap-2 border border-accent/30 bg-accent/5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-accent">
            <ArrowsClockwise size={12} weight="bold" aria-hidden />
            Live now
          </p>
        </div>
      </div>

      <motion.div
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-80px" }}
        className="mx-auto grid max-w-[1400px] grid-cols-1 border-t border-white/8 md:grid-cols-12"
      >
        {LOOP.map((step, index) => (
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
            <h3 className="relative mt-5 max-w-[18ch] text-2xl tracking-tight text-zinc-100">{step.title}</h3>
            <p className="relative mt-3 max-w-[46ch] text-base leading-relaxed text-zinc-400">{step.body}</p>
            <span className="absolute bottom-0 left-0 h-px w-16 origin-left scale-x-0 bg-accent transition-transform group-hover:scale-x-100" />
          </motion.article>
        ))}
      </motion.div>

      <div className="border-t border-white/8">
        <div className="mx-auto grid max-w-[1400px] grid-cols-1 md:grid-cols-[1.35fr_0.65fr]">
          <div className="border-b border-white/8 px-4 py-16 md:border-b-0 md:border-r md:px-8 md:py-20">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">The loop</p>
            <p className="mt-6 font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">
              More volume through Accrued
            </p>
            <p className="mt-3 font-mono text-4xl tabular-nums tracking-tighter text-accent sm:text-5xl md:text-6xl">
              More value to $ACCR
            </p>
            <p className="mt-6 max-w-[54ch] text-base leading-relaxed text-zinc-400">
              Swap Studio is the intake. Net protocol fees are the output. Eligible holders participate pro rata —
              no separate claim step on the marketing page; distribution follows the published holder program.
            </p>
            <Link
              href="/app/swap"
              className="mt-8 inline-block border border-white/12 px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-200 transition-colors hover:border-white/25 hover:text-zinc-50 active:scale-[0.98]"
            >
              Open Swap Studio
            </Link>
          </div>
          <div className="grid grid-rows-2">
            <div className="border-b border-white/8 px-4 py-10 md:px-8">
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">Who qualifies</p>
              <p className="mt-3 text-xl tracking-tight text-zinc-100">Eligible $ACCR holders.</p>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                Holdings at each distribution snapshot determine your share. Ineligible wallets do not receive a
                slice of the fee pool.
              </p>
            </div>
            <div className="px-4 py-10 md:px-8">
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">Why route here</p>
              <p className="mt-3 text-xl tracking-tight text-zinc-100">Credit plus holder yield.</p>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                Qualifying fills still earn website credit at 50 bps. Swap volume also feeds the $ACCR fee flywheel
                for holders.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
