"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DOCS_GROUPS } from "@/lib/docs/catalog";

export function DocsSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Documentation" className="space-y-8">
      {DOCS_GROUPS.map((group) => (
        <div key={group.title}>
          <p className="px-3 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">{group.title}</p>
          <ul className="mt-3 space-y-0.5">
            {group.items.map((item) => {
              const active = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={
                      active
                        ? "block border-l-2 border-accent bg-accent/[0.06] px-3 py-1.5 text-sm text-zinc-100"
                        : "block border-l-2 border-transparent px-3 py-1.5 text-sm text-zinc-400 transition-colors hover:border-white/20 hover:text-zinc-100"
                    }
                  >
                    {item.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
