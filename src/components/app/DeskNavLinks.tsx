"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type DeskNavItem = {
  href: string;
  label: string;
  /** Match only the exact path (for index routes like /app). */
  exact?: boolean;
  /** Locked items are not clickable; hover shows the coming-soon hint. */
  locked?: boolean;
  lockHint?: string;
};

export function DeskNavLinks({ items }: { items: DeskNavItem[] }) {
  const pathname = usePathname();

  return (
    <>
      {items.map((item) => {
        if (item.locked) {
          return (
            <span
              key={item.href}
              className="group relative shrink-0 cursor-not-allowed text-zinc-600"
            >
              {item.label}
              <span
                role="tooltip"
                className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 w-max -translate-x-1/2 border border-white/12 bg-background px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-200 opacity-0 shadow-[0_8px_24px_rgba(0,0,0,0.45)] transition-opacity duration-150 group-hover:opacity-100"
              >
                {item.lockHint ?? "This feature will be live soon"}
              </span>
            </span>
          );
        }

        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "shrink-0 text-zinc-100 underline decoration-accent decoration-2 underline-offset-8"
                : "shrink-0 text-zinc-400 transition-colors hover:text-zinc-100"
            }
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );
}
