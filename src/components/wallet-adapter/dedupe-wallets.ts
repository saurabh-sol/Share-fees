export type WalletIdentity = {
  id: string;
  name: string;
  rdns?: string | null;
  iconUrl?: string | null;
  connectorUid?: string | null;
  kind?: "evm" | "solana";
};

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9.]/g, "");
}

/** One key per installed extension family. Flask stays separate. */
export function walletFamilyKey(input: {
  rdns?: string | null;
  name: string;
  id?: string | null;
}): string {
  const rdns = normalize(input.rdns ?? "");
  const name = normalize(input.name);
  const id = normalize(input.id ?? "");

  if (rdns === "io.metamask.flask" || name.includes("metamaskflask")) {
    return "family:metamask-flask";
  }
  if (
    rdns === "io.metamask" ||
    rdns.startsWith("io.metamask.") ||
    name.includes("metamask") ||
    id.includes("metamask")
  ) {
    return "family:metamask";
  }
  if (rdns === "app.phantom" || name.includes("phantom") || id.includes("phantom")) {
    return "family:phantom";
  }
  if (
    rdns === "com.coinbase.wallet" ||
    name.includes("coinbase") ||
    id.includes("coinbase")
  ) {
    return "family:coinbase";
  }
  if (rdns === "app.backpack" || name.includes("backpack")) return "family:backpack";
  if (rdns === "io.rabby" || name.includes("rabby")) return "family:rabby";
  if (rdns === "me.rainbow" || name.includes("rainbow")) return "family:rainbow";
  if (rdns === "app.okx.wallet" || name.includes("okx")) return "family:okx";
  if (rdns === "com.brave.wallet" || name.includes("brave")) return "family:brave";
  if (rdns === "com.trustwallet.app" || name.includes("trustwallet") || name === "trust") {
    return "family:trust";
  }

  if (rdns) return `rdns:${rdns}`;
  if (name) return `name:${name}`;
  return `id:${id || "unknown"}`;
}

function score(wallet: WalletIdentity): number {
  let value = 0;
  if (wallet.iconUrl) value += 8;
  if (wallet.rdns) value += 4;
  if (wallet.kind === "evm") value += 1;
  return value;
}

export function dedupeWallets<T extends WalletIdentity>(wallets: T[]): T[] {
  const best = new Map<string, T>();

  for (const wallet of wallets) {
    const key = walletFamilyKey({
      rdns: wallet.rdns,
      name: wallet.name,
      id: wallet.id,
    });
    const current = best.get(key);
    if (!current || score(wallet) > score(current)) {
      best.set(key, wallet);
    }
  }

  return [...best.values()].sort((a, b) => a.name.localeCompare(b.name));
}
