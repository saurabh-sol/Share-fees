"use client";

import { CaretRight, Check, CircleNotch } from "@phosphor-icons/react";
import type { ConnectionStatus, DiscoveredWallet } from "./wallet-config";
import { WalletIcon } from "./WalletIcon";
import { shortenAddress } from "./wallet-utils";

type Props = {
  wallet: DiscoveredWallet;
  status: ConnectionStatus;
  isSelected: boolean;
  connectedAddress?: string | null;
  disabled?: boolean;
  onClick: (id: string) => void;
};

export function WalletOption({
  wallet,
  status,
  isSelected,
  connectedAddress,
  disabled,
  onClick,
}: Props) {
  const isConnecting = isSelected && (status === "connecting" || status === "signing");
  const isConnected = isSelected && status === "connected";
  const isUnavailable = isSelected && status === "unavailable";
  const isError = isSelected && (status === "error" || status === "rejected");

  let rightContent: React.ReactNode = (
    <CaretRight
      className="size-3.5 text-zinc-600 transition-transform duration-200 group-hover:translate-x-0.5"
      aria-hidden
    />
  );

  if (isConnecting) {
    rightContent = <CircleNotch className="size-3.5 animate-spin text-zinc-400" aria-hidden />;
  } else if (isConnected) {
    rightContent = (
      <span className="flex items-center gap-1 font-mono text-[9px] text-accent">
        <Check className="size-2.5" aria-hidden />
        Connected
      </span>
    );
  } else if (isUnavailable) {
    rightContent = <span className="font-mono text-[9px] text-zinc-500">Unavailable</span>;
  } else if (isError) {
    rightContent = <span className="font-mono text-[9px] text-accent">Failed</span>;
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
      className={`group flex h-[52px] w-full items-center gap-2.5 rounded-[10px] border px-3 text-left transition-all duration-150 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 ${
        isConnected
          ? "border-accent/35 bg-accent/[0.06]"
          : isSelected && isError
            ? "border-accent/30 bg-accent/[0.04]"
            : "border-white/[0.08] bg-white/[0.015] hover:translate-x-0.5 hover:border-white/[0.14] hover:bg-white/[0.03]"
      }`}
    >
      <span className="flex size-8 shrink-0 items-center justify-center">
        <WalletIcon name={wallet.name} iconUrl={wallet.iconUrl} size={28} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-mono text-[13px] tracking-tight text-foreground">
          {wallet.name}
        </span>
        <span className="mt-px block truncate font-mono text-[10px] text-muted">
          {description}
        </span>
      </span>
      {rightContent}
    </button>
  );
}
