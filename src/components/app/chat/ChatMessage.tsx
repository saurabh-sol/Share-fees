"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

const spring = { type: "spring" as const, stiffness: 100, damping: 20 };

export function ChatMessage({
  align,
  label,
  accent,
  children,
}: {
  align: "start" | "end";
  label: string;
  accent?: boolean;
  children: ReactNode;
}) {
  const you = align === "end";
  return (
    <motion.li
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring}
      className={`flex ${you ? "justify-end" : "justify-start"}`}
    >
      <div className={`flex w-full max-w-[min(40rem,100%)] flex-col ${you ? "items-end" : "items-start"}`}>
        <p
          className={`font-mono text-[11px] uppercase tracking-[0.16em] ${
            accent ? "text-[#c23a3a]" : "text-zinc-500"
          }`}
        >
          {label}
        </p>
        <div
          className={`mt-2 max-w-full px-4 py-3 ${
            you
              ? "desk-glass text-right text-sm leading-relaxed text-zinc-200"
              : "w-full"
          }`}
        >
          {children}
        </div>
      </div>
    </motion.li>
  );
}
