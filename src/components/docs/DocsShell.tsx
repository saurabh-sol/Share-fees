"use client";

import { List, X } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { getDocsPage } from "@/lib/docs/catalog";
import { DocsSearch } from "./DocsSearch";
import { DocsSidebar } from "./DocsSidebar";
import { DocsToc } from "./DocsToc";

const spring = { type: "spring" as const, stiffness: 100, damping: 20 };

export function DocsShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const page = getDocsPage(pathname);
  const [menuForPath, setMenuForPath] = useState<string | null>(null);
  const menuOpen = menuForPath === pathname;

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="sticky top-0 z-30 border-b border-white/8 bg-background/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-4 px-4 md:px-8">
          <Link href="/" className="flex shrink-0 items-center gap-3">
            <span className="grid grid-cols-4 gap-px" aria-hidden>
              <span className="h-1.5 w-1.5 bg-accent" />
              <span className="h-1.5 w-1.5 bg-accent" />
              <span className="h-1.5 w-1.5 bg-accent-press" />
              <span className="h-1.5 w-1.5 bg-accent" />
            </span>
            <span className="font-mono text-xs tracking-[0.22em] text-zinc-100">
              <span className="sm:hidden">T2C</span>
              <span className="hidden sm:inline">Trade2Credits</span>
            </span>
          </Link>
          <span className="hidden font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-600 md:inline">
            Docs
          </span>
          <div className="ml-auto hidden flex-1 justify-center md:flex">
            <DocsSearch />
          </div>
          <div className="ml-auto flex items-center gap-3 md:ml-0">
            <Link
              href="/login"
              className="hidden font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-300 md:inline"
            >
              Sign in
            </Link>
            <Link
              href="/app"
              className="bg-accent px-3 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-50 transition-colors hover:bg-accent-press active:scale-[0.98]"
            >
              Open desk
            </Link>
            <button
              type="button"
              className="inline-flex size-9 items-center justify-center border border-white/10 text-zinc-300 md:hidden"
              aria-label={menuOpen ? "Close docs menu" : "Open docs menu"}
              onClick={() => setMenuForPath(menuOpen ? null : pathname)}
            >
              {menuOpen ? <X size={16} /> : <List size={16} />}
            </button>
          </div>
        </div>
        <div className="border-t border-white/8 px-4 py-2 md:hidden">
          <DocsSearch />
        </div>
      </header>

      <AnimatePresence>
        {menuOpen ? (
          <motion.div
            className="fixed inset-0 z-20 bg-background/70 pt-14 backdrop-blur-sm md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={spring}
            onClick={() => setMenuForPath(null)}
          >
            <motion.aside
              initial={{ x: -16, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -12, opacity: 0 }}
              transition={spring}
              onClick={(event) => event.stopPropagation()}
              className="h-full w-[min(320px,88vw)] overflow-y-auto border-r border-white/8 bg-background px-4 py-6"
            >
              <DocsSidebar onNavigate={() => setMenuForPath(null)} />
            </motion.aside>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="mx-auto grid max-w-[1400px] grid-cols-1 md:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)_200px]">
        <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] overflow-y-auto border-r border-white/8 px-4 py-10 md:block">
          <DocsSidebar />
        </aside>
        <div className="min-w-0 px-4 py-10 md:px-10 md:py-12">
          {page ? (
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500">
              {page.section}
              <span className="mx-2 text-zinc-700">/</span>
              {page.title}
            </p>
          ) : null}
          <article className="mt-4">{children}</article>
        </div>
        <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] overflow-y-auto border-l border-white/8 px-5 py-12 xl:block">
          {page ? <DocsToc headings={page.headings} /> : null}
        </aside>
      </div>
    </div>
  );
}
