"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowsLeftRight, ClipboardText, Gift, Key } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";

const spring = { type: "spring" as const, stiffness: 100, damping: 20 };

const PAGES: Array<{
  id: string;
  href: string;
  title: string;
  body: string;
  Icon: Icon;
  wide: boolean;
}> = [
  {
    id: "01",
    href: "/app/swap",
    title: "Swap Studio",
    body: "Quote and settle a live fill through the swap router or Robinhood ETH. The same rule engine prices it.",
    Icon: ArrowsLeftRight,
    wide: true,
  },
  {
    id: "02",
    href: "/app/claims",
    title: "Activity",
    body: "Scan the signed-in wallet or import a hash. Claim posts website credit. One (tx, chain) never pays twice.",
    Icon: ClipboardText,
    wide: false,
  },
  {
    id: "03",
    href: "/app/redeem",
    title: "Redeem",
    body: "Convert credit 1:1 to USDG or an LLM key. USDG queues to this EVM address. The t2c_ key is shown once.",
    Icon: Key,
    wide: false,
  },
  {
    id: "04",
    href: "/app/rewards",
    title: "Rewards",
    body: "Read the published floor, the 50 bps ratio, and remaining daily room before you swap again.",
    Icon: Gift,
    wide: true,
  },
];

export function DeskMap() {
  return (
    <section id="desk" className="border-t border-white/8">
      <div className="mx-auto grid max-w-[1400px] grid-cols-1 items-end gap-10 px-4 py-16 md:grid-cols-[0.85fr_1.15fr] md:px-8 md:py-24">
        <p className="max-w-[40ch] text-base leading-relaxed text-zinc-400 md:order-2">
          After the wallet signs, the desk is four pages. Credit lives on the address. There is no email profile.
        </p>
        <div className="md:order-1">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent">[06] The desk</p>
          <h2 className="mt-5 max-w-[12ch] text-4xl tracking-tighter leading-none text-zinc-100 md:text-6xl">
            Four pages. One ledger.
          </h2>
        </div>
      </div>

      <motion.div
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-80px" }}
        className="mx-auto grid max-w-[1400px] grid-cols-1 border-t border-white/8 md:grid-cols-12"
      >
        {PAGES.map((page, index) => (
          <motion.article
            key={page.id}
            variants={{
              hidden: { opacity: 0, y: 16 },
              show: { opacity: 1, y: 0, transition: { ...spring, delay: index * 0.05 } },
            }}
            whileHover={{ y: -3 }}
            transition={spring}
            className={`border-b border-white/8 px-4 py-12 md:px-8 md:py-14 ${
              page.wide ? "md:col-span-7" : "md:col-span-5"
            } ${index % 2 === 0 ? "md:border-r" : ""}`}
          >
            <page.Icon size={18} className="text-accent" />
            <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">{page.id}</p>
            <h3 className="mt-3 text-2xl tracking-tight text-zinc-100">{page.title}</h3>
            <p className="mt-3 max-w-[46ch] text-base leading-relaxed text-zinc-400">{page.body}</p>
            <Link
              href={page.href}
              className="mt-6 inline-block font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-300 hover:text-zinc-100"
            >
              Open {page.title}
            </Link>
          </motion.article>
        ))}
      </motion.div>
    </section>
  );
}
