import type { BaseConnectedEthereumWallet, ConnectedWallet } from "@privy-io/react-auth";
import { createSiweMessage } from "viem/siwe";
import { getAddress, type Address } from "viem";
import { SIWE_STATEMENT } from "@/lib/brand";
import { rememberWallet } from "@/lib/wallet/remember";
import { resolvePrivyWalletIcon } from "@/lib/wallet/resolve-wallet-icon";

type NonceResponse = {
  nonce?: string;
  issuedAt?: string;
  expirationTime?: string;
};

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as T & { error?: string; message?: string };
  if (!response.ok) {
    throw new Error(data.message ?? data.error ?? "request_failed");
  }
  return data;
}

/** Privy wallet connected — finish Accrued desk session with SIWE. */
export async function completeAccruedSession(wallet: BaseConnectedEthereumWallet | ConnectedWallet) {
  if (wallet.type !== "ethereum") {
    throw new Error("Only Ethereum wallets are supported.");
  }

  const address = getAddress(wallet.address as Address);
  const provider = await wallet.getEthereumProvider();

  const nonceRes = await postJson<NonceResponse>("/api/v1/auth/nonce", {
    chainNamespace: "eip155",
    address,
  });

  const message = createSiweMessage({
    address,
    chainId: Number.parseInt((await provider.request({ method: "eth_chainId" })) as string, 16),
    domain: window.location.host,
    nonce: nonceRes.nonce ?? "",
    uri: window.location.origin,
    version: "1",
    statement: SIWE_STATEMENT,
    issuedAt: nonceRes.issuedAt ? new Date(nonceRes.issuedAt) : new Date(),
    expirationTime: nonceRes.expirationTime ? new Date(nonceRes.expirationTime) : undefined,
  });

  const signature = (await provider.request({
    method: "personal_sign",
    params: [message, address],
  })) as string;

  await postJson("/api/v1/auth/verify", {
    chainNamespace: "eip155",
    address,
    message,
    signature,
  });

  const iconUrl = await resolvePrivyWalletIcon(wallet);
  rememberWallet({
    id: wallet.walletClientType ?? "privy-evm",
    connectorUid: wallet.walletClientType ?? null,
    kind: "evm",
    address,
  });

  return { address, iconUrl };
}
