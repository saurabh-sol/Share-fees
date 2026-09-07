"use client";

import { useEffect, useState } from "react";
import type { DocsHeading } from "@/lib/docs/catalog";

export function DocsToc({ headings }: { headings: DocsHeading[] }) {
  const [active, setActive] = useState(headings[0]?.id ?? "");

  useEffect(() => {
    if (headings.length === 0) return;
    const nodes = headings
      .map((heading) => document.getElementById(heading.id))
      .filter((node): node is HTMLElement => Boolean(node));
    if (nodes.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) setActive(visible.target.id);
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: [0, 0.25, 0.6] },
    );
    for (const node of nodes) observer.observe(node);
    return () => observer.disconnect();
  }, [headings]);

  if (headings.length === 0) return null;

  return (
    <nav aria-label="On this page" className="sticky top-24">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">On this page</p>
      <ul className="mt-4 space-y-2">
        {headings.map((heading) => (
          <li key={heading.id}>
            <a
              href={`#${heading.id}`}
              className={
                active === heading.id
                  ? "block text-sm text-zinc-100"
                  : "block text-sm text-zinc-500 transition-colors hover:text-zinc-200"
              }
            >
              {heading.title}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
