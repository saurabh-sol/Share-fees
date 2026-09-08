"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { PeekAccountButton } from "@/components/landing/PeekAccountButton";
import { BRAND_SHORT } from "@/lib/brand";
import { PixelWalletArt, PixelWalletArtMobile } from "./PixelWalletArt";
import { DecorativeAscii } from "./DecorativeAscii";
import { WalletCard } from "./WalletCard";
import { useWalletAdapter } from "./useWalletAdapter";

export function WalletAdapter() {
  const [open, setOpen] = useState(false);
  const adapter = useWalletAdapter(() => setOpen(false));

  return (
    <div className="wallet-grid-bg relative min-h-[100dvh] overflow-hidden bg-background">
      <PixelWalletArt />
      <PixelWalletArtMobile />
      <DecorativeAscii />

      <div className="relative z-10 flex min-h-[100dvh] flex-col">
        <header className="flex items-center justify-between px-5 py-4 sm:px-8">
          <Link
            href="/"
            className="font-mono text-xs tracking-[0.22em] text-accent transition-opacity hover:opacity-80"
          >
            {BRAND_SHORT}
          </Link>
        </header>

        <div className={`flex flex-1 items-center justify-center px-4 pb-8 ${open ? "pt-[28vh] md:pt-[22vh]" : "pt-[42vh] md:pt-[48vh]"}`}>
          <AnimatePresence mode="wait">
            {open ? (
              <motion.div
                key="card"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              >
                <WalletCard adapter={adapter} onClose={() => setOpen(false)} />
              </motion.div>
            ) : (
              <motion.div
                key="trigger"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center overflow-visible pt-2"
              >
                <PeekAccountButton label="Connect wallet" onClick={() => setOpen(true)} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
