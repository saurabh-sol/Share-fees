"use client";

import { motion } from "framer-motion";
import { ProviderMark } from "@/components/llm/ProviderMark";
import { OFFICIAL_API_DESK_POINTS } from "@/lib/gateway/official-apis";

const spring = { type: "spring" as const, stiffness: 100, damping: 20 };

export function ApiSurface() {
  return (
    <section id="api" className="border-t border-white/8">
      <div className="mx-auto grid max-w-[1400px] grid-cols-1 items-end gap-10 px-4 py-16 md:grid-cols-[1.15fr_0.85fr] md:px-8 md:py-24">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent">[08] LLM API</p>
          <h2 className="mt-5 max-w-[16ch] text-4xl tracking-tighter leading-none text-zinc-100 md:text-6xl">
            Official APIs. Desk points.
          </h2>
        </div>
        <p className="max-w-[44ch] text-base leading-relaxed text-zinc-400">
          Redeem locks a provider. The key is that vendor’s real contract. Usage hits the live model and burns
          remaining cents. Upstream credentials stay on the server.
        </p>
      </div>

      <div className="mx-auto max-w-[1400px] border-t border-white/8">
        {OFFICIAL_API_DESK_POINTS.map((item, index) => (
          <motion.article
            key={item.provider}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ ...spring, delay: index * 0.03 }}
            className="grid grid-cols-1 border-b border-white/8 md:grid-cols-[0.7fr_1.3fr]"
          >
            <div className="flex items-center gap-4 border-b border-white/8 px-4 py-10 md:border-b-0 md:border-r md:px-8">
              <motion.span
                whileHover={{ y: -4, scale: 1.06 }}
                transition={spring}
                className="inline-flex"
              >
                <ProviderMark provider={item.provider} size={44} />
              </motion.span>
              <div>
                <p className="text-xl tracking-tight text-zinc-100">{item.vendor}</p>
                <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500">{item.host}</p>
              </div>
            </div>
            <div className="space-y-2 px-4 py-10 md:px-8">
              <p className="font-mono text-sm tabular-nums text-zinc-100">{item.path}</p>
              <p className="font-mono text-sm text-zinc-400">{item.auth}</p>
              <p className="max-w-[62ch] pt-2 text-sm leading-relaxed text-zinc-500">
                Point the official SDK at this origin. A one-line prompt still spends at least one cent.
              </p>
            </div>
          </motion.article>
        ))}
      </div>
    </section>
  );
}
