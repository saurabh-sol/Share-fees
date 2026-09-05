import nacl from "tweetnacl";
import bs58 from "bs58";
import { appDomain, env } from "@/lib/env";

export function buildSiwsMessage(input: {
  address: string;
  nonce: string;
  issuedAt: string;
  expirationTime: string;
}) {
  return [
    `${appDomain()} wants you to sign in with your Solana account:`,
    input.address,
    "",
    "URI: " + env.appOrigin,
    "Version: 1",
    `Nonce: ${input.nonce}`,
    `Issued At: ${input.issuedAt}`,
    `Expiration Time: ${input.expirationTime}`,
  ].join("\n");
}

function decodeSignature(signature: string): Uint8Array {
  if (signature.startsWith("0x")) {
    const hex = signature.slice(2);
    if (hex.length % 2 !== 0) throw new Error("invalid_signature");
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
  }
  return bs58.decode(signature);
}

export function verifySiwsLogin(input: {
  address: string;
  message: string;
  signature: string;
}) {
  if (!input.message.includes("Nonce: ")) {
    throw new Error("malformed_siws");
  }
  if (!input.message.includes(`${appDomain()} wants you to sign in with your Solana account:`)) {
    throw new Error("siws_domain_mismatch");
  }
  if (!input.message.includes(`URI: ${env.appOrigin}`)) {
    throw new Error("siws_uri_mismatch");
  }
  if (!input.message.includes(input.address)) {
    throw new Error("siws_address_mismatch");
  }

  const expiration = /Expiration Time: (.+)/.exec(input.message)?.[1];
  if (expiration && new Date(expiration).getTime() <= Date.now()) {
    throw new Error("siws_expired");
  }

  const ok = nacl.sign.detached.verify(
    new TextEncoder().encode(input.message),
    decodeSignature(input.signature),
    bs58.decode(input.address),
  );
  if (!ok) {
    throw new Error("siws_signature_mismatch");
  }
}

export function extractSiwsNonce(message: string): string {
  const match = /Nonce: ([A-Za-z0-9]+)/.exec(message);
  if (!match?.[1]) throw new Error("siws_nonce_missing");
  return match[1];
}
