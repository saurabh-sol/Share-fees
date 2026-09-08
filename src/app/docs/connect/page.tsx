import type { Metadata } from "next";
import { docsPageTitle } from "@/lib/brand";
import Link from "next/link";
import { DocsCallout, DocsH1, DocsH2, DocsLead, DocsP, DocsUl } from "@/components/docs/DocsPrimitives";
import { DocsPager } from "@/components/docs/DocsPager";

export const metadata: Metadata = {
  title: docsPageTitle("Connect a wallet"),
  description: "Sign in to Accrued with SIWE or SIWS. There is no email account.",
};

export default function ConnectDocsPage() {
  return (
    <>
      <DocsH1>Connect a wallet</DocsH1>
      <DocsLead>
        Open{" "}
        <Link href="/login" className="text-zinc-100 underline decoration-white/20 underline-offset-4">
          /login
        </Link>
        . Detected extensions appear with their official icons. You sign a login message. That address is the
        desk.
      </DocsLead>

      <DocsH2 id="sign-in">Sign in</DocsH2>
      <DocsP>
        Ethereum wallets sign SIWE. Solana wallets sign SIWS. The desk never asks for a password or an email.
        If the wallet rejects the request, nothing is recorded. Try again.
      </DocsP>
      <DocsCallout title="Same address later">
        Reconnect the same wallet to return to the same balances. A different address is a different desk.
      </DocsCallout>

      <DocsH2 id="supported-wallets">Supported wallets</DocsH2>
      <DocsUl>
        <li>MetaMask and other EIP-6963 injected EVM wallets.</li>
        <li>Phantom (Solana and, when injected, EVM).</li>
        <li>Coinbase Wallet when the extension is present.</li>
        <li>WalletConnect only if a project id is configured. If that row is missing, ignore it.</li>
      </DocsUl>

      <DocsH2 id="what-the-session-binds">What the session binds</DocsH2>
      <DocsP>
        Credit, convert, redeem, and Chat all run against the signed-in address. USDG can only pay to that EVM
        address on Robinhood Chain. Solana sessions cannot withdraw USDG; they can still take LLM credits.
      </DocsP>
      <DocsP>
        After you sign, the desk opens at{" "}
        <Link href="/app" className="text-zinc-100 underline decoration-white/20 underline-offset-4">
          /app
        </Link>
        . Next stop is usually{" "}
        <Link href="/docs/swap" className="text-zinc-100 underline decoration-white/20 underline-offset-4">
          Swap Studio
        </Link>{" "}
        or{" "}
        <Link href="/docs/activity" className="text-zinc-100 underline decoration-white/20 underline-offset-4">
          Activity
        </Link>
        .
      </DocsP>
      <DocsPager href="/docs/connect" />
    </>
  );
}
