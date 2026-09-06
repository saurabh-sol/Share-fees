"use client";

import { WarningCircle } from "@phosphor-icons/react";

type Props = {
  title?: string;
  message: string;
  onRetry?: () => void;
};

export function WalletError({ title = "Connection failed", message, onRetry }: Props) {
  return (
    <div
      role="alert"
      className="rounded-[10px] border border-accent/30 bg-accent/[0.06] px-3 py-2"
    >
      <div className="flex items-start gap-2">
        <WarningCircle className="mt-0.5 size-3.5 shrink-0 text-accent" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[12px] text-foreground">{title}</p>
          <p className="mt-0.5 text-[11px] text-muted">{message}</p>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-1.5 font-mono text-[10px] uppercase tracking-wider text-accent hover:underline"
            >
              Try again
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
