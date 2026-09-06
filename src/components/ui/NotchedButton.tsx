"use client";

import type { ReactNode } from "react";

/**
 * Unified desk CTA. Same visual language as the landing NotchedCta:
 * sharp corners, mono uppercase label, side notches on the primary variant.
 * Secondary is a ghost with a 1px hairline (no fill, no notches).
 */
export function NotchedButton({
  children,
  variant = "primary",
  type = "button",
  disabled = false,
  onClick,
}: {
  children: ReactNode;
  variant?: "primary" | "ghost";
  type?: "button" | "submit";
  disabled?: boolean;
  onClick?: () => void;
}) {
  if (variant === "ghost") {
    return (
      <button
        type={type}
        disabled={disabled}
        onClick={onClick}
        className="inline-flex items-center justify-center border border-white/12 px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-200 transition-colors hover:border-white/25 hover:text-zinc-50 active:scale-[0.98] disabled:opacity-40"
      >
        {children}
      </button>
    );
  }

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className="group relative inline-flex items-center justify-center bg-accent px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-50 transition-colors hover:bg-accent-press active:scale-[0.98] disabled:opacity-40 disabled:hover:bg-accent"
    >
      <span
        aria-hidden
        className="absolute -left-1.5 top-1/2 h-3 w-1.5 -translate-y-1/2 bg-accent group-hover:bg-accent-press group-disabled:group-hover:bg-accent"
      />
      <span
        aria-hidden
        className="absolute -right-1.5 top-1/2 h-3 w-1.5 -translate-y-1/2 bg-accent group-hover:bg-accent-press group-disabled:group-hover:bg-accent"
      />
      {children}
    </button>
  );
}
