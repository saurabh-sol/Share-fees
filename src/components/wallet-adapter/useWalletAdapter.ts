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
  useConnectors,
  useDisconnect,
  useSignMessage,
} from "wagmi";
import { getPhantomSolana, encodeSignature } from "@/lib/wallet/phantom";
import type { ConnectionStatus, WalletConfig, WalletId } from "./wallet-config";
import {
  PRIMARY_WALLETS,
  EXPANDED_WALLETS,
} from "./wallet-config";
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
  const connectors = useConnectors();
  const { connectAsync } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const { address: liveAddress, isConnected } = useAccount();
  const chainId = useChainId();
  const { data: balanceData } = useBalance({ address: liveAddress });

  const [selectedWalletId, setSelectedWalletId] = useState<WalletId | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("idle");
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const [connectedNamespace, setConnectedNamespace] = useState<"eip155" | "solana" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showNetworks, setShowNetworks] = useState(false);
  const [copied, setCopied] = useState(false);
  const connectingRef = useRef(false);

  const phantomSolana = typeof window !== "undefined" ? getPhantomSolana() : null;
  const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

  const resolveConnector = useCallback(
    (wallet: WalletConfig) => {
      if (wallet.id === "walletconnect") {
        return connectors.find((c) => c.id === "walletConnect" || c.name.toLowerCase().includes("walletconnect"));
      }
      return connectors.find((item) => {
        const rdns = "rdns" in item ? String(item.rdns ?? "") : "";
        if (wallet.rdns && rdns === wallet.rdns) return true;
        if (wallet.nameMatch && item.name.toLowerCase().includes(wallet.nameMatch)) return true;
        return false;
      });
    },
    [connectors],
  );

  const walletAvailability = useMemo(() => {
    const map = new Map<WalletId, boolean>();
    for (const wallet of [...PRIMARY_WALLETS, ...EXPANDED_WALLETS]) {
      if (wallet.id === "phantom") {
        map.set(wallet.id, Boolean(resolveConnector(wallet) || phantomSolana));
      } else if (wallet.id === "robinhood-eth") {
        map.set(wallet.id, Boolean(walletConnectProjectId));
      } else if (wallet.id === "walletconnect") {
        map.set(wallet.id, Boolean(walletConnectProjectId && resolveConnector(wallet)));
      } else {
        map.set(wallet.id, Boolean(resolveConnector(wallet)));
      }
    }
    return map;
  }, [resolveConnector, phantomSolana, walletConnectProjectId]);

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
    async (wallet: WalletConfig) => {
      const connector = resolveConnector(wallet);
      if (!connector) {
        setConnectionStatus("unavailable");
        setError(`${wallet.name} not detected. Install the extension or choose another wallet.`);
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
        statement: "Trade2Credits wants you to sign in",
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
    },
    [connectAsync, resolveConnector, signMessageAsync],
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
  }, []);

  const connectWallet = useCallback(
    async (walletId: WalletId) => {
      if (connectingRef.current) return;
      connectingRef.current = true;
      setSelectedWalletId(walletId);
      setError(null);

      const wallet = [...PRIMARY_WALLETS, ...EXPANDED_WALLETS].find((w) => w.id === walletId);
      if (!wallet) {
        connectingRef.current = false;
        return;
      }

      if (!walletAvailability.get(walletId)) {
        setConnectionStatus("unavailable");
        if (wallet.id === "robinhood-eth") {
          setError(
            walletConnectProjectId
              ? "Robinhood Wallet connects via WalletConnect. Set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID and scan with the Robinhood app."
              : "Robinhood Wallet connects via WalletConnect. Add NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID to enable it.",
          );
        } else {
          setError(`${wallet.name} not detected. Install ${wallet.name} or choose another wallet.`);
        }
        connectingRef.current = false;
        return;
      }

      try {
        if (wallet.id === "robinhood-eth" || wallet.id === "walletconnect") {
          await loginEvm({ ...wallet, id: "walletconnect", name: "WalletConnect" });
        } else if (wallet.id === "phantom" && !resolveConnector(wallet) && phantomSolana) {
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
    [
      walletAvailability,
      walletConnectProjectId,
      loginEvm,
      loginPhantomSolana,
      resolveConnector,
      phantomSolana,
      disconnectAsync,
    ],
  );

  const disconnect = useCallback(async () => {
    await fetch("/api/v1/auth/logout", { method: "POST", credentials: "same-origin" }).catch(
      () => undefined,
    );
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
    () => [...PRIMARY_WALLETS, ...EXPANDED_WALLETS].find((w) => w.id === selectedWalletId) ?? null,
    [selectedWalletId],
  );

  const displayAddress = connectedAddress ?? liveAddress ?? null;
  const isBusy = connectionStatus === "connecting" || connectionStatus === "signing";

  return {
    selectedWallet,
    selectedWalletId,
    connectionStatus,
    connectedAddress: displayAddress,
    connectedNamespace,
    chainId,
    balance: balanceData ? formatEthBalance(balanceData.value, balanceData.decimals) : null,
    balanceSymbol: balanceData?.symbol ?? "ETH",
    error,
    isExpanded,
    setIsExpanded,
    showNetworks,
    setShowNetworks,
    copied,
    walletAvailability,
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
