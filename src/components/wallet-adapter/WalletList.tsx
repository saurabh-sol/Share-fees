"use client";

import { WalletOption } from "./WalletOption";
import type { ConnectionStatus, DiscoveredWallet } from "./wallet-config";

type Props = {
  wallets: DiscoveredWallet[];
  selectedWalletId: string | null;
  connectionStatus: ConnectionStatus;
  connectedAddress: string | null;
  isBusy: boolean;
  onConnect: (id: string) => void;
};

export function WalletList({
  wallets,
  selectedWalletId,
  connectionStatus,
  connectedAddress,
  isBusy,
  onConnect,
}: Props) {
  if (wallets.length === 0) {
    return (
      <p className="rounded-[10px] border border-white/[0.08] px-3 py-4 font-mono text-[11px] leading-relaxed text-muted">
        No browser wallet detected. Install an extension, then refresh this page.
      </p>
    );
  }

  return (
    <div className="max-h-[280px] space-y-2 overflow-y-auto pr-0.5">
      {wallets.map((wallet) => (
        <WalletOption
          key={wallet.id}
          wallet={wallet}
          status={connectionStatus}
          isSelected={selectedWalletId === wallet.id}
          connectedAddress={connectedAddress}
          disabled={isBusy && selectedWalletId !== wallet.id}
          onClick={onConnect}
        />
      ))}
    </div>
  );
}
