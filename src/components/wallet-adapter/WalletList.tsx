"use client";

import { WalletOption } from "./WalletOption";
import type { ConnectionStatus, WalletConfig, WalletId } from "./wallet-config";

type Props = {
  wallets: WalletConfig[];
  selectedWalletId: WalletId | null;
  connectionStatus: ConnectionStatus;
  connectedAddress: string | null;
  walletAvailability: Map<WalletId, boolean>;
  isBusy: boolean;
  onConnect: (id: WalletId) => void;
};

export function WalletList({
  wallets,
  selectedWalletId,
  connectionStatus,
  connectedAddress,
  walletAvailability,
  isBusy,
  onConnect,
}: Props) {
  return (
    <div className="space-y-2">
      {wallets.map((wallet) => (
        <WalletOption
          key={wallet.id}
          wallet={wallet}
          status={connectionStatus}
          isSelected={selectedWalletId === wallet.id}
          available={walletAvailability.get(wallet.id) ?? false}
          connectedAddress={connectedAddress}
          disabled={isBusy && selectedWalletId !== wallet.id}
          onClick={onConnect}
        />
      ))}
    </div>
  );
}
