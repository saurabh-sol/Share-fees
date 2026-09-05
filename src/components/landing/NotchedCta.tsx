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
      className="group relative inline-flex items-center justify-center bg-[#c23a3a] px-7 py-3 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-50 transition-colors hover:bg-[#9f2f2f] active:scale-[0.98]"
    >
      <span className="absolute -left-1.5 top-1/2 h-3 w-1.5 -translate-y-1/2 bg-[#c23a3a] group-hover:bg-[#9f2f2f]" />
      <span className="absolute -right-1.5 top-1/2 h-3 w-1.5 -translate-y-1/2 bg-[#c23a3a] group-hover:bg-[#9f2f2f]" />
      {children}
    </Link>
  );
}
