"use client";

import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CaretDown } from "@phosphor-icons/react";

const spring = { type: "spring" as const, stiffness: 100, damping: 20 };

const FAQS = [
  {
    q: "Who can use the desk?",
    a: "Any EVM or Solana wallet that can sign SIWE or SIWS. USDG redeem is EVM-only. Solana sessions still take LLM credits.",
  },
  {
    q: "When does a swap pay?",
    a: "After the connected wallet clears $250 of confirmed volume, each later fill at or above $250 can credit at 50 bps, until the $2,500 daily cap.",
  },
  {
    q: "How do I claim an old hash?",
    a: "Open Activity, scan the wallet or paste a hash the desk can verify. Claim writes website credit. Convert, then redeem.",
  },
  {
    q: "What do I get after redeem?",
    a: "USDG queues a payout to this wallet. LLM mints an acc_ key for the provider you picked. Use the official OpenAI, Anthropic, DeepSeek, or Google API against this origin. Usage spends remaining cents.",
  },
  {
    q: "Can I send USDG to another address?",
    a: "No. Destination is the session EVM address only. Treasury can stay queued until broadcast is unlocked.",
  },
  {
    q: "Why did a fill not credit?",
    a: "Below the $250 floor, over the daily cap, a duplicate hash, or a wash hold. The row stays on Activity either way.",
  },
  {
    q: "How does the $ACCR flywheel work?",
    a: "Net protocol fees from Accrued Swap Studio fills are distributed pro rata to eligible $ACCR holders. More volume through the desk means more value flowing back to holders — live now.",
  },
];

export function FaqList() {
  const [open, setOpen] = useState(0);

  return (
    <section id="faq" className="border-t border-white/8">
      <div className="mx-auto grid max-w-[1400px] grid-cols-1 items-end gap-10 px-4 py-16 md:grid-cols-[1fr_1.2fr] md:px-8 md:py-24">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent">[10] Questions</p>
          <h2 className="mt-5 max-w-[12ch] text-4xl tracking-tighter leading-none text-zinc-100 md:text-6xl">
            Before you connect.
          </h2>
        </div>
        <p className="max-w-[44ch] text-base leading-relaxed text-zinc-400">
          Short answers. The ledger does not invent a second story after you sign.
        </p>
      </div>

      <div className="mx-auto max-w-[1400px] border-t border-white/8">
        {FAQS.map((item, index) => {
          const active = open === index;
          return (
            <div key={item.q} className="border-b border-white/8">
              <button
                type="button"
                aria-expanded={active}
                onClick={() => setOpen(active ? -1 : index)}
                className="flex w-full items-center justify-between gap-6 px-4 py-6 text-left md:px-8"
              >
                <span className="text-base tracking-tight text-zinc-100 sm:text-lg">{item.q}</span>
                <motion.span
                  animate={{ rotate: active ? 180 : 0 }}
                  transition={spring}
                  className="shrink-0 text-zinc-500"
                >
                  <CaretDown size={16} />
                </motion.span>
              </button>
              <AnimatePresence initial={false}>
                {active ? (
                  <motion.div
                    key="body"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={spring}
                    className="px-4 pb-8 md:px-8"
                  >
                    <p className="max-w-[65ch] text-base leading-relaxed text-zinc-400">{item.a}</p>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
      <div className="mx-auto max-w-[1400px] px-4 py-10 md:px-8">
        <Link
          href="/docs"
          className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-400 transition-colors hover:text-zinc-100"
        >
          Full docs
        </Link>
      </div>
    </section>
  );
}
