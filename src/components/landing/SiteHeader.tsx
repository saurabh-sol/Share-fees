import Link from "next/link";

export function SiteHeader({ ctaHref = "/login", ctaLabel = "Connect wallet" }: {
  ctaHref?: string;
  ctaLabel?: string;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-white/8 bg-[#141416]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-4 md:px-8">
        <Link href="/" className="flex items-baseline gap-3">
          <span className="font-mono text-xs tracking-[0.22em] text-[#c23a3a]">T2C</span>
          <span className="text-sm tracking-tight text-zinc-100">Trade2Credits</span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-zinc-400 md:flex">
          <a href="#mechanics" className="hover:text-zinc-100">
            Mechanics
          </a>
          <a href="#rails" className="hover:text-zinc-100">
            Rails
          </a>
          <Link href="/login" className="hover:text-zinc-100">
            Login
          </Link>
        </nav>
        <Link
          href={ctaHref}
          className="rounded-full bg-[#c23a3a] px-4 py-2 text-sm text-zinc-50 transition-transform active:scale-[0.98] hover:bg-[#9f2f2f]"
        >
          {ctaLabel}
        </Link>
      </div>
    </header>
  );
}
