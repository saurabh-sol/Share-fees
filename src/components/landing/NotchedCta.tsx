import Link from "next/link";

export function NotchedCta({
  href,
  children,
}: {
  href: string;
  children: string;
}) {
  return (
    <Link
      href={href}
      className="group relative inline-flex items-center justify-center bg-accent px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-50 transition-colors hover:bg-accent-press active:scale-[0.98] sm:px-7 sm:py-3"
    >
      <span className="absolute -left-1.5 top-1/2 h-3 w-1.5 -translate-y-1/2 bg-accent group-hover:bg-accent-press" />
      <span className="absolute -right-1.5 top-1/2 h-3 w-1.5 -translate-y-1/2 bg-accent group-hover:bg-accent-press" />
      {children}
    </Link>
  );
}
