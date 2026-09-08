"use client";

import Link from "next/link";
import { PeekAccountButton } from "./PeekAccountButton";

export function HeroCtaRow() {
  return (
    <div className="mt-10 flex flex-wrap items-center gap-4">
      <PeekAccountButton href="#mechanics" label="Get started" />
      <Link
        href="/docs/how-it-pays"
        className="inline-flex items-center justify-center border border-white/12 px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-200 transition-colors hover:border-white/25 hover:text-zinc-50 active:scale-[0.98]"
      >
        How it pays
      </Link>
    </div>
  );
}
