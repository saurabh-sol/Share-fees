import { recoverMessageAddress } from "viem";
import { parseSiweMessage } from "viem/siwe";
import { appDomain, env } from "@/lib/env";

export function expectedSiweDomain() {
  return appDomain();
}

export async function verifySiweLogin(message: string, signature: `0x${string}`) {
  const parsed = parseSiweMessage(message);
  if (!parsed.address || !parsed.nonce || !parsed.domain || !parsed.uri) {
    throw new Error("malformed_siwe");
  }
  if (parsed.domain !== expectedSiweDomain()) {
    throw new Error("siwe_domain_mismatch");
  }
  const uri = new URL(parsed.uri);
  const allowed = new URL(env.appOrigin);
  if (uri.origin !== allowed.origin) {
    throw new Error("siwe_uri_mismatch");
  }
  if (parsed.expirationTime && parsed.expirationTime.getTime() <= Date.now()) {
    throw new Error("siwe_expired");
  }
  const recovered = await recoverMessageAddress({ message, signature });
  if (recovered.toLowerCase() !== parsed.address.toLowerCase()) {
    throw new Error("siwe_signature_mismatch");
  }
  return parsed;
}
