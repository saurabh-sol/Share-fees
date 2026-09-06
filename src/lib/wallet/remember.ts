export const LAST_WALLET_KEY = "t2c_last_wallet";
export const IDLE_RECONNECT_MS = 10 * 60 * 1000;

export type RememberedWallet = {
  id: string;
  connectorUid: string | null;
  kind: "evm" | "solana";
  address: string;
};

function storage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function rememberWallet(wallet: RememberedWallet) {
  storage()?.setItem(LAST_WALLET_KEY, JSON.stringify(wallet));
}

export function readRememberedWallet(): RememberedWallet | null {
  try {
    const raw = storage()?.getItem(LAST_WALLET_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RememberedWallet>;
    if (
      typeof parsed.id !== "string" ||
      (parsed.kind !== "evm" && parsed.kind !== "solana") ||
      typeof parsed.address !== "string"
    ) {
      return null;
    }
    return {
      id: parsed.id,
      connectorUid: typeof parsed.connectorUid === "string" ? parsed.connectorUid : null,
      kind: parsed.kind,
      address: parsed.address,
    };
  } catch {
    return null;
  }
}

export function forgetWallet() {
  storage()?.removeItem(LAST_WALLET_KEY);
}
