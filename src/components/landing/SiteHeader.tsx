import Link from "next/link";
import { BRAND_NAME, BRAND_SHORT } from "@/lib/brand";
import { NotchedCta } from "./NotchedCta";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-white/8 bg-background/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-4 md:px-8">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid grid-cols-4 gap-px" aria-hidden>
            <span className="h-1.5 w-1.5 bg-accent" />
            <span className="h-1.5 w-1.5 bg-accent" />
            <span className="h-1.5 w-1.5 bg-accent-press" />
            <span className="h-1.5 w-1.5 bg-accent" />
          </span>
          <span className="font-mono text-xs tracking-[0.22em] text-zinc-100">
            <span className="sm:hidden">{BRAND_SHORT}</span>
            <span className="hidden sm:inline">{BRAND_NAME}</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-zinc-400 md:flex">
          <a href="#mechanics" className="hover:text-zinc-100">
            How it pays
          </a>
          <a href="#desk" className="hover:text-zinc-100">
            Desk
          </a>
          <a href="#api" className="hover:text-zinc-100">
            API
          </a>
          <Link href="/docs" className="hover:text-zinc-100">
            Docs
          </Link>
          <a href="#faq" className="hover:text-zinc-100">
            FAQ
          </a>
        </nav>
        <div className="flex items-center gap-3 sm:gap-5">
          <NotchedCta href="/login">Connect wallet</NotchedCta>
        </div>
      </div>
      <nav className="flex gap-5 overflow-x-auto border-t border-white/8 px-4 py-2.5 text-sm text-zinc-400 md:hidden">
        <a href="#mechanics" className="shrink-0 hover:text-zinc-100">
          How it pays
        </a>
        <a href="#desk" className="shrink-0 hover:text-zinc-100">
          Desk
        </a>
        <a href="#api" className="shrink-0 hover:text-zinc-100">
          API
        </a>
        <Link href="/docs" className="shrink-0 hover:text-zinc-100">
          Docs
        </Link>
        <a href="#faq" className="shrink-0 hover:text-zinc-100">
          FAQ
        </a>
      </nav>
    </header>
  );
}
