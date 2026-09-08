"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getAddress } from "viem";
import { createSiweMessage } from "viem/siwe";
import { useRouter } from "next/navigation";
import {
  useAccount,
  useBalance,
  useChainId,
  useConnect,
  useDisconnect,
  useSignMessage,
} from "wagmi";
import { getPhantomSolana, encodeSignature } from "@/lib/wallet/phantom";
import { SIWE_STATEMENT } from "@/lib/brand";
import { forgetWallet, rememberWallet } from "@/lib/wallet/remember";
import type { ConnectionStatus, DiscoveredWallet } from "./wallet-config";
import { useInstalledWallets } from "./useInstalledWallets";
import {
  buildClientSiwsMessage,
  formatEthBalance,
  isUserRejection,
  postJson,
  walletErrorMessage,
} from "./wallet-utils";

type NonceResponse = {
  nonce?: string;
  issuedAt?: string;
  expirationTime?: string;
};

export function useWalletAdapter(onClose?: () => void) {
  const router = useRouter();
  const { wallets, connectors } = useInstalledWallets();
  const { connectAsync } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const { address: liveAddress, isConnected } = useAccount();
  const chainId = useChainId();
  const { data: balanceData } = useBalance({ address: liveAddress });

  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("idle");
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const [connectedNamespace, setConnectedNamespace] = useState<"eip155" | "solana" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const connectingRef = useRef(false);

  const resetState = useCallback(async () => {
    setSelectedWalletId(null);
    setConnectionStatus("idle");
    setConnectedAddress(null);
    setConnectedNamespace(null);
    setError(null);
    setCopied(false);
    connectingRef.current = false;
    await disconnectAsync().catch(() => undefined);
  }, [disconnectAsync]);

  const loginEvm = useCallback(
    async (wallet: DiscoveredWallet) => {
      const connector = connectors.find((item) => item.uid === wallet.connectorUid);
      if (!connector) {
        setConnectionStatus("unavailable");
        setError(`${wallet.name} is not available in this browser.`);
        return;
      }

      setConnectionStatus("connecting");
      const connection = await connectAsync({ connector });
      const raw = connection.accounts[0];
      if (!raw) throw new Error("No account returned from wallet.");
      const address = getAddress(raw);

      setConnectionStatus("signing");
      const nonceRes = await postJson<NonceResponse>("/api/v1/auth/nonce", {
        chainNamespace: "eip155",
        address,
      });

      const message = createSiweMessage({
        address,
        chainId: connection.chainId,
        domain: window.location.host,
        nonce: nonceRes.nonce ?? "",
        uri: window.location.origin,
        version: "1",
        statement: SIWE_STATEMENT,
        issuedAt: nonceRes.issuedAt ? new Date(nonceRes.issuedAt) : new Date(),
        expirationTime: nonceRes.expirationTime ? new Date(nonceRes.expirationTime) : undefined,
      });

      const signature = await signMessageAsync({ message });
      await postJson("/api/v1/auth/verify", {
        chainNamespace: "eip155",
        address,
        message,
        signature,
      });

      setConnectedAddress(address);
      setConnectedNamespace("eip155");
      setConnectionStatus("connected");
      rememberWallet({
        id: wallet.id,
        connectorUid: wallet.connectorUid,
        kind: "evm",
        address,
      });
    },
    [connectAsync, connectors, signMessageAsync],
  );

  const loginPhantomSolana = useCallback(async () => {
    const provider = getPhantomSolana();
    if (!provider) {
      setConnectionStatus("unavailable");
      setError("Phantom Solana was not detected.");
      return;
    }

    setConnectionStatus("connecting");
    const connected = await provider.connect();
    const address = connected.publicKey.toString();

    setConnectionStatus("signing");
    const nonceRes = await postJson<NonceResponse>("/api/v1/auth/nonce", {
      chainNamespace: "solana",
      address,
    });

    if (!nonceRes.nonce || !nonceRes.issuedAt || !nonceRes.expirationTime) {
      throw new Error("Nonce response was incomplete.");
    }

    const message = buildClientSiwsMessage({
      address,
      nonce: nonceRes.nonce,
      issuedAt: nonceRes.issuedAt,
      expirationTime: nonceRes.expirationTime,
    });

    const signed = await provider.signMessage(new TextEncoder().encode(message), "utf8");
    await postJson("/api/v1/auth/verify", {
      chainNamespace: "solana",
      address,
      message,
      signature: `0x${encodeSignature(signed.signature)}`,
    });

    setConnectedAddress(address);
    setConnectedNamespace("solana");
    setConnectionStatus("connected");
    rememberWallet({
      id: "phantom-solana",
      connectorUid: null,
      kind: "solana",
      address,
    });
  }, []);

  const connectWallet = useCallback(
    async (walletId: string) => {
      if (connectingRef.current) return;
      connectingRef.current = true;
      setSelectedWalletId(walletId);
      setError(null);

      const wallet = wallets.find((item) => item.id === walletId);
      if (!wallet) {
        connectingRef.current = false;
        return;
      }

      try {
        if (wallet.kind === "solana") {
          await loginPhantomSolana();
        } else {
          await loginEvm(wallet);
        }
      } catch (err) {
        await disconnectAsync().catch(() => undefined);
        if (isUserRejection(err)) {
          setConnectionStatus("rejected");
          setError("The wallet request was rejected. Try again.");
        } else {
          setConnectionStatus("error");
          setError(walletErrorMessage(err));
        }
      } finally {
        connectingRef.current = false;
      }
    },
    [wallets, loginEvm, loginPhantomSolana, disconnectAsync],
  );

  const disconnect = useCallback(async () => {
    await fetch("/api/v1/auth/logout", { method: "POST", credentials: "same-origin" }).catch(
      () => undefined,
    );
    forgetWallet();
    await resetState();
  }, [resetState]);

  const copyAddress = useCallback(async () => {
    const addr = connectedAddress ?? liveAddress;
    if (!addr) return;
    await navigator.clipboard.writeText(addr);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }, [connectedAddress, liveAddress]);

  const continueToApp = useCallback(() => {
    router.push("/app");
    router.refresh();
  }, [router]);

  const handleClose = useCallback(() => {
    if (connectionStatus === "connecting" || connectionStatus === "signing") return;
    onClose?.();
  }, [connectionStatus, onClose]);

  const selectedWallet = useMemo(
    () => wallets.find((wallet) => wallet.id === selectedWalletId) ?? null,
    [wallets, selectedWalletId],
  );

  const displayAddress = connectedAddress ?? liveAddress ?? null;
  const isBusy = connectionStatus === "connecting" || connectionStatus === "signing";

  return {
    wallets,
    selectedWallet,
    selectedWalletId,
    connectionStatus,
    connectedAddress: displayAddress,
    connectedNamespace,
    chainId,
    balance: balanceData ? formatEthBalance(balanceData.value, balanceData.decimals) : null,
    balanceSymbol: balanceData?.symbol ?? "ETH",
    error,
    copied,
    connectWallet,
    disconnect,
    copyAddress,
    continueToApp,
    handleClose,
    isBusy,
    isConnected: connectionStatus === "connected" || isConnected,
  };
}

export function useFocusTrap(active: boolean, containerRef: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!active || !containerRef.current) return;
    const root = containerRef.current;
    const focusable = root.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      if (focusable.length === 0) return;
      if (event.shiftKey) {
        if (document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        }
      } else if (document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }

    root.addEventListener("keydown", onKeyDown);
    return () => root.removeEventListener("keydown", onKeyDown);
  }, [active, containerRef]);
}

export function useEscapeKey(active: boolean, onEscape: () => void) {
  useEffect(() => {
    if (!active) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onEscape();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active, onEscape]);
}
