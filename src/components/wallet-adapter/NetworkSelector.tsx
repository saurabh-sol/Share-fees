"use client";

import { X } from "lucide-react";
import type { NetworkConfig } from "./wallet-config";

type Props = {
  networks: NetworkConfig[];
  selectedChainId: number | null;
  onSelect: (chainId: number) => void;
  onClose: () => void;
};

export function NetworkSelector({ networks, selectedChainId, onSelect, onClose }: Props) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col rounded-[18px] bg-[#1c1c1f] p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-[2px] w-4 bg-[#c23a3a]" aria-hidden />
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#a1a1aa]">
              Networks
            </span>
          </div>
          <h3 className="mt-2 font-mono text-lg text-[#e4e4e7]">Select network</h3>
        </div>
        <button
          type="button"
          aria-label="Close network selector"
          onClick={onClose}
          className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-white/[0.04] hover:text-zinc-300"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto">
        {networks.map((network) => {
          const Logo = network.Logo;
          const active = selectedChainId === network.chainId;
          return (
            <button
              key={network.id}
              type="button"
              onClick={() => onSelect(network.chainId)}
              className={`flex w-full items-center gap-3 rounded-[10px] border px-3 py-2.5 text-left transition-colors ${
                active
                  ? "border-[#c23a3a]/35 bg-[#c23a3a]/[0.06]"
                  : "border-white/[0.08] bg-white/[0.015] hover:border-white/[0.14] hover:bg-white/[0.03]"
              }`}
            >
              <span className="flex size-8 items-center justify-center">
                <Logo className="size-6" />
              </span>
              <span className="flex-1">
                <span className="font-mono text-xs text-[#e4e4e7]">{network.name}</span>
                <span className="mt-px block font-mono text-[10px] text-[#a1a1aa]">
                  Chain ID {network.chainId}
                </span>
              </span>
              {network.primary ? (
                <span className="font-mono text-[9px] uppercase tracking-wider text-[#c23a3a]">
                  Primary
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
