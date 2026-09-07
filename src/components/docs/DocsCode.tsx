"use client";

import { Check, Copy } from "@phosphor-icons/react";
import { useState } from "react";

export function DocsCode({
  code,
  language = "ts",
}: {
  code: string;
  language?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <div className="mt-6 max-w-[72ch] overflow-hidden border border-white/10 bg-raised/40">
      <div className="flex items-center justify-between border-b border-white/8 px-4 py-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">{language}</span>
        <button
          type="button"
          onClick={() => void onCopy()}
          className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-400 transition-colors hover:text-zinc-100"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto px-4 py-4 font-mono text-[13px] leading-relaxed text-zinc-200">
        <code>{code}</code>
      </pre>
    </div>
  );
}
