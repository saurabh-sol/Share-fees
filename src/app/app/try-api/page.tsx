import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { pageTitle } from "@/lib/brand";

export const metadata: Metadata = {
  title: pageTitle("Try API"),
  description: "Try API is locked. This feature will be live soon.",
};

export default async function TryApiPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="space-y-8">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">LLM keys</p>
        <h1 className="mt-3 text-3xl tracking-tight text-zinc-100">Try API</h1>
        <p className="mt-3 max-w-[65ch] text-zinc-400">This desk surface is locked for now.</p>
      </div>

      <div className="group relative max-w-xl cursor-not-allowed border border-white/10 px-6 py-10">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-600">Coming soon</p>
        <p className="mt-3 text-zinc-400">
          Paste a key and send a test message from here once this ships. Hover for status.
        </p>
        <p
          role="tooltip"
          className="pointer-events-none absolute left-1/2 top-4 z-10 w-max -translate-x-1/2 border border-white/12 bg-background px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-200 opacity-0 shadow-[0_8px_24px_rgba(0,0,0,0.45)] transition-opacity duration-150 group-hover:opacity-100"
        >
          This feature will be live soon
        </p>
      </div>
    </div>
  );
}
