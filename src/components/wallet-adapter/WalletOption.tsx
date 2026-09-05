"use client";

import { ChevronRight, Loader2, Check } from "lucide-react";
import type { WalletConfig, ConnectionStatus, WalletId } from "./wallet-config";
import { shortenAddress } from "./wallet-utils";

type Props = {
  wallet: WalletConfig;
  status: ConnectionStatus;
  isSelected: boolean;
  available: boolean;
  connectedAddress?: string | null;
  disabled?: boolean;
  onClick: (id: WalletId) => void;
};

export function WalletOption({
  wallet,
  status,
  isSelected,
  available,
  connectedAddress,
  disabled,
  onClick,
}: Props) {
  const Logo = wallet.Logo;
  const isConnecting = isSelected && (status === "connecting" || status === "signing");
  const isConnected = isSelected && status === "connected";
  const isUnavailable = isSelected && status === "unavailable";
  const isError = isSelected && (status === "error" || status === "rejected");

  let rightContent: React.ReactNode = (
    <ChevronRight
      className="size-4 text-zinc-600 transition-transform duration-200 group-hover:translate-x-0.5"
      aria-hidden
    />
  );

  if (isConnecting) {
    rightContent = <Loader2 className="size-4 animate-spin text-zinc-400" aria-hidden />;
  } else if (isConnected) {
    rightContent = (
      <span className="flex items-center gap-1 font-mono text-[10px] text-[#c23a3a]">
        <Check className="size-3" aria-hidden />
        Connected
      </span>
    );
  } else if (isUnavailable) {
    rightContent = <span className="font-mono text-[10px] text-zinc-500">Unavailable</span>;
  } else if (isError) {
    rightContent = <span className="font-mono text-[10px] text-[#c23a3a]">Failed</span>;
  } else if (!available) {
    rightContent = <span className="font-mono text-[10px] text-zinc-600">Not installed</span>;
  }

  const description =
    isConnecting
      ? status === "signing"
        ? "Sign the login message…"
        : "Connecting…"
      : isConnected && connectedAddress
        ? shortenAddress(connectedAddress)
        : wallet.description;

  return (
    <button
      type="button"
      aria-label={`Connect ${wallet.name}`}
      disabled={disabled || isConnecting}
      onClick={() => onClick(wallet.id)}
      className={`group flex h-[68px] w-full items-center gap-3 rounded-[12px] border px-4 text-left transition-all duration-200 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 ${
        isConnected
          ? "border-[#c23a3a]/35 bg-[#c23a3a]/[0.06]"
          : isSelected && isError
            ? "border-[#c23a3a]/30 bg-[#c23a3a]/[0.04]"
            : "border-white/[0.08] bg-white/[0.015] hover:translate-x-0.5 hover:border-white/[0.14] hover:bg-white/[0.03]"
      }`}
    >
      <span className="flex size-10 shrink-0 items-center justify-center">
        <Logo className="size-[34px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="font-mono text-sm tracking-tight text-[#e4e4e7]">{wallet.name}</span>
          {wallet.badge ? (
            <span className="rounded border border-[#c23a3a]/35 bg-[#c23a3a]/15 px-1.5 py-px font-mono text-[9px] uppercase tracking-wider text-[#c23a3a]">
              {wallet.badge}
            </span>
          ) : null}
        </span>
        <span className="mt-px block truncate font-mono text-[11px] text-[#a1a1aa]">
          {description}
        </span>
      </span>
      {rightContent}
    </button>
  );
}
