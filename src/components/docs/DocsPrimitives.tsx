import Link from "next/link";
import type { ReactNode } from "react";

export function DocsH1({ children }: { children: ReactNode }) {
  return (
    <h1 className="max-w-[18ch] text-4xl tracking-tighter leading-none text-zinc-100 md:text-5xl">
      {children}
    </h1>
  );
}

export function DocsLead({ children }: { children: ReactNode }) {
  return <p className="mt-5 max-w-[65ch] text-base leading-relaxed text-zinc-400">{children}</p>;
}

export function DocsH2({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2
      id={id}
      className="mt-14 scroll-mt-28 border-t border-white/8 pt-10 text-2xl tracking-tight text-zinc-100"
    >
      {children}
    </h2>
  );
}

export function DocsH3({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h3 id={id} className="mt-8 scroll-mt-28 text-lg tracking-tight text-zinc-100">
      {children}
    </h3>
  );
}

export function DocsP({ children }: { children: ReactNode }) {
  return <p className="mt-4 max-w-[65ch] text-base leading-relaxed text-zinc-400">{children}</p>;
}

export function DocsUl({ children }: { children: ReactNode }) {
  return <ul className="mt-4 max-w-[65ch] list-disc space-y-2 pl-5 text-base leading-relaxed text-zinc-400">{children}</ul>;
}

export function DocsOl({ children }: { children: ReactNode }) {
  return (
    <ol className="mt-4 max-w-[65ch] list-decimal space-y-2 pl-5 text-base leading-relaxed text-zinc-400">
      {children}
    </ol>
  );
}

export function DocsA({ href, children }: { href: string; children: ReactNode }) {
  const external = href.startsWith("http");
  const className = "text-zinc-100 underline decoration-white/20 underline-offset-4 hover:decoration-accent";
  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

export function DocsCallout({
  title,
  tone = "info",
  children,
}: {
  title: string;
  tone?: "info" | "warn";
  children: ReactNode;
}) {
  return (
    <aside
      className={`mt-8 max-w-[65ch] border px-5 py-4 ${
        tone === "warn" ? "border-accent/40" : "border-white/10"
      }`}
    >
      <p
        className={`font-mono text-[11px] uppercase tracking-[0.18em] ${
          tone === "warn" ? "text-accent" : "text-zinc-500"
        }`}
      >
        {title}
      </p>
      <div className="mt-2 text-sm leading-relaxed text-zinc-400">{children}</div>
    </aside>
  );
}

export function DocsTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: ReactNode[][];
}) {
  return (
    <div className="mt-6 overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="border-b border-white/8 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500">
          <tr>
            {headers.map((header) => (
              <th key={header} className="py-3 pr-6 font-normal">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/8">
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} className="py-3 pr-6 align-top text-zinc-300">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DocsKbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="border border-white/12 bg-raised px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-zinc-300">
      {children}
    </kbd>
  );
}
