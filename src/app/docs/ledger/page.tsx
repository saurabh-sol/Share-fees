import type { Metadata } from "next";
import { docsPageTitle } from "@/lib/brand";
import Link from "next/link";
import { DocsH1, DocsH2, DocsLead, DocsP } from "@/components/docs/DocsPrimitives";
import { DocsPager } from "@/components/docs/DocsPager";

export const metadata: Metadata = {
  title: docsPageTitle("Ledger"),
  description: "Every Accrued credit, convert, and redeem writes an immutable row.",
};

export default function LedgerDocsPage() {
  return (
    <>
      <DocsH1>Ledger</DocsH1>
      <DocsLead>
        <Link href="/app/rewards" className="text-zinc-100 underline decoration-white/20 underline-offset-4">
          /app/rewards
        </Link>{" "}
        is the immutable log for this address. If a number moved, a row exists.
      </DocsLead>

      <DocsH2 id="rows">Rows</DocsH2>
      <DocsP>
        Each row has an account, a type, an amount, and a reference. Website credit, USDG, and LLM share this
        log. Changing the published bps later does not rewrite a row that already posted.
      </DocsP>
      <DocsP>
        Empty ledger means nothing has been claimed yet. Claim a qualifying $250+ fill first.
      </DocsP>

      <DocsH2 id="fills">Fills</DocsH2>
      <DocsP>
        The fills list is booked swaps for this address: chain pair, truncated hash, notional, and status.
        Import or live settle both land here. Status can be booked, held, or skipped. Held waits on review. It
        is not a silent success.
      </DocsP>
      <DocsPager href="/docs/ledger" />
    </>
  );
}
