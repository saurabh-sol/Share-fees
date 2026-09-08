"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useDisconnect } from "wagmi";
import { forgetWallet } from "@/lib/wallet/remember";

export function SignOutButton() {
  const router = useRouter();
  const { disconnectAsync } = useDisconnect();
  const [busy, setBusy] = useState(false);

  async function onDisconnect() {
    setBusy(true);
    try {
      await fetch("/api/v1/auth/logout", { method: "POST", credentials: "same-origin" });
      forgetWallet();
      await disconnectAsync().catch(() => undefined);
      router.push("/login");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onDisconnect}
      disabled={busy}
      className="text-sm text-zinc-300 transition-transform active:scale-[0.98] hover:text-zinc-100 disabled:opacity-40"
    >
      {busy ? "Disconnecting…" : "Disconnect"}
    </button>
  );
}
