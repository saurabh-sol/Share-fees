import type { Metadata } from "next";
import Link from "next/link";
import { DocsH1, DocsH2, DocsLead, DocsP, DocsUl } from "@/components/docs/DocsPrimitives";
import { DocsPager } from "@/components/docs/DocsPager";
import { docsPageTitle } from "@/lib/brand";

export const metadata: Metadata = {
  title: docsPageTitle("Introduction"),
  description: "What Accrued is, who it is for, and how credit moves from a swap to a rail.",
};

const MAP = [
  { href: "/docs/how-it-pays", title: "How it pays", body: "Six steps from a signed wallet to posted credit." },
  { href: "/docs/swap", title: "Swap Studio", body: "Quote and settle a live fill. The same rule engine prices it." },
  { href: "/docs/activity", title: "Activity", body: "Scan history or import a hash, then claim website credit." },
  { href: "/docs/usdg", title: "USDG", body: "On-chain vault claim to the signed-in EVM address on Robinhood." },
  { href: "/docs/llm", title: "LLM credits", body: "Mint an acc_ key. Usage burns remaining cents." },
  { href: "/docs/api", title: "API", body: "Point the official vendor SDK at this origin." },
];

export default function DocsHomePage() {
  return (
    <>
      <DocsH1>You swap. We credit.</DocsH1>
      <DocsLead>
        Accrued is a wallet-native rewards desk. Qualifying token swaps convert at a published ratio into
        website credit. That credit can be taken as USDG to the same wallet, or as LLM credits for Claude, OpenAI,
        DeepSeek, Google, and Grok-compatible clients.
      </DocsLead>

      <DocsH2 id="what-it-is">What it is</DocsH2>
      <DocsP>
        There is no email account and no username. The address that signs in is the desk. Ethereum wallets sign
        SIWE. Solana wallets sign SIWS. The session stays bound to that address.
      </DocsP>
      <DocsP>
        Notional is the USD value of the fill, not the token amount. A $40 swap in a large-cap token is still $40.
        Changing the published rule later does not rewrite rows that already posted.
      </DocsP>

      <DocsH2 id="who-it-is-for">Who it is for</DocsH2>
      <DocsUl>
        <li>Anyone with an injected EVM or Solana wallet that can sign a login message.</li>
        <li>USDG redeem is EVM-only. Solana sessions still take LLM credits and can use Chat.</li>
        <li>Developers who want a metered acc_ key in Cursor or any OpenAI-compatible client.</li>
      </DocsUl>

      <DocsH2 id="the-walk">The walk</DocsH2>
      <DocsP>
        Connect at <Link href="/login" className="text-zinc-100 underline decoration-white/20 underline-offset-4">/login</Link>.
        Swap live or bring history. Clear $250 of confirmed swap volume. Credit posts at 50 bps. Convert 1:1 to a
        rail, then redeem. The same transaction on the same chain never pays twice.
      </DocsP>
      <div className="mt-8 grid grid-cols-1 border-y border-white/8 md:grid-cols-2">
        {MAP.map((item, index) => (
          <Link
            key={item.href}
            href={item.href}
            className={`border-b border-white/8 px-0 py-6 md:px-6 ${
              index % 2 === 0 ? "md:border-r md:pl-0" : "md:pr-0"
            } ${index >= MAP.length - 2 ? "md:border-b-0" : ""}`}
          >
            <p className="text-sm text-zinc-100">{item.title}</p>
            <p className="mt-2 max-w-[46ch] text-sm leading-relaxed text-zinc-500">{item.body}</p>
          </Link>
        ))}
      </div>

      <DocsH2 id="three-balances">Three balances, one ledger</DocsH2>
      <DocsP>
        Website credit, USDG, and LLM are the same liability, different rails. Convert moves value 1:1. The desk
        does not invent a second balance. Read the{" "}
        <Link href="/docs/balances" className="text-zinc-100 underline decoration-white/20 underline-offset-4">
          balances
        </Link>{" "}
        page before you convert, and the{" "}
        <Link href="/docs/rules" className="text-zinc-100 underline decoration-white/20 underline-offset-4">
          constraints
        </Link>{" "}
        before you assume a fill will pay.
      </DocsP>
      <DocsPager href="/docs" />
    </>
  );
}
