"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type DeskNavItem = {
  href: string;
  label: string;
  /** Match only the exact path (for index routes like /app). */
  exact?: boolean;
};

export function DeskNavLinks({ items }: { items: DeskNavItem[] }) {
  const pathname = usePathname();

  return (
    <>
      {items.map((item) => {
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
