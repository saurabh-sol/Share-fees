import Link from "next/link";
import { USDG_REWARD_VAULT, robinhoodAddressUrl } from "@/lib/chains/robinhood";
import { NotchedCta } from "../NotchedCta";
import { FooterField } from "./FooterField";
import { FooterNav } from "./FooterNav";
import { FooterTape } from "./FooterTape";
import { SocialButtons } from "./SocialButtons";

function Mark() {
  return (
    <span className="grid grid-cols-4 gap-px" aria-hidden>
      <span className="h-1.5 w-1.5 bg-accent" />
      <span className="h-1.5 w-1.5 bg-accent" />
      <span className="h-1.5 w-1.5 bg-accent-press" />
      <span className="h-1.5 w-1.5 bg-accent" />
    </span>
  );
}

function FooterBrand() {
  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent">[12] Close</p>
      <Link href="/" className="mt-5 inline-flex items-center gap-3">
        <Mark />
        <span className="font-mono text-xs tracking-[0.22em] text-zinc-100">Trade2Credits</span>
      </Link>
      <h2 className="mt-8 max-w-[10ch] text-4xl tracking-tighter leading-none text-zinc-100 md:text-5xl">
        You swap. We credit.
      </h2>
      <p className="mt-5 max-w-[46ch] text-base leading-relaxed text-zinc-400">
        Qualifying $250+ fills convert at 50 bps. Take USDG to the same wallet, or LLM credits for Claude, OpenAI,
        DeepSeek, Google, and Grok-compatible clients.
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-4">
        <NotchedCta href="/login">Connect wallet</NotchedCta>
        <a
          href={robinhoodAddressUrl(USDG_REWARD_VAULT)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center border border-white/12 px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-200 transition-colors hover:border-accent hover:text-accent focus-visible:border-accent focus-visible:outline-none active:scale-[0.98]"
        >
          Contract
        </a>
      </div>
      <div className="mt-10">
        <SocialButtons />
      </div>
    </div>
  );
}

function FooterBottom() {
  return (
    <div className="border-t border-white/8">
      <div className="mx-auto flex max-w-[1400px] flex-col items-start justify-between gap-3 px-4 py-5 font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500 md:flex-row md:items-center md:px-8">
        <p>© 2026 Trade2Credits. All rights reserved.</p>
        <p className="text-zinc-300">
          <span className="text-accent">+</span> Built for qualifying fills{" "}
          <span className="text-accent">+</span>
        </p>
        <a
          href={robinhoodAddressUrl(USDG_REWARD_VAULT)}
          target="_blank"
          rel="noreferrer"
          className="text-zinc-300 underline-offset-4 hover:text-zinc-50 hover:underline"
        >
          Contract
        </a>
      </div>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="relative isolate overflow-hidden border-t border-white/8 bg-background">
      <FooterField />
      <div className="relative z-10 mx-auto grid max-w-[1400px] grid-cols-1 gap-12 px-4 py-16 md:grid-cols-2 md:px-8 md:py-20 lg:grid-cols-[1.1fr_0.95fr_0.85fr] lg:items-start lg:gap-16">
        <FooterBrand />
        <FooterNav />
        <div className="md:col-span-2 lg:col-span-1">
          <FooterTape />
        </div>
      </div>
      <div className="relative z-10">
        <FooterBottom />
      </div>
    </footer>
  );
}

export { FooterNav as FooterNavigation };
