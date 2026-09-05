"use client";

import { CaretDown } from "@phosphor-icons/react";
import { useEffect, useId, useRef, useState } from "react";
import type { LifiToken } from "@/lib/lifi/http";
import { TokenIcon } from "./TokenIcon";

export function TokenSelect({
  label,
  tokens,
  value,
  onChange,
}: {
  label: string;
  tokens: LifiToken[];
  value: string;
  onChange: (address: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected =
    tokens.find((token) => token.address.toLowerCase() === value.toLowerCase()) ?? tokens[0];

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

  return (
    <label className="block space-y-2">
      <span className="text-sm text-zinc-400">{label}</span>
      <div ref={rootRef} className="relative">
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((current) => !current)}
          className="flex w-full items-center gap-2 border border-white/10 bg-[#141416] px-3 py-2 text-left outline-none focus:border-[#c23a3a]"
        >
          {selected ? (
            <>
              <TokenIcon symbol={selected.symbol} logoURI={selected.logoURI} />
              <span className="min-w-0 flex-1 truncate font-mono text-sm text-zinc-100">
                {selected.symbol}
              </span>
              <span className="hidden truncate text-xs text-zinc-500 sm:inline">{selected.name}</span>
            </>
          ) : (
            <span className="font-mono text-sm text-zinc-500">No tokens</span>
          )}
          <CaretDown size={14} className="shrink-0 text-zinc-500" />
        </button>
        {open ? (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto border border-white/10 bg-[#141416]"
          >
            {tokens.map((token) => {
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
          </ul>
        ) : null}
      </div>
    </label>
  );
}
