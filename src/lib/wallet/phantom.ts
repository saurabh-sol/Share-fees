export type PhantomSolana = {
  isPhantom?: boolean;
  publicKey?: { toString(): string };
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString(): string } }>;
  signMessage: (
    message: Uint8Array,
    encoding?: string,
  ) => Promise<{ signature: Uint8Array }>;
};

export function getPhantomSolana(): PhantomSolana | null {
  if (typeof window === "undefined") return null;
  const injected = window as Window & {
    phantom?: { solana?: PhantomSolana };
    solana?: PhantomSolana;
  };
  const provider = injected.phantom?.solana ?? injected.solana;
  if (provider?.isPhantom) return provider;
  return null;
}

export function encodeSignature(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}
