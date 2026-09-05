"use client";

import { useRef, useEffect, useCallback } from "react";
import { X, Loader2 } from "lucide-react";
import { WalletList } from "./WalletList";
import { ConnectedWallet } from "./ConnectedWallet";
import { WalletError } from "./WalletError";
import { ExploreMore } from "./ExploreMore";
import { NetworkSelector } from "./NetworkSelector";
import {
  PRIMARY_WALLETS,
  EXPANDED_WALLETS,
  PRIMARY_NETWORKS,
  EXTRA_NETWORKS,
} from "./wallet-config";
import type { WalletId } from "./wallet-config";

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

  const visibleWallets = adapter.isExpanded
    ? [...PRIMARY_WALLETS, ...EXPANDED_WALLETS.filter((w) => w.id === "walletconnect")]
    : PRIMARY_WALLETS;

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
      className="relative w-[calc(100vw-32px)] max-w-[460px] rounded-[18px] border border-white/[0.08] bg-[#1c1c1f] shadow-[0_16px_64px_rgba(0,0,0,0.5)]"
    >
      {/* Network selector overlay */}
      {adapter.showNetworks ? (
        <NetworkSelector
          networks={[...PRIMARY_NETWORKS, ...EXTRA_NETWORKS]}
          selectedChainId={adapter.chainId}
          onSelect={() => adapter.setShowNetworks(false)}
          onClose={() => adapter.setShowNetworks(false)}
        />
      ) : null}

      <div className="p-5 sm:p-6">
        {/* Header */}
        <header className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-block h-[2px] w-4 bg-[#c23a3a]" aria-hidden />
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#a1a1aa]">
              {isConnected ? "Wallet connected" : "Wallet adapter"}
            </span>
          </div>
          <button
            type="button"
            aria-label="Close"
            disabled={adapter.isBusy}
            onClick={onClose}
            className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-white/[0.04] hover:text-zinc-300 disabled:opacity-40"
          >
            <X className="size-4" />
          </button>
        </header>

        {/* Busy indicator */}
        {adapter.isBusy && !isConnected ? (
          <div className="mb-4 flex items-center gap-2 font-mono text-[11px] text-[#a1a1aa]">
            <Loader2 className="size-3 animate-spin" aria-hidden />
            {adapter.connectionStatus === "signing"
              ? `Signing with ${adapter.selectedWallet?.name ?? "wallet"}…`
              : `Connecting to ${adapter.selectedWallet?.name ?? "wallet"}…`}
          </div>
        ) : null}

        {/* Connected state */}
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
            {/* Title */}
            <div className="mb-5">
              <h1 className="font-mono text-[28px] font-bold leading-none tracking-tight text-[#e4e4e7] sm:text-[34px]">
                Connect Wallet
              </h1>
              <p className="mt-3 max-w-[380px] text-[13px] leading-relaxed text-[#a1a1aa]">
                Choose a wallet to continue. Supported networks include Ethereum and Robinhood ETH.
              </p>
            </div>

            {/* Error */}
            {showError && adapter.error ? (
              <div className="mb-3">
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
                      ? () => adapter.connectWallet(adapter.selectedWalletId as WalletId)
                      : undefined
                  }
                />
              </div>
            ) : null}

            {/* Wallet list */}
            <WalletList
              wallets={visibleWallets}
              selectedWalletId={adapter.selectedWalletId}
              connectionStatus={adapter.connectionStatus}
              connectedAddress={adapter.connectedAddress}
              walletAvailability={adapter.walletAvailability}
              isBusy={adapter.isBusy}
              onConnect={adapter.connectWallet}
            />

            {/* Explore more */}
            <ExploreMore
              onExpand={() => adapter.setIsExpanded(true)}
              onShowNetworks={() => adapter.setShowNetworks(true)}
              onNetworkFocus={() => adapter.setShowNetworks(true)}
            />
          </>
        )}

        {/* Footer */}
        <footer className="mt-5 flex items-center justify-between border-t border-white/[0.08] pt-3">
          <p className="font-mono text-[10px] text-[#a1a1aa]">Your assets. Your journey.</p>
          <span className="inline-block h-[2px] w-5 bg-[#c23a3a]" aria-hidden />
        </footer>
      </div>
    </div>
  );
}
