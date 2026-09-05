"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AdminSignOut() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        void fetch("/api/v1/admin/session", { method: "DELETE", credentials: "same-origin" }).finally(() => {
          router.push("/admin");
          router.refresh();
        });
      }}
      className="text-sm text-zinc-300 transition-transform active:scale-[0.98] hover:text-zinc-100 disabled:opacity-40"
    >
      {busy ? "Leaving…" : "Leave"}
    </button>
  );
}
