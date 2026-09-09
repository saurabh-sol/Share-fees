"use client";

import { useEffect, useState } from "react";
import { X } from "@phosphor-icons/react";

const STORAGE_KEY = "accrued_v2_upgrade_banner_dismissed";

export function UpgradeBannerClient({ message }: { message: string }) {
  const [visible, setVisible] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      setVisible(localStorage.getItem(STORAGE_KEY) !== "1");
    } catch {
      setVisible(true);
    }
  }, []);

  if (visible !== true) return null;

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
  }

  return (
    <div
      role="status"
      className="relative border-b border-amber-500/25 bg-amber-500/10 px-10 py-2.5 text-center font-mono text-[11px] leading-relaxed tracking-[0.04em] text-amber-100/95"
    >
      <p className="mx-auto max-w-[72ch]">{message}</p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss upgrade notice"
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-amber-200/70 transition-colors hover:bg-amber-500/15 hover:text-amber-50"
      >
        <X className="h-4 w-4" weight="bold" />
      </button>
    </div>
  );
}
