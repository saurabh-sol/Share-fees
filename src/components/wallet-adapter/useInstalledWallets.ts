"use client";

import { useEffect, useMemo, useState } from "react";
import type { Connector } from "wagmi";
import { useConnectors } from "wagmi";
import { getPhantomSolana } from "@/lib/wallet/phantom";
import type { DiscoveredWallet } from "./wallet-config";
import { dedupeWallets } from "./dedupe-wallets";

type Eip6963Info = {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
};

type Eip6963AnnounceDetail = {
  info: Eip6963Info;
  provider: unknown;
};

function connectorRdns(connector: Connector): string {
  return "rdns" in connector ? String(connector.rdns ?? "") : "";
}

function isInstalledExtension(connector: Connector): boolean {
  const id = connector.id.toLowerCase();
  const type = connector.type.toLowerCase();
  if (id === "injected" || id === "walletconnect" || type === "walletconnect") {
    return false;
  }
  if (connectorRdns(connector)) return true;
  return type === "injected";
}

export function useInstalledWallets() {
  const connectors = useConnectors();
  const [announced, setAnnounced] = useState<Eip6963Info[]>([]);
  const [phantomReady, setPhantomReady] = useState(false);

  useEffect(() => {
    function onAnnounce(event: Event) {
      const detail = (event as CustomEvent<Eip6963AnnounceDetail>).detail;
      const info = detail?.info;
      if (!info?.rdns) return;
      setAnnounced((prev) => {
        if (prev.some((item) => item.rdns === info.rdns)) return prev;
        return [...prev, info];
      });
    }

    window.addEventListener("eip6963:announceProvider", onAnnounce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    setPhantomReady(Boolean(getPhantomSolana()));

    return () => window.removeEventListener("eip6963:announceProvider", onAnnounce);
  }, []);

  const wallets = useMemo(() => {
    const raw: DiscoveredWallet[] = [];

    for (const connector of connectors) {
      if (!isInstalledExtension(connector)) continue;
      const rdns = connectorRdns(connector);
      const announcedMatch = announced.find(
        (item) =>
          item.rdns === rdns || item.name.toLowerCase() === connector.name.toLowerCase(),
      );

      raw.push({
        id: connector.uid,
        name: announcedMatch?.name || connector.name,
        description: `Connect with ${announcedMatch?.name || connector.name}`,
        iconUrl: announcedMatch?.icon || connector.icon || null,
        connectorUid: connector.uid,
        kind: "evm",
        rdns: rdns || announcedMatch?.rdns,
      });
    }

    const unique = dedupeWallets(raw);

    const hasPhantom = unique.some(
      (wallet) =>
        wallet.rdns === "app.phantom" || wallet.name.toLowerCase().includes("phantom"),
    );
    if (phantomReady && !hasPhantom) {
      const phantomIcon = announced.find((item) => item.rdns === "app.phantom")?.icon ?? null;
      unique.push({
        id: "solana:phantom",
        name: "Phantom",
        description: "Connect with Phantom",
        iconUrl: phantomIcon,
        connectorUid: null,
        kind: "solana",
        rdns: "app.phantom",
      });
    }

    return unique.sort((a, b) => a.name.localeCompare(b.name));
  }, [announced, connectors, phantomReady]);

  return { wallets, connectors };
}
