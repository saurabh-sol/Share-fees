import Link from "next/link";
import { NotchedCta } from "./NotchedCta";

export function SiteHeader({
  ctaHref = "/login",
  ctaLabel = "Get started",
}: {
  ctaHref?: string;
  ctaLabel?: string;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-white/8 bg-[#141416]/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-4 md:px-8">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid grid-cols-4 gap-px" aria-hidden>
            <span className="h-1.5 w-1.5 bg-[#c23a3a]" />
            <span className="h-1.5 w-1.5 bg-[#c23a3a]" />
            <span className="h-1.5 w-1.5 bg-[#9f2f2f]" />
            <span className="h-1.5 w-1.5 bg-[#c23a3a]" />
          </span>
          <span className="font-mono text-xs tracking-[0.22em] text-zinc-100">Trade2Credits</span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-zinc-400 md:flex">
          <a href="#mechanics" className="hover:text-zinc-100">
            How it pays
          </a>
          <a href="#rails" className="hover:text-zinc-100">
            Rails
          </a>
          <a href="#account" className="hover:text-zinc-100">
            Account
          </a>
        </nav>
        <div className="flex items-center gap-5">
          <Link href="/login" className="hidden font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-300 md:inline">
            Sign in
          </Link>
          <NotchedCta href={ctaHref}>{ctaLabel}</NotchedCta>
        </div>
      </div>
    </header>
  );
}
