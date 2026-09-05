"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { PixelWalletArt, PixelWalletArtMobile } from "./PixelWalletArt";
import { DecorativeAscii } from "./DecorativeAscii";
import { WalletCard } from "./WalletCard";
import { useWalletAdapter } from "./useWalletAdapter";

export function WalletAdapter() {
  const [open, setOpen] = useState(true);
  const adapter = useWalletAdapter(() => setOpen(false));

  return (
    <div className="wallet-grid-bg relative min-h-[100dvh] overflow-hidden bg-[#141416]">
      {/* Pixel wallet artwork — upper center, behind the card */}
      <PixelWalletArt />
      <PixelWalletArtMobile />

      {/* Decorative ASCII labels around the viewport */}
      <DecorativeAscii />

      {/* Page content */}
      <div className="relative z-10 flex min-h-[100dvh] flex-col">
        {/* Tiny T2C badge — top left */}
        <header className="flex items-center justify-between px-5 py-5 sm:px-8">
          <Link
            href="/"
            className="font-mono text-xs tracking-[0.22em] text-[#c23a3a] transition-opacity hover:opacity-80"
          >
            T2C
          </Link>
        </header>

        {/* Card area — centered horizontally, pushed toward the bottom-center */}
        <div className="flex flex-1 items-end justify-center pb-10 md:items-center md:pb-0">
          <AnimatePresence mode="wait">
            {open ? (
              <motion.div
                key="card"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              >
                <WalletCard adapter={adapter} onClose={() => setOpen(false)} />
              </motion.div>
            ) : (
              <motion.button
                key="trigger"
                type="button"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={() => setOpen(true)}
                className="rounded-[14px] bg-[#c23a3a] px-8 py-3.5 font-mono text-sm uppercase tracking-wider text-white transition-colors hover:bg-[#d04444] active:scale-[0.98] active:bg-[#9f2f2f]"
              >
                Connect Wallet
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
