"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminLogin() {
  const router = useRouter();
  const [secret, setSecret] = useState("");
  const [status, setStatus] = useState<"idle" | "working" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("working");
    setMessage(null);
    try {
      const response = await fetch("/api/v1/admin/session", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ secret }),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(data.message ?? "Login failed.");
      }
      router.refresh();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Login failed.");
    }
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="mx-auto max-w-md space-y-6 py-16">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">Phase 4</p>
        <h1 className="mt-3 text-3xl tracking-tight text-zinc-100">Admin</h1>
        <p className="mt-3 text-sm text-zinc-400">Rules, holds, and liability. Uses the server admin secret.</p>
      </div>
      <label className="block space-y-2">
        <span className="text-sm text-zinc-400">Admin secret</span>
        <input
          type="password"
          required
          minLength={16}
          value={secret}
          onChange={(event) => setSecret(event.target.value)}
          className="w-full border border-white/10 bg-transparent px-3 py-2 font-mono text-sm outline-none focus:border-[#c23a3a]"
        />
      </label>
      <button
        type="submit"
        disabled={status === "working"}
        className="rounded-full bg-[#c23a3a] px-5 py-2.5 text-sm text-zinc-50 transition-transform active:scale-[0.98] disabled:opacity-40"
      >
        {status === "working" ? "Checking…" : "Enter"}
      </button>
      {message ? <p className="text-sm text-[#c23a3a]">{message}</p> : null}
    </form>
  );
}
