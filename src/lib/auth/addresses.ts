import { getAddress, isAddress } from "viem";

export type ChainNamespace = "eip155" | "solana";

const SOLANA_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function normalizeAddress(namespace: ChainNamespace, raw: string): string {
  const trimmed = raw.trim();
  if (namespace === "eip155") {
    if (!isAddress(trimmed)) {
      throw new Error("invalid_evm_address");
    }
    return getAddress(trimmed).toLowerCase();
  }
  if (!SOLANA_RE.test(trimmed)) {
    throw new Error("invalid_solana_address");
  }
  return trimmed;
}

export function assertTxHash(namespace: ChainNamespace, hash: string): string {
  const value = hash.trim();
  if (namespace === "eip155") {
    if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
      throw new Error("invalid_evm_tx_hash");
    }
    return value.toLowerCase();
  }
  if (!/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(value)) {
    throw new Error("invalid_solana_signature");
  }
  return value;
}
