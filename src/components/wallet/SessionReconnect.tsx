"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getAddress } from "viem";
import { reconnect } from "wagmi/actions";
import { useAccount, useConnect, useConnectors } from "wagmi";
import { getPhantomSolana } from "@/lib/wallet/phantom";
import { IDLE_RECONNECT_MS, readRememberedWallet } from "@/lib/wallet/remember";
import { wagmiConfig } from "@/lib/wallet/wagmi";

type SessionPayload = {
  user?: {
    address?: string;
    chainNamespace?: string;
  };
};

async function readLiveSession(): Promise<SessionPayload["user"] | null> {
  const response = await fetch("/api/v1/auth/session", {
    credentials: "include",
    cache: "no-store",
  });
  if (!response.ok) return null;
  const body = (await response.json()) as SessionPayload;
  return body.user ?? null;
}

function sameAddress(left: string, right: string) {
  try {
    return getAddress(left) === getAddress(right);
  } catch {
    return left.toLowerCase() === right.toLowerCase();
  }
}

export function SessionReconnect() {
  const router = useRouter();
  const pathname = usePathname();
  const { address, isConnected } = useAccount();
  const { connectAsync } = useConnect();
  const connectors = useConnectors();
  const busyRef = useRef(false);
  const hiddenAtRef = useRef<number | null>(null);
  const accountRef = useRef({ address, isConnected });
  const connectRef = useRef(connectAsync);
  const connectorsRef = useRef(connectors);
  const pathnameRef = useRef(pathname);

  accountRef.current = { address, isConnected };
  connectRef.current = connectAsync;
  connectorsRef.current = connectors;
  pathnameRef.current = pathname;

  useEffect(() => {
    async function restore() {
      if (busyRef.current) return;
      busyRef.current = true;
      try {
        const session = await readLiveSession();
        if (!session?.address) return;

        if (pathnameRef.current === "/login") {
          router.replace("/app");
          router.refresh();
        }

        if (session.chainNamespace === "solana") {
          const phantom = getPhantomSolana();
          if (!phantom) return;
          await phantom.connect({ onlyIfTrusted: true }).catch(() => undefined);
          return;
        }

        const live = accountRef.current;
        if (live.isConnected && live.address && sameAddress(live.address, session.address)) {
          return;
        }

        await reconnect(wagmiConfig).catch(() => undefined);
        const remembered = readRememberedWallet();
        const available = connectorsRef.current;
        const connector =
          available.find((item) => item.uid === remembered?.connectorUid) ??
          available.find((item) => item.id === remembered?.id) ??
          available.find((item) => item.name.toLowerCase().includes("metamask")) ??
          available[0];
        if (!connector) return;
        await connectRef.current({ connector }).catch(() => undefined);
      } finally {
        busyRef.current = false;
      }
    }

    void restore();

    function onVisibility() {
      if (document.visibilityState === "hidden") {
        hiddenAtRef.current = Date.now();
        return;
      }
      const hiddenAt = hiddenAtRef.current;
      hiddenAtRef.current = null;
      if (hiddenAt == null || Date.now() - hiddenAt < IDLE_RECONNECT_MS) return;
      void restore();
    }

    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) void restore();
    }

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [router]);

  return null;
}
