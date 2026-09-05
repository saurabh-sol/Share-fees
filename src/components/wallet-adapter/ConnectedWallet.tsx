"use client";

import { Copy, LogOut, ArrowRight } from "lucide-react";
import type { DiscoveredWallet } from "./wallet-config";
import { WalletIcon } from "./WalletIcon";
import { shortenAddress } from "./wallet-utils";

type Props = {
  wallet: DiscoveredWallet;
  address: string;
  namespace: "eip155" | "solana" | null;
  chainId: number | null;
  balance: string | null;
  balanceSymbol: string;
  copied: boolean;
  onCopy: () => void;
  onDisconnect: () => void;
  onContinue: () => void;
};

const CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum",
  10: "Optimism",
  137: "Polygon",
  42161: "Arbitrum",
  8453: "Base",
  4663: "Robinhood ETH",
};

export function ConnectedWallet({
  wallet,
  address,
  namespace,
  chainId,
  balance,
  balanceSymbol,
  copied,
  onCopy,
  onDisconnect,
  onContinue,
}: Props) {
  const networkLabel =
    namespace === "solana"
      ? "Solana"
      : chainId
        ? (CHAIN_NAMES[chainId] ?? `Chain ${chainId}`)
        : "Ethereum";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-[8px] border border-white/[0.08] bg-white/[0.02]">
          <WalletIcon name={wallet.name} iconUrl={wallet.iconUrl} size={24} />
        </span>
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#c23a3a]">Connected</p>
          <h2 className="font-mono text-[15px] tracking-tight text-[#e4e4e7]">{wallet.name}</h2>
          <p className="font-mono text-[11px] text-[#a1a1aa]">{shortenAddress(address, 8, 6)}</p>
        </div>
      </div>

      <dl className="divide-y divide-white/[0.08] border-y border-white/[0.08] font-mono text-xs">
        <div className="flex justify-between py-2.5">
          <dt className="text-[#a1a1aa]">Wallet</dt>
          <dd className="text-[#e4e4e7]">{wallet.name}</dd>
        </div>
        <div className="flex justify-between py-2.5">
          <dt className="text-[#a1a1aa]">Address</dt>
          <dd className="text-[#e4e4e7]">{shortenAddress(address, 10, 6)}</dd>
        </div>
        <div className="flex justify-between py-2.5">
          <dt className="text-[#a1a1aa]">Network</dt>
          <dd className="text-[#e4e4e7]">{networkLabel}</dd>
        </div>
        {namespace === "eip155" && chainId ? (
          <div className="flex justify-between py-2.5">
            <dt className="text-[#a1a1aa]">Chain ID</dt>
            <dd className="text-[#e4e4e7]">{chainId}</dd>
          </div>
        ) : null}
        {balance && namespace === "eip155" ? (
          <div className="flex justify-between py-2.5">
            <dt className="text-[#a1a1aa]">Balance</dt>
            <dd className="tabular-nums text-[#e4e4e7]">
              {balance} {balanceSymbol}
            </dd>
          </div>
        ) : null}
      </dl>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center gap-1.5 rounded-[10px] border border-white/[0.08] bg-white/[0.02] px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-[#e4e4e7] transition-colors hover:border-white/[0.14] hover:bg-white/[0.04] active:bg-[#9f2f2f]/20"
        >
          <Copy className="size-3" aria-hidden />
          {copied ? "Copied" : "Copy address"}
        </button>
        <button
          type="button"
          onClick={onDisconnect}
          className="inline-flex items-center gap-1.5 rounded-[10px] border border-white/[0.08] bg-white/[0.02] px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-[#a1a1aa] transition-colors hover:border-white/[0.14] hover:text-[#e4e4e7] active:bg-[#9f2f2f]/20"
        >
          <LogOut className="size-3" aria-hidden />
          Disconnect
        </button>
        <button
          type="button"
          onClick={onContinue}
          className="inline-flex items-center gap-1.5 rounded-[10px] bg-[#c23a3a] px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-white transition-colors hover:bg-[#d04444] active:bg-[#9f2f2f]"
        >
          Enter desk
          <ArrowRight className="size-3" aria-hidden />
        </button>
      </div>
    </div>
  );
}
