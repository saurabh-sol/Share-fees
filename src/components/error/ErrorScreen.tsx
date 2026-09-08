import Link from "next/link";
import { BrandMark } from "@/components/brand/BrandMark";
import { PixelErrorArt } from "./PixelErrorArt";

export function ErrorScreen({
  code = "404",
  title,
  body,
  retryLabel,
  onRetry,
}: {
  code?: string;
  title: string;
  body: string;
  retryLabel?: string;
  onRetry?: () => void;
}) {
  return (
    <main className="relative min-h-[100dvh] overflow-x-clip bg-background px-4 py-10 md:px-8 md:py-16">
      <div className="mx-auto mb-10 max-w-[1400px]">
        <BrandMark />
      </div>
      <div className="mx-auto grid min-h-[calc(100dvh-8rem)] max-w-[1400px] grid-cols-1 items-center gap-10 lg:grid-cols-[0.95fr_1.05fr]">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent">[{code}]</p>
          <h1 className="mt-5 max-w-[12ch] text-4xl tracking-tighter leading-none text-zinc-100 sm:text-5xl md:text-6xl">
            {title}
          </h1>
          <p className="mt-5 max-w-[54ch] text-base leading-relaxed text-zinc-400">{body}</p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            {onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className="bg-accent px-6 py-3 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-50 transition-colors hover:bg-accent-press active:scale-[0.98]"
              >
                {retryLabel ?? "Try again"}
              </button>
            ) : null}
            <Link
              href="/"
              className="border border-white/12 px-6 py-3 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-200 active:scale-[0.98]"
            >
              Home
            </Link>
          </div>
        </div>
        <figure className="relative border border-white/10 bg-raised/40 p-3 sm:p-5">
          <span className="absolute -left-px -top-px h-3 w-3 border-l border-t border-accent" />
          <span className="absolute -right-px -top-px h-3 w-3 border-r border-t border-accent" />
          <span className="absolute -bottom-px -left-px h-3 w-3 border-b border-l border-accent" />
          <span className="absolute -bottom-px -right-px h-3 w-3 border-b border-r border-accent" />
          <div>
            <PixelErrorArt label={code} />
          </div>
          <figcaption className="mt-4 flex items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
            <span>Pixel field</span>
            <span className="tabular-nums text-accent">{code}</span>
          </figcaption>
        </figure>
      </div>
    </main>
  );
}
