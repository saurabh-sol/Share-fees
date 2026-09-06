"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CaretDown, Check } from "@phosphor-icons/react";
import {
  LLM_CATALOG,
  modelsForProvider,
  type LlmProvider,
} from "@/lib/gateway/catalog";

const spring = { type: "spring" as const, stiffness: 100, damping: 20 };

const PROVIDER_MARK: Record<
  LlmProvider,
  { src: string; invert?: boolean; tile: string }
> = {
  anthropic: { src: "/claude.png", tile: "bg-[#141416]" },
  openai: { src: "/openai.png", invert: true, tile: "bg-white" },
  deepseek: { src: "/deepseek.png", tile: "bg-[#141416]" },
};

export function ProviderMark({
  provider,
  size = 28,
}: {
  provider: LlmProvider;
  size?: number;
}) {
  const mark = PROVIDER_MARK[provider];
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md ring-1 ring-white/8 ${mark.tile}`}
      style={{ width: size, height: size }}
    >
      <img
        src={mark.src}
        alt=""
        width={size}
        height={size}
        className={`h-full w-full object-contain ${mark.invert ? "invert" : ""}`}
      />
    </span>
  );
}

export function LlmModelPicker({
  provider,
  model,
  onChange,
}: {
  provider: LlmProvider;
  model: string;
  onChange: (next: { provider: LlmProvider; model: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedProvider = LLM_CATALOG.find((item) => item.id === provider) ?? LLM_CATALOG[0];
  const selectedModel =
    modelsForProvider(provider).find((item) => item.id === model) ?? modelsForProvider(provider)[0];

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div ref={rootRef} className="relative">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">Model</p>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="mt-3 flex w-full items-center gap-3 border border-white/8 bg-[#1c1c1f] px-3 py-2.5 text-left transition-transform active:scale-[0.98]"
      >
        <ProviderMark provider={provider} size={32} />
        <span className="min-w-0 flex-1">
          <span className="block font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">
            {selectedProvider.label}
          </span>
          <span className="mt-0.5 block truncate text-sm text-zinc-100">{selectedModel?.label}</span>
        </span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={spring} className="text-zinc-500">
          <CaretDown size={16} />
        </motion.span>
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={spring}
            className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 overflow-hidden border border-white/8 bg-[#1c1c1f] shadow-[0_18px_40px_rgba(0,0,0,0.45)]"
          >
            <div className="grid grid-cols-1 sm:grid-cols-[7.5rem_1fr] md:grid-cols-[9.5rem_1fr]">
              <div className="border-b border-white/8 sm:border-b-0 sm:border-r">
                {LLM_CATALOG.map((item) => {
                  const active = item.id === provider;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        const first = item.models[0];
                        onChange({ provider: item.id, model: first?.id ?? model });
                      }}
                      className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
                        active ? "bg-white/[0.04] text-zinc-100" : "text-zinc-400 hover:bg-white/[0.03] hover:text-zinc-200"
                      }`}
                    >
                      <ProviderMark provider={item.id} size={22} />
                      <span className="truncate text-xs">{item.label}</span>
                    </button>
                  );
                })}
              </div>
              <div>
                {modelsForProvider(provider).map((item) => {
                  const active = item.id === model;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        onChange({ provider, model: item.id });
                        setOpen(false);
                      }}
                      className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors ${
                        active ? "bg-white/[0.04]" : "hover:bg-white/[0.03]"
                      }`}
                    >
                      <span>
                        <span className="block text-sm text-zinc-100">{item.label}</span>
                        <span className="mt-0.5 block font-mono text-[10px] tabular-nums text-zinc-500">
                          ${item.inputPerMillion}/M in · ${item.outputPerMillion}/M out
                        </span>
                      </span>
                      {active ? <Check size={16} className="text-[#c23a3a]" /> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
