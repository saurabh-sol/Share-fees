"use client";

import { motion } from "framer-motion";
import { BrandMark } from "@/components/brand/BrandMark";
import { PeekAccountButton } from "@/components/landing/PeekAccountButton";
import { DecorativeAscii } from "@/components/privy/login-shell/DecorativeAscii";
import { PixelWalletArt, PixelWalletArtMobile } from "@/components/privy/login-shell/PixelWalletArt";
import { useAccruedPrivySession } from "./useAccruedPrivySession";

export function PrivyLogin() {
  const { ready, connect, status, error, isBusy } = useAccruedPrivySession();

  const label =
    !ready ? "Loading Privy…" : isBusy ? "Sign in your wallet…" : "Connect wallet";

  return (
    <div className="wallet-grid-bg relative min-h-[100dvh] overflow-hidden bg-background">
      <PixelWalletArt />
      <PixelWalletArtMobile />
      <DecorativeAscii />

      <div className="relative z-10 flex min-h-[100dvh] flex-col">
        <header className="flex items-center justify-between px-5 py-4 sm:px-8">
          <BrandMark tone="accent" size="lg" />
        </header>

        <div className="flex flex-1 items-center justify-center px-4 pb-8 pt-[42vh] md:pt-[48vh]">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-4 overflow-visible pt-2"
          >
            <PeekAccountButton label={label} onClick={connect} />

            {isBusy ? (
              <p className="max-w-sm text-center font-mono text-xs text-zinc-500">
                Sign the login message in your wallet to open a session.
              </p>
            ) : null}

            {error ? (
              <p className="max-w-sm text-center text-sm text-accent" role="alert">
                {error}
              </p>
            ) : null}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
