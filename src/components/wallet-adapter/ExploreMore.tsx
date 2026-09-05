"use client";

import { MoreHorizontal, Network } from "lucide-react";
import { EXPLORE_TILES } from "./wallet-config";
import { EthereumLogo } from "./logos/EthereumLogo";

type Props = {
  onExpand: () => void;
  onShowNetworks: () => void;
  onNetworkFocus: (id: string) => void;
};

export function ExploreMore({ onExpand, onShowNetworks, onNetworkFocus }: Props) {
  return (
    <div className="mt-5">
      {/* Divider */}
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-white/[0.08]" />
        <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-[#a1a1aa]">
          Or explore more
        </span>
        <span className="h-px flex-1 bg-white/[0.08]" />
      </div>

      {/* Tiles */}
      <div className="mt-4 grid grid-cols-4 gap-2">
        {EXPLORE_TILES.map((tile) => {
          const Logo = tile.Logo;
          return (
            <button
              key={tile.id}
              type="button"
              aria-label={tile.label}
              onClick={() => {
                if (tile.action === "expand") onExpand();
                else if (tile.action === "networks") onShowNetworks();
                else onNetworkFocus(tile.id);
              }}
              className="flex flex-col items-center justify-center gap-1.5 rounded-[10px] border border-white/[0.08] bg-white/[0.015] px-1 py-2.5 transition-all duration-200 hover:border-white/[0.14] hover:bg-white/[0.03] active:scale-[0.97]"
            >
              <span className="flex size-8 items-center justify-center">
                {Logo ? (
                  <Logo className="size-6" />
                ) : tile.id === "more-networks" ? (
                  <Network className="size-5 text-zinc-400" aria-hidden />
                ) : (
                  <MoreHorizontal className="size-5 text-zinc-400" aria-hidden />
                )}
              </span>
              <span className="text-center font-mono text-[8px] uppercase leading-tight tracking-wider text-[#a1a1aa]">
                {tile.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
