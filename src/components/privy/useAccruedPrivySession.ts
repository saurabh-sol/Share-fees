"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useConnectOrCreateWallet,
  useConnectWallet,
  useLogin,
  usePrivy,
  useWallets,
  type BaseConnectedEthereumWallet,
  type ConnectedWallet,
  type WalletListEntry,
} from "@privy-io/react-auth";
import { completeAccruedSession } from "@/lib/auth/complete-accrued-session";
import { isUserRejection, walletErrorMessage } from "@/lib/wallet/errors";
import { PRIVY_INSTALLED_WALLET_LIST } from "@/lib/privy/config";

const WALLET_MODAL_OPTIONS = {
  walletList: [...PRIVY_INSTALLED_WALLET_LIST] as WalletListEntry[],
  walletChainType: "ethereum-only" as const,
};

/** Opens Privy's wallet modal, then completes Accrued SIWE after wallet connect. */
export function useAccruedPrivySession() {
  const router = useRouter();
  const { ready, authenticated, logout } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const [status, setStatus] = useState<"idle" | "signing" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const pendingSiweRef = useRef(false);
  const busyRef = useRef(false);

  const finishSiwe = useCallback(
    async (wallet: ConnectedWallet) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setStatus("signing");
      setError(null);

      try {
        await completeAccruedSession(wallet);
        pendingSiweRef.current = false;
        router.push("/app");
        router.refresh();
      } catch (err) {
        await logout().catch(() => undefined);
        pendingSiweRef.current = false;
        setStatus("error");
        setError(
          isUserRejection(err)
            ? "The wallet request was rejected. Try again."
            : walletErrorMessage(err),
        );
      } finally {
        busyRef.current = false;
      }
    },
    [logout, router],
  );

  const tryFinishFromWallets = useCallback(() => {
    if (!pendingSiweRef.current || !walletsReady || busyRef.current) return;
    const wallet = wallets.find((item) => item.type === "ethereum");
    if (!wallet || wallet.type !== "ethereum") return;
    void finishSiwe(wallet);
  }, [finishSiwe, wallets, walletsReady]);

  useEffect(() => {
    tryFinishFromWallets();
  }, [tryFinishFromWallets, authenticated]);

  const onWalletConnected = useCallback(
    (wallet: BaseConnectedEthereumWallet) => {
      pendingSiweRef.current = true;
      void finishSiwe(wallet as ConnectedWallet);
    },
    [finishSiwe],
  );

  const onWalletError = useCallback(() => {
    pendingSiweRef.current = false;
    setStatus("idle");
    setError("Wallet connection was cancelled or failed.");
  }, []);

  const { login } = useLogin({
    onComplete: () => {
      pendingSiweRef.current = true;
      setError(null);
      tryFinishFromWallets();
    },
    onError: onWalletError,
  });

  const { connectOrCreateWallet } = useConnectOrCreateWallet({
    onSuccess: ({ wallet }) => {
      if (wallet.type === "ethereum") onWalletConnected(wallet);
    },
    onError: onWalletError,
  });

  const { connectWallet } = useConnectWallet({
    onSuccess: ({ wallet }) => {
      if (wallet.type === "ethereum") onWalletConnected(wallet);
    },
    onError: onWalletError,
  });

  const connect = useCallback(() => {
    setError(null);
    setStatus("idle");
    pendingSiweRef.current = true;

    if (!ready) {
      pendingSiweRef.current = false;
      setError("Privy is still loading. Wait a moment, then try again.");
      return;
    }

    try {
      connectWallet(WALLET_MODAL_OPTIONS);
    } catch {
      try {
        connectOrCreateWallet();
      } catch {
        login({ loginMethods: ["wallet"] });
      }
    }
  }, [connectOrCreateWallet, connectWallet, login, ready]);

  return {
    ready,
    connect,
    status,
    error,
    isBusy: status === "signing",
  };
}
