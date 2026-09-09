"use client";

import { CaretDown, MagnifyingGlass, SpinnerGap } from "@phosphor-icons/react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { LifiToken } from "@/lib/lifi/http";
import { TokenIcon } from "./TokenIcon";

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export function TokenSelect({
  label,
  tokens,
  value,
  onChange,
  onImportToken,
  compact = false,
}: {
  label: string;
  tokens: LifiToken[];
  value: string;
  onChange: (address: string) => void;
  /** Called when user pastes a contract address that isn't in the list and we resolve it on-chain. */
  onImportToken?: (token: LifiToken) => void;
  /** Sit beside an amount field instead of taking a full labeled column. */
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const selected =
    tokens.find((t) => t.address.toLowerCase() === value.toLowerCase()) ?? tokens[0];

  // Filter tokens by query (symbol, name, or address match).
  const q = query.trim().toLowerCase();
  const filtered = q
    ? tokens.filter(
        (t) =>
          t.symbol.toLowerCase().includes(q) ||
          t.name.toLowerCase().includes(q) ||
          t.address.toLowerCase().includes(q),
      )
    : tokens;

  const isAddressQuery = ADDRESS_RE.test(query.trim());
  const addressAlreadyListed =
    isAddressQuery && tokens.some((t) => t.address.toLowerCase() === query.trim().toLowerCase());

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Auto-focus search when dropdown opens.
  useEffect(() => {
    if (open) {
      setQuery("");
      setResolveError(null);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const resolveAddress = useCallback(
    async (address: string) => {
      if (!onImportToken) return;
      setResolving(true);
      setResolveError(null);
      try {
        const resp = await fetch(`/api/v1/swaps/resolve?address=${encodeURIComponent(address)}`, {
          credentials: "include",
        });
        const data = (await resp.json()) as { token?: LifiToken; message?: string };
        if (!resp.ok) {
          setResolveError(data.message ?? "Could not resolve token.");
          return;
        }
        if (data.token) {
          onImportToken(data.token);
          onChange(data.token.address);
          setOpen(false);
        }
      } catch {
        setResolveError("Network error resolving token.");
      } finally {
        setResolving(false);
      }
    },
    [onImportToken, onChange],
  );

  const shell = (
      <div ref={rootRef} className="relative">
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          aria-label={label}
          onClick={() => setOpen((current) => !current)}
          className={
            compact
              ? "flex shrink-0 items-center gap-2 border border-white/10 bg-raised px-2.5 py-1.5 text-left outline-none focus:border-accent"
              : "flex w-full items-center gap-2 border border-white/10 bg-background px-3 py-2 text-left outline-none focus:border-accent"
          }
        >
          {selected ? (
            <>
              <TokenIcon symbol={selected.symbol} logoURI={selected.logoURI} />
              <span className={`min-w-0 truncate font-mono text-sm text-zinc-100 ${compact ? "max-w-[5.5rem]" : "flex-1"}`}>
                {selected.symbol}
              </span>
              {compact ? null : (
                <span className="hidden truncate text-xs text-zinc-500 sm:inline">{selected.name}</span>
              )}
            </>
          ) : (
            <span className="font-mono text-sm text-zinc-500">No tokens</span>
          )}
          <CaretDown size={14} className="shrink-0 text-zinc-500" />
        </button>

        {open ? (
          <div
            className={`absolute z-20 mt-1 border border-white/10 bg-background ${
              compact ? "right-0 w-[min(20rem,calc(100vw-2rem))]" : "w-full"
            }`}
          >
            {/* Search input */}
            <div className="flex items-center gap-2 border-b border-white/8 px-3 py-2">
              <MagnifyingGlass size={14} className="shrink-0 text-zinc-500" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name or paste address"
                className="w-full bg-transparent font-mono text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
              />
            </div>

            {/* Token list */}
            <ul
              id={listId}
              role="listbox"
              className="max-h-64 overflow-y-auto"
            >
              {filtered.map((token) => {
                const active = token.address.toLowerCase() === value.toLowerCase();
                return (
                  <li key={`${token.chainId}-${token.address}`}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => {
                        onChange(token.address);
                        setOpen(false);
                      }}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left ${
                        active ? "bg-white/6" : "hover:bg-white/4"
                      }`}
                    >
                      <TokenIcon symbol={token.symbol} logoURI={token.logoURI} />
                      <span className="font-mono text-sm text-zinc-100">{token.symbol}</span>
                      <span className="truncate text-xs text-zinc-500">{token.name}</span>
                    </button>
                  </li>
                );
              })}

              {/* No results */}
              {filtered.length === 0 && !isAddressQuery ? (
                <li className="px-3 py-3 text-center font-mono text-xs text-zinc-500">
                  No tokens match &ldquo;{query}&rdquo;
                </li>
              ) : null}

              {/* Contract address import */}
              {isAddressQuery && !addressAlreadyListed ? (
                <li className="border-t border-white/8">
                  <button
                    type="button"
                    disabled={resolving}
                    onClick={() => void resolveAddress(query.trim())}
                    className="flex w-full items-center gap-2 px-3 py-3 text-left hover:bg-white/4 disabled:opacity-50"
                  >
                    {resolving ? (
                      <SpinnerGap size={14} className="shrink-0 animate-spin text-accent" />
                    ) : (
                      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center bg-raised font-mono text-[10px] text-zinc-400">
                        ?
                      </span>
                    )}
                    <span className="font-mono text-sm text-zinc-300">
                      {resolving ? "Resolving…" : "Import token from contract"}
                    </span>
                  </button>
                  {resolveError ? (
                    <p className="px-3 pb-2 font-mono text-xs text-accent">{resolveError}</p>
                  ) : null}
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}
      </div>
  );

  if (compact) return shell;

  return (
    <label className="block space-y-2">
      <span className="text-sm text-zinc-400">{label}</span>
      {shell}
    </label>
  );
}
