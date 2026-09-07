"use client";

import { MagnifyingGlass, X } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DOCS_PAGES, searchDocs } from "@/lib/docs/catalog";

const spring = { type: "spring" as const, stiffness: 100, damping: 20 };

export function DocsSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const results = useMemo(() => (query.trim() ? searchDocs(query) : DOCS_PAGES), [query]);

  function openSearch() {
    setQuery("");
    setOpen(true);
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setQuery("");
        setOpen(true);
      }
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={openSearch}
        className="flex h-9 w-full max-w-xs items-center gap-2 border border-white/10 bg-raised/40 px-3 text-left text-sm text-zinc-500 transition-colors hover:border-white/20 hover:text-zinc-300"
      >
        <MagnifyingGlass size={14} />
        <span className="flex-1">Search docs</span>
        <span className="hidden font-mono text-[10px] uppercase tracking-wider text-zinc-600 sm:inline">
          ⌘K
        </span>
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-start justify-center bg-background/70 px-4 pt-[12vh] backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={spring}
            onClick={() => setOpen(false)}
          >
            <motion.div
              role="dialog"
              aria-label="Search documentation"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={spring}
              onClick={(event) => event.stopPropagation()}
              className="w-full max-w-xl border border-white/10 bg-raised"
            >
              <div className="flex items-center gap-3 border-b border-white/8 px-4">
                <MagnifyingGlass size={16} className="text-zinc-500" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  autoFocus
                  placeholder="Search pages, rails, limits…"
                  className="h-12 flex-1 bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
                />
                <button
                  type="button"
                  aria-label="Close search"
                  onClick={() => setOpen(false)}
                  className="text-zinc-500 hover:text-zinc-200"
                >
                  <X size={16} />
                </button>
              </div>
              <ul className="max-h-[50vh] overflow-y-auto">
                {query.trim() && results.length === 0 ? (
                  <li className="px-4 py-8 text-sm text-zinc-500">No pages match that query.</li>
                ) : null}
                {results.map((page) => (
                  <li key={page.href} className="border-t border-white/6">
                    <Link
                      href={page.href}
                      onClick={() => setOpen(false)}
                      className="block px-4 py-3 hover:bg-white/[0.03]"
                    >
                      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                        {page.section}
                      </p>
                      <p className="mt-1 text-sm text-zinc-100">{page.title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-zinc-500">{page.description}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
