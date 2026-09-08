import type { Metadata } from "next";
import { docsPageTitle } from "@/lib/brand";
import Link from "next/link";
import { DocsH1, DocsH2, DocsLead, DocsP } from "@/components/docs/DocsPrimitives";
import { DocsPager } from "@/components/docs/DocsPager";

export const metadata: Metadata = {
  title: docsPageTitle("FAQ"),
  description: "Short answers before you connect a wallet to Accrued.",
};

export default function FaqDocsPage() {
  return (
    <>
      <DocsH1>FAQ</DocsH1>
      <DocsLead>Short answers. The ledger does not invent a second story after you sign.</DocsLead>

      <DocsH2 id="who">Who can use it</DocsH2>
      <DocsP>
        Any EVM or Solana wallet that can sign SIWE or SIWS. USDG redeem is EVM-only. Solana sessions still
        take LLM credits and can use Chat. See{" "}
        <Link href="/docs/connect" className="text-zinc-100 underline decoration-white/20 underline-offset-4">
          Connect a wallet
        </Link>
        .
      </DocsP>

      <DocsH2 id="pay">When a swap pays</DocsH2>
      <DocsP>
        After the connected wallet clears $250 of confirmed swap volume, each later fill at or above $250 can
        credit at 50 bps, until the $2,500 daily cap. Sends do not count. Details on{" "}
        <Link href="/docs/how-it-pays" className="text-zinc-100 underline decoration-white/20 underline-offset-4">
          How it pays
        </Link>
        .
      </DocsP>

      <DocsH2 id="old-hash">Old hashes</DocsH2>
      <DocsP>
        Open Activity, scan the wallet or paste a hash the desk can verify. Claim writes website credit.
        Convert, then redeem. A single imported fill still has to be $250+ to claim on its own.
      </DocsP>

      <DocsH2 id="after-redeem">After redeem</DocsH2>
      <DocsP>
        USDG is an on-chain vault claim to this wallet on Robinhood. LLM mints an acc_ key for the provider you
        picked. Use the official OpenAI, Anthropic, DeepSeek, or Google API against this origin. Usage spends
        remaining cents. The key is shown once.
      </DocsP>
      <DocsP>
        A fill that did not credit is usually below the floor, over the daily cap, a duplicate hash, or a wash
        hold. The row stays on Activity either way.
      </DocsP>
      <DocsPager href="/docs/faq" />
    </>
  );
}
