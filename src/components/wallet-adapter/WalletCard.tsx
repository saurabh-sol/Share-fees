"use client";

import { useRef, useEffect, useCallback } from "react";
import { CircleNotch, X } from "@phosphor-icons/react";
import { WalletList } from "./WalletList";
import { ConnectedWallet } from "./ConnectedWallet";
import { WalletError } from "./WalletError";

type AdapterState = ReturnType<typeof import("./useWalletAdapter").useWalletAdapter>;

type Props = {
  adapter: AdapterState;
  onClose: () => void;
};

export function WalletCard({ adapter, onClose }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleEsc = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && !adapter.isBusy) onClose();
    },
    [adapter.isBusy, onClose],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [handleEsc]);

  const showError =
    adapter.error &&
    (adapter.connectionStatus === "error" ||
      adapter.connectionStatus === "rejected" ||
      adapter.connectionStatus === "unavailable");

  const isConnected = adapter.connectionStatus === "connected" && adapter.connectedAddress;

  return (
    <div
      ref={cardRef}
      role="region"
      aria-label="Wallet adapter"
      className="relative w-[min(340px,calc(100vw-32px))] rounded-[16px] border border-white/[0.08] bg-raised shadow-[0_12px_48px_rgba(0,0,0,0.55)]"
    >
      <div className="p-4">
        <header className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-[2px] w-3.5 bg-accent" aria-hidden />
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted">
              {isConnected ? "Wallet connected" : "Wallet adapter"}
            </span>
          </div>
          <button
            type="button"
            aria-label="Close"
            disabled={adapter.isBusy}
            onClick={onClose}
            className="rounded-md p-1 text-zinc-500 transition-colors hover:bg-white/[0.04] hover:text-zinc-300 disabled:opacity-40"
          >
            <X className="size-3.5" />
          </button>
        </header>

        {adapter.isBusy && !isConnected ? (
          <div className="mb-3 flex items-center gap-2 font-mono text-[10px] text-muted">
            <CircleNotch className="size-3 animate-spin" aria-hidden />
            {adapter.connectionStatus === "signing"
              ? `Signing with ${adapter.selectedWallet?.name ?? "wallet"}…`
              : `Connecting to ${adapter.selectedWallet?.name ?? "wallet"}…`}
          </div>
        ) : null}

        {isConnected && adapter.selectedWallet && adapter.connectedAddress ? (
          <ConnectedWallet
            wallet={adapter.selectedWallet}
            address={adapter.connectedAddress}
            namespace={adapter.connectedNamespace}
            chainId={adapter.chainId}
            balance={adapter.balance}
            balanceSymbol={adapter.balanceSymbol}
            copied={adapter.copied}
            onCopy={adapter.copyAddress}
            onDisconnect={adapter.disconnect}
            onContinue={adapter.continueToApp}
          />
        ) : (
          <>
            <div className="mb-3.5">
              <h1 className="font-mono text-[22px] font-bold leading-none tracking-tight text-foreground">
                Connect Wallet
              </h1>
              <p className="mt-2 text-[11px] leading-relaxed text-muted">
                Installed extensions appear here with their official icons.
              </p>
            </div>

            {showError && adapter.error ? (
              <div className="mb-2.5">
                <WalletError
                  title={
                    adapter.connectionStatus === "rejected"
                      ? "Request rejected"
                      : adapter.connectionStatus === "unavailable"
                        ? "Wallet unavailable"
                        : "Connection failed"
                  }
                  message={adapter.error}
                  onRetry={
                    adapter.selectedWalletId
                      ? () => adapter.connectWallet(adapter.selectedWalletId as string)
                      : undefined
                  }
                />
              </div>
            ) : null}

            <WalletList
              wallets={adapter.wallets}
              selectedWalletId={adapter.selectedWalletId}
              connectionStatus={adapter.connectionStatus}
              connectedAddress={adapter.connectedAddress}
              isBusy={adapter.isBusy}
              onConnect={adapter.connectWallet}
            />
          </>
        )}
      </div>
    </div>
  );
}
