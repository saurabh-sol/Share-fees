"use client";

import { GoogleLogo, OpenAiLogo } from "@phosphor-icons/react";
import { motion } from "framer-motion";

const spring = { type: "spring" as const, stiffness: 100, damping: 20 };

const APIS = [
  {
    vendor: "OpenAI",
    host: "api.openai.com/v1",
    path: "POST /v1/chat/completions",
    auth: "Authorization: Bearer t2c_…",
    mark: "openai" as const,
  },
  {
    vendor: "Anthropic",
    host: "api.anthropic.com",
    path: "POST /v1/messages",
    auth: "x-api-key: t2c_…",
    mark: "/claude.png" as const,
  },
  {
    vendor: "DeepSeek",
    host: "api.deepseek.com/v1",
    path: "POST /v1/chat/completions",
    auth: "Authorization: Bearer t2c_…",
    mark: "/deepseek.png" as const,
  },
  {
    vendor: "Google",
    host: "generativelanguage.googleapis.com",
    path: "POST /v1beta/models/{model}:generateContent",
    auth: "x-goog-api-key: t2c_…",
    mark: "google" as const,
  },
];

export function ApiSurface() {
  return (
    <section id="api" className="border-t border-white/8">
      <div className="mx-auto grid max-w-[1400px] grid-cols-1 items-end gap-10 px-4 py-16 md:grid-cols-[1.15fr_0.85fr] md:px-8 md:py-24">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#c23a3a]">[08] LLM API</p>
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
        {APIS.map((item, index) => (
          <motion.article
            key={item.vendor}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ ...spring, delay: index * 0.04 }}
            className="grid grid-cols-1 border-b border-white/8 md:grid-cols-[0.7fr_1.3fr]"
          >
            <div className="flex items-center gap-4 border-b border-white/8 px-4 py-10 md:border-b-0 md:border-r md:px-8">
              <span className="inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-md bg-[#1c1c1f] ring-1 ring-white/8">
                {item.mark === "openai" ? (
                  <OpenAiLogo size={22} weight="regular" className="text-zinc-100" />
                ) : item.mark === "google" ? (
                  <GoogleLogo size={22} weight="regular" className="text-zinc-100" />
                ) : (
                  <img
                    src={item.mark}
                    alt=""
                    width={36}
                    height={36}
                    className="h-7 w-7 object-contain"
                  />
                )}
              </span>
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
