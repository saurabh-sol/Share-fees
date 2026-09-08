import Link from "next/link";
import { BRAND_LOGO_PATH, BRAND_NAME } from "@/lib/brand";

const LOGO_SIZES = {
  sm: 20,
  md: 24,
  lg: 36,
} as const;

export function BrandMark({
  href = "/",
  suffix,
  suffixHref,
  tone = "light",
  size = "md",
  className = "",
}: {
  /** Home link for logo + name (default `/`). */
  href?: string;
  suffix?: string;
  /** When set, suffix is its own link (e.g. Desk → `/app`). */
  suffixHref?: string;
  tone?: "light" | "accent";
  size?: keyof typeof LOGO_SIZES;
  className?: string;
}) {
  const logoPx = LOGO_SIZES[size];
  const textClass = tone === "accent" ? "text-accent" : "text-zinc-100";

  const mark = (
    <>
      <img
        src={BRAND_LOGO_PATH}
        alt=""
        width={logoPx}
        height={logoPx}
        className="block shrink-0"
        decoding="async"
      />
      <span
        className={`font-mono text-[10px] tracking-[0.16em] sm:text-xs sm:tracking-[0.22em] ${textClass}`}
      >
        {BRAND_NAME}
      </span>
    </>
  );

  const suffixNode = suffix ? (
    suffixHref ? (
      <Link
        href={suffixHref}
        className="hidden font-mono text-sm tracking-normal text-zinc-200 hover:text-zinc-50 sm:inline"
      >
        {suffix}
      </Link>
    ) : (
      <span className="hidden font-mono text-sm tracking-normal text-zinc-200 sm:inline">{suffix}</span>
    )
  ) : null;

  return (
    <span className={`inline-flex items-center gap-2.5 sm:gap-3 ${className}`}>
      {href ? (
        <Link href={href} className="inline-flex items-center gap-2.5 sm:gap-3">
          {mark}
        </Link>
      ) : (
        <span className="inline-flex items-center gap-2.5 sm:gap-3">{mark}</span>
      )}
      {suffixNode}
    </span>
  );
}
