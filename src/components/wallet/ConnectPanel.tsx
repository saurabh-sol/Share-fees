"use client";

import { ArrowSquareOut, WarningCircle, Wallet } from "@phosphor-icons/react";
import { getAddress } from "viem";
import { createSiweMessage } from "viem/siwe";
import { useMemo, useState } from "react";
import { useConnect, useConnectors, useDisconnect, useSignMessage } from "wagmi";
import { useRouter } from "next/navigation";
import { PRIMARY_WALLET_MATCHERS } from "@/lib/wallet/wagmi";
import { encodeSignature, getPhantomSolana } from "@/lib/wallet/phantom";

function buildClientSiwsMessage(input: {
  address: string;
  nonce: string;
  issuedAt: string;
  expirationTime: string;
}) {
  return [
    `${window.location.host} wants you to sign in with your Solana account:`,
    input.address,
    "",
    `URI: ${window.location.origin}`,
    "Version: 1",
    `Nonce: ${input.nonce}`,
    `Issued At: ${input.issuedAt}`,
    `Expiration Time: ${input.expirationTime}`,
  ].join("\n");
}

type Status = "idle" | "connecting" | "signing" | "error";

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as { error?: string; message?: string; nonce?: string; issuedAt?: string; expirationTime?: string };
  if (!response.ok) {
    throw new Error(data.message ?? data.error ?? "request_failed");
  }
  return data;
}

export function ConnectPanel() {
  const router = useRouter();
  const connectors = useConnectors();
  const { connectAsync } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const phantomSolana = typeof window !== "undefined" ? getPhantomSolana() : null;

  const detected = useMemo(() => {
    return PRIMARY_WALLET_MATCHERS.map((wallet) => {
      const connector = connectors.find((item) => {
        const rdns = "rdns" in item ? String(item.rdns ?? "") : "";
        return wallet.match(item.name, rdns);
      });
      return { ...wallet, connector, detected: Boolean(connector) };
    });
  }, [connectors]);

  async function loginEvm(connector: (typeof connectors)[number]) {
    setStatus("connecting");
    setError(null);
    const connection = await connectAsync({ connector });
    const raw = connection.accounts[0];
    if (!raw) throw new Error("No account returned from wallet.");
    const address = getAddress(raw);

    setStatus("signing");
    const nonceRes = await postJson("/api/v1/auth/nonce", {
      chainNamespace: "eip155",
      address,
    });
    const domain = window.location.host;
    const message = createSiweMessage({
      address,
      chainId: connection.chainId,
      domain,
      nonce: nonceRes.nonce ?? "",
      uri: window.location.origin,
      version: "1",
      statement: "Trade2Credits wants you to sign in",
      issuedAt: nonceRes.issuedAt ? new Date(nonceRes.issuedAt) : new Date(),
      expirationTime: nonceRes.expirationTime ? new Date(nonceRes.expirationTime) : undefined,
    });
    const signature = await signMessageAsync({ message });
    await postJson("/api/v1/auth/verify", {
      chainNamespace: "eip155",
      address,
      message,
      signature,
    });
    router.push("/app");
    router.refresh();
  }

  async function loginPhantomSolana() {
    const provider = getPhantomSolana();
    if (!provider) throw new Error("Phantom Solana was not detected.");
    setStatus("connecting");
    setError(null);
    const connected = await provider.connect();
    const address = connected.publicKey.toString();
    setStatus("signing");
    const nonceRes = await postJson("/api/v1/auth/nonce", {
      chainNamespace: "solana",
      address,
    });
    if (!nonceRes.nonce || !nonceRes.issuedAt || !nonceRes.expirationTime) {
      throw new Error("Nonce response was incomplete.");
    }
    const message = buildClientSiwsMessage({
      address,
      nonce: nonceRes.nonce,
      issuedAt: nonceRes.issuedAt,
      expirationTime: nonceRes.expirationTime,
    });
    const signed = await provider.signMessage(new TextEncoder().encode(message), "utf8");
    await postJson("/api/v1/auth/verify", {
      chainNamespace: "solana",
      address,
      message,
      signature: `0x${encodeSignature(signed.signature)}`,
    });
    router.push("/app");
    router.refresh();
  }

  async function onWalletClick(wallet: (typeof detected)[number]) {
    try {
      if (wallet.id === "phantom" && !wallet.connector && phantomSolana) {
        await loginPhantomSolana();
        return;
      }
      if (!wallet.connector) return;
      await loginEvm(wallet.connector);
    } catch (err) {
      await disconnectAsync().catch(() => undefined);
      setStatus("error");
      setError(err instanceof Error ? err.message : "Wallet sign-in failed.");
    }
  }

  const anyDetected = detected.some((wallet) => wallet.detected) || Boolean(phantomSolana);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Detected extensions</p>
        <div className="mt-4 divide-y divide-white/8 border-y border-white/8">
          {detected.map((wallet) => {
            const ready = wallet.detected || (wallet.id === "phantom" && Boolean(phantomSolana));
            return (
              <button
                key={wallet.id}
                type="button"
                disabled={!ready || status === "connecting" || status === "signing"}
                onClick={() => onWalletClick(wallet)}
                className="flex w-full items-center justify-between py-4 text-left transition-transform active:scale-[0.99] disabled:opacity-40"
              >
                <span className="flex items-center gap-3 text-zinc-100">
                  <Wallet size={18} weight="regular" />
                  {wallet.label}
                </span>
                {ready ? (
                  <span className="font-mono text-xs text-[#c23a3a]">Ready</span>
                ) : (
                  <a
                    href={wallet.installUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-xs text-zinc-500"
                    onClick={(event) => event.stopPropagation()}
                  >
                    Install <ArrowSquareOut size={12} />
                  </a>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {!anyDetected ? (
        <div className="flex items-start gap-3 text-sm text-zinc-400">
          <WarningCircle size={18} className="mt-0.5 shrink-0" />
          <p>No supported extension was found. Install MetaMask, Phantom, or Coinbase Wallet, then refresh.</p>
        </div>
      ) : null}

      {status === "signing" || status === "connecting" ? (
        <p className="font-mono text-xs text-zinc-500">
          {status === "connecting" ? "Requesting wallet connection…" : "Sign the login message to open a session."}
        </p>
      ) : null}

      {error ? (
        <p className="text-sm text-[#c23a3a]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
