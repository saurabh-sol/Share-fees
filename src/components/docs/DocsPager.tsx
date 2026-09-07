import { ArrowLeft, ArrowRight } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { getDocsNeighbors } from "@/lib/docs/catalog";

export function DocsPager({ href }: { href: string }) {
  const { prev, next } = getDocsNeighbors(href);

  return (
    <nav
      aria-label="Docs pagination"
      className="mt-16 grid grid-cols-1 gap-4 border-t border-white/8 pt-8 md:grid-cols-2"
    >
      {prev ? (
        <Link
          href={prev.href}
          className="group border border-white/10 px-5 py-4 transition-colors hover:border-white/20"
        >
          <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">
            <ArrowLeft size={12} />
            Previous
          </p>
          <p className="mt-2 text-sm text-zinc-100 group-hover:text-zinc-50">{prev.title}</p>
        </Link>
      ) : (
        <div />
      )}
      {next ? (
        <Link
          href={next.href}
          className="group border border-white/10 px-5 py-4 text-right transition-colors hover:border-white/20"
        >
          <p className="flex items-center justify-end gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">
            Next
            <ArrowRight size={12} />
          </p>
          <p className="mt-2 text-sm text-zinc-100 group-hover:text-zinc-50">{next.title}</p>
        </Link>
      ) : null}
    </nav>
  );
}
