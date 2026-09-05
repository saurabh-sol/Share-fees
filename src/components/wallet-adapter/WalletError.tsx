"use client";

import { AlertCircle } from "lucide-react";

type Props = {
  title?: string;
  message: string;
  onRetry?: () => void;
};

export function WalletError({ title = "Connection failed", message, onRetry }: Props) {
  return (
    <div
      role="alert"
      className="rounded-[10px] border border-[#c23a3a]/30 bg-[#c23a3a]/[0.06] px-3 py-2"
    >
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-[#c23a3a]" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[12px] text-[#e4e4e7]">{title}</p>
          <p className="mt-0.5 text-[11px] text-[#a1a1aa]">{message}</p>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-1.5 font-mono text-[10px] uppercase tracking-wider text-[#c23a3a] hover:underline"
            >
              Try again
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
