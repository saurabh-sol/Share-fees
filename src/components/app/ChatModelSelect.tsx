"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CaretUp } from "@phosphor-icons/react";
import { LLM_CATALOG, allLlmChoices } from "@/lib/gateway/catalog";
import type { LlmProvider } from "@/lib/gateway/catalog";
import { ProviderMark } from "./LlmModelPicker";

const spring = { type: "spring" as const, stiffness: 100, damping: 20 };
const CHOICES = allLlmChoices();

export function ChatModelSelect({
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
  const selected =
    CHOICES.find((item) => item.provider === provider && item.id === model) ?? CHOICES[0];
  const selectedIndex = Math.max(
    0,
    CHOICES.findIndex((item) => item.provider === selected.provider && item.id === selected.id),
  );

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
    <div ref={rootRef} className="relative w-[15.75rem] shrink-0">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Choose model"
        onClick={() => setOpen((value) => !value)}
        className="desk-glass-raised relative flex w-full items-center gap-2.5 border border-white/10 px-2.5 py-2 text-left transition-transform active:scale-[0.98]"
      >
        <span className="absolute inset-y-0 left-0 w-0.5 bg-accent" />
        <span className="pl-1 font-mono text-[10px] tabular-nums text-zinc-600">
          {String(selectedIndex + 1).padStart(2, "0")}
        </span>
        <ProviderMark provider={selected.provider} size={22} />
        <span className="min-w-0 flex-1 truncate text-sm text-zinc-100">{selected.label}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={spring} className="text-zinc-500">
          <CaretUp size={14} />
        </motion.span>
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            role="listbox"
            aria-label="All models"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={spring}
            className="desk-glass absolute bottom-[calc(100%+8px)] left-0 z-30 w-[min(24rem,calc(100vw-2rem))] border border-white/10"
          >
            <p className="flex items-center justify-between border-b border-white/8 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">
              <span>Models</span>
              <span className="tabular-nums text-zinc-600">
                {String(CHOICES.length).padStart(2, "0")}
              </span>
            </p>
            <div className="max-h-80 overflow-y-auto">
              {LLM_CATALOG.map((house) => (
                <div key={house.id}>
                  <p className="sticky top-0 border-b border-white/8 bg-background/80 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500 backdrop-blur-sm">
                    {house.label}
                  </p>
                  <ul>
                    {house.models.map((item) => {
                      const active = house.id === provider && item.id === model;
                      const index = CHOICES.findIndex(
                        (choice) => choice.provider === house.id && choice.id === item.id,
                      );
                      return (
                        <li key={`${house.id}:${item.id}`}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={active}
                            onClick={() => {
                              onChange({ provider: house.id, model: item.id });
                              setOpen(false);
                            }}
                            className={`relative flex w-full items-center gap-3 px-3 py-2.5 text-left ${
                              active ? "bg-white/[0.04]" : "hover:bg-white/[0.03]"
                            }`}
                          >
                            {active ? (
                              <span className="absolute inset-y-0 left-0 w-0.5 bg-accent" />
                            ) : null}
                            <span className="font-mono text-[10px] tabular-nums text-zinc-600">
                              {String(index + 1).padStart(2, "0")}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm text-zinc-100">{item.label}</span>
                              <span className="mt-0.5 block font-mono text-[10px] tabular-nums text-zinc-600">
                                ${item.inputPerMillion}/M in · ${item.outputPerMillion}/M out
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
