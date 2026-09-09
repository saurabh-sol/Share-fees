"use client";

import { useEffect, useState } from "react";
import { DEFAULT_LLM_MODEL, DEFAULT_LLM_PROVIDER, isLlmProvider, type LlmProvider } from "@/lib/gateway/catalog";
import {
  cacheVirtualKeyPlaintext,
  readCachedVirtualKeyPlaintext,
} from "@/lib/redeem/virtual-key-cache";
import { NotchedButton } from "@/components/ui/NotchedButton";
import { ProviderMark } from "./LlmModelPicker";
import { SecretKeyDisplay } from "./SecretKeyField";

export type VirtualKeyRow = {
  id: string;
  prefix: string;
  provider?: string | null;
  model?: string | null;
  status: string;
  remainingCents: number;
  spendCapCents: number;
};

type VirtualKeyListItemProps = {
  keyRow: VirtualKeyRow;
  money: (cents: number) => string;
  testing: boolean;
  working: boolean;
  /** Plaintext from the current redeem flow (before cache hydration). */
  plaintextOverride?: string | null;
  onToggleTest: () => void;
  onRevoke: () => void;
};

export function VirtualKeyListItem({
  keyRow,
  money,
  testing,
  working,
  plaintextOverride,
  onToggleTest,
  onRevoke,
}: VirtualKeyListItemProps) {
  const [cachedPlaintext, setCachedPlaintext] = useState<string | null>(null);
  const provider: LlmProvider =
    keyRow.provider && isLlmProvider(keyRow.provider) ? keyRow.provider : DEFAULT_LLM_PROVIDER;

  const plaintext =
    plaintextOverride && plaintextOverride.startsWith(keyRow.prefix)
      ? plaintextOverride
      : cachedPlaintext;

  useEffect(() => {
    const stored = readCachedVirtualKeyPlaintext(keyRow.prefix);
    setCachedPlaintext(stored);
  }, [keyRow.prefix]);

  useEffect(() => {
    if (plaintextOverride && plaintextOverride.startsWith(keyRow.prefix)) {
      cacheVirtualKeyPlaintext(keyRow.prefix, plaintextOverride);
      setCachedPlaintext(plaintextOverride);
    }
  }, [keyRow.prefix, plaintextOverride]);

  return (
    <li className="flex flex-col gap-3 py-4 md:flex-row md:items-start md:justify-between">
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex items-center gap-3">
          <ProviderMark provider={provider} size={28} />
          <div className="min-w-0">
            <p className="font-mono text-sm text-zinc-100">
              {plaintext ? "Your API key" : `${keyRow.prefix}…`}
            </p>
            <p className="font-mono text-xs text-zinc-500">
              {money(keyRow.remainingCents)} left of {money(keyRow.spendCapCents)} ·{" "}
              {keyRow.provider ?? "openai"} · {keyRow.model ?? DEFAULT_LLM_MODEL} · {keyRow.status}
            </p>
          </div>
        </div>
        {plaintext ? (
          <SecretKeyDisplay value={plaintext} defaultRevealed />
        ) : (
          <p className="text-xs leading-relaxed text-zinc-500">
            Plaintext is not stored on the server. If you did not copy this key when it was minted,
            revoke and redeem again to issue a new one.
          </p>
        )}
      </div>
      {keyRow.status === "active" ? (
        <div className="flex flex-wrap gap-2 md:pt-1">
          <NotchedButton variant="ghost" disabled={working} onClick={onToggleTest}>
            {testing ? "Close test" : "Test"}
          </NotchedButton>
          <NotchedButton variant="ghost" disabled={working} onClick={onRevoke}>
            Revoke
          </NotchedButton>
        </div>
      ) : null}
    </li>
  );
}

export function readCachedVirtualKey(prefix: string) {
  return readCachedVirtualKeyPlaintext(prefix);
}
