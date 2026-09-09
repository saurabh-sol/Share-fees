"use client";

import { useState } from "react";
import { CaretDown } from "@phosphor-icons/react";
import { ApiKeyTryPanel } from "@/components/app/ApiKeyTryPanel";
import type { LlmProvider } from "@/lib/gateway/catalog";

export type TryApiKeyOption = {
  id: string;
  label: string;
  provider: LlmProvider;
  model: string;
};

export function TryApiKeyPicker({
  options,
  initialProvider,
  initialModel,
}: {
  options: TryApiKeyOption[];
  initialProvider: LlmProvider;
  initialModel: string;
}) {
  const [selectedId, setSelectedId] = useState(options[0]?.id ?? "");
  const selected = options.find((item) => item.id === selectedId);

  return (
    <div className="space-y-6">
      {options.length > 0 ? (
        <label className="block max-w-2xl space-y-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">
            Match settings from my key
          </span>
          <div className="relative">
            <select
              value={selectedId}
              onChange={(event) => setSelectedId(event.target.value)}
              className="w-full appearance-none border border-white/10 bg-transparent px-3 py-2.5 pr-9 font-mono text-sm text-zinc-100 outline-none focus:border-accent"
            >
              {options.map((item) => (
                <option key={item.id} value={item.id} className="bg-background">
                  {item.label}
                </option>
              ))}
            </select>
            <CaretDown
              size={14}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500"
            />
          </div>
          <span className="block text-xs text-zinc-500">
            This sets provider and model. You still paste the full acc_ key below.
          </span>
        </label>
      ) : (
        <p className="max-w-2xl text-sm text-zinc-400">
          No active keys yet. Redeem LLM credits first, then come back here to test.
        </p>
      )}

      <ApiKeyTryPanel
        key={selectedId || "manual"}
        initialProvider={selected?.provider ?? initialProvider}
        initialModel={selected?.model ?? initialModel}
        lockProviderModel={Boolean(selected)}
        title="Run a live test"
      />
    </div>
  );
}
