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
      className="rounded-[14px] border border-[#c23a3a]/30 bg-[#c23a3a]/[0.06] px-4 py-3"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 size-4 shrink-0 text-[#c23a3a]" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-sm text-[#e4e4e7]">{title}</p>
          <p className="mt-1 text-sm text-[#a1a1aa]">{message}</p>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 font-mono text-xs uppercase tracking-wider text-[#c23a3a] hover:underline"
            >
              Try again
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
