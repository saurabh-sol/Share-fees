import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";

export function BrandMark({
  href = "/",
  tone = "light",
  suffix,
  className = "",
}: {
  href?: string;
  tone?: "light" | "accent";
  suffix?: string;
  className?: string;
}) {
  const textClass = tone === "accent" ? "text-accent" : "text-zinc-100";
  const content = (
    <>
      <span className="grid shrink-0 grid-cols-4 gap-px" aria-hidden>
        <span className="h-1.5 w-1.5 bg-accent" />
        <span className="h-1.5 w-1.5 bg-accent" />
        <span className="h-1.5 w-1.5 bg-accent-press" />
        <span className="h-1.5 w-1.5 bg-accent" />
      </span>
      <span
        className={`font-mono text-[10px] tracking-[0.16em] sm:text-xs sm:tracking-[0.22em] ${textClass}`}
      >
        {BRAND_NAME}
      </span>
      {suffix ? (
        <span className="hidden font-mono text-sm tracking-normal text-zinc-200 sm:inline">{suffix}</span>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={`inline-flex items-center gap-2.5 sm:gap-3 ${className}`}>
        {content}
      </Link>
    );
  }

  return <span className={`inline-flex items-center gap-2.5 sm:gap-3 ${className}`}>{content}</span>;
}
