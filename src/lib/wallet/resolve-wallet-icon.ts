import type { BaseConnectedEthereumWallet } from "@privy-io/react-auth";

const KNOWN_WALLET_ICONS: Record<string, string> = {
  metamask: "/wallets/metamask.svg",
  coinbase_wallet: "/wallets/coinbase.svg",
  coinbase: "/wallets/coinbase.svg",
  robinhood_wallet: "/wallets/robinhood.svg",
  robinhood: "/wallets/robinhood.svg",
  phantom: "/wallets/phantom.svg",
  rainbow: "/wallets/rainbow.svg",
};

function metaIconUrl(icon: BaseConnectedEthereumWallet["meta"]["icon"]): string | null {
  if (typeof icon === "string" && icon.trim().length > 0) return icon;
  return null;
}

function knownWalletIcon(wallet: BaseConnectedEthereumWallet): string | null {
  const keys = [
    wallet.walletClientType?.toLowerCase() ?? "",
    wallet.meta.id?.toLowerCase() ?? "",
    wallet.meta.name.toLowerCase(),
  ].filter(Boolean);

  for (const key of keys) {
    if (KNOWN_WALLET_ICONS[key]) return KNOWN_WALLET_ICONS[key];
    for (const [id, url] of Object.entries(KNOWN_WALLET_ICONS)) {
      if (key.includes(id) || id.includes(key)) return url;
    }
  }
  return null;
}

function collectEip6963Icons(): Promise<Map<string, string>> {
  if (typeof window === "undefined") return Promise.resolve(new Map());

  return new Promise((resolve) => {
    const icons = new Map<string, string>();

    function onAnnounce(event: Event) {
      const detail = (event as CustomEvent<{ info?: { rdns?: string; name?: string; icon?: string } }>)
        .detail;
      const info = detail?.info;
      if (!info?.icon) return;
      if (info.rdns) icons.set(info.rdns.toLowerCase(), info.icon);
      if (info.name) icons.set(info.name.toLowerCase(), info.icon);
    }

    window.addEventListener("eip6963:announceProvider", onAnnounce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));

    window.setTimeout(() => {
      window.removeEventListener("eip6963:announceProvider", onAnnounce);
      resolve(icons);
    }, 280);
  });
}

function eip6963Icon(
  wallet: BaseConnectedEthereumWallet,
  announced: Map<string, string>,
): string | null {
  const keys = [
    wallet.meta.id?.toLowerCase() ?? "",
    wallet.walletClientType?.toLowerCase() ?? "",
    wallet.meta.name.toLowerCase(),
  ].filter(Boolean);

  for (const key of keys) {
    const direct = announced.get(key);
    if (direct) return direct;
    for (const [rdns, icon] of announced) {
      if (key.includes(rdns) || rdns.includes(key)) return icon;
    }
  }
  return null;
}

export async function resolvePrivyWalletIcon(
  wallet: BaseConnectedEthereumWallet,
): Promise<string | null> {
  return (
    metaIconUrl(wallet.meta.icon) ??
    eip6963Icon(wallet, await collectEip6963Icons()) ??
    knownWalletIcon(wallet)
  );
}
