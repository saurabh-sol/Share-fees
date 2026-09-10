import Link from "next/link";
import { BrandMark } from "@/components/brand/BrandMark";
import { BRAND_NAME } from "@/lib/brand";
import { USDG_REWARD_VAULT, robinhoodAddressUrl } from "@/lib/chains/robinhood";
import { NotchedCta } from "../NotchedCta";
import { FooterField } from "./FooterField";
import { FooterNav } from "./FooterNav";
import { FooterTape } from "./FooterTape";
import { SocialButtons } from "./SocialButtons";

function FooterBrand() {
  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent">[12] Close</p>
      <div className="mt-5">
        <BrandMark size="lg" />
      </div>
      <h2 className="mt-8 max-w-[14ch] text-4xl tracking-tighter leading-none text-zinc-100 md:text-5xl">
        Same wallet. Same session.
      </h2>
      <p className="mt-5 max-w-[46ch] text-base leading-relaxed text-zinc-400">
        Sign in once. Swap, claim, convert, and redeem from one desk address. USDG pays on Robinhood Chain.
        LLM keys meter usage until the cap is spent.
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-4">
        <NotchedCta href="/login">Open the desk</NotchedCta>
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
        <p>© 2026 {BRAND_NAME}. All rights reserved.</p>
        <p className="text-zinc-300">
          <span className="text-accent">+</span> Built for qualifying fills{" "}
          <span className="text-accent">+</span>
        </p>
        <div className="flex gap-4">
          <Link href="/privacy" className="text-zinc-300 underline-offset-4 hover:text-zinc-50 hover:underline">
            Privacy
          </Link>
          <Link href="/terms" className="text-zinc-300 underline-offset-4 hover:text-zinc-50 hover:underline">
            Terms
          </Link>
          <a
            href="https://dune.com/accrued/accrued"
            target="_blank"
            rel="noreferrer"
            className="text-zinc-300 underline-offset-4 hover:text-zinc-50 hover:underline"
          >
            Analytics
          </a>
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
