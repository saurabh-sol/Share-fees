import Link from "next/link";

/**
 * Structured empty state for desk lists. Corner-marked hairline frame
 * (same language as ErrorScreen), mono eyebrow, one-line explanation,
 * and a single primary action.
 */
export function EmptyState({
  eyebrow,
  title,
  body,
  ctaHref,
  ctaLabel,
}: {
  eyebrow: string;
  title: string;
  body: string;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  return (
    <div className="relative border border-white/10 bg-raised/40 px-6 py-10 md:px-10">
      <span aria-hidden className="absolute -left-px -top-px h-3 w-3 border-l border-t border-accent" />
      <span aria-hidden className="absolute -right-px -top-px h-3 w-3 border-r border-t border-accent" />
      <span aria-hidden className="absolute -bottom-px -left-px h-3 w-3 border-b border-l border-accent" />
      <span aria-hidden className="absolute -bottom-px -right-px h-3 w-3 border-b border-r border-accent" />
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">{eyebrow}</p>
      <p className="mt-3 text-xl tracking-tight text-zinc-100">{title}</p>
      <p className="mt-2 max-w-[52ch] text-sm leading-relaxed text-zinc-400">{body}</p>
      {ctaHref && ctaLabel ? (
        <Link
          href={ctaHref}
          className="mt-6 inline-flex items-center justify-center bg-accent px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-50 transition-colors hover:bg-accent-press active:scale-[0.98]"
        >
          {ctaLabel}
        </Link>
      ) : null}
    </div>
  );
}
