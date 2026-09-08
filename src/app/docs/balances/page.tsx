import type { Metadata } from "next";
import { docsPageTitle } from "@/lib/brand";
import Link from "next/link";
import { DocsCallout, DocsH1, DocsH2, DocsLead, DocsP, DocsTable } from "@/components/docs/DocsPrimitives";
import { DocsPager } from "@/components/docs/DocsPager";

export const metadata: Metadata = {
  title: docsPageTitle("Balances and convert"),
  description: "Website credit, USDG, and LLM rails. Convert is 1:1 after the fee already ran at claim.",
};

export default function BalancesDocsPage() {
  return (
    <>
      <DocsH1>Balances and convert</DocsH1>
      <DocsLead>
        <Link href="/app" className="text-zinc-100 underline decoration-white/20 underline-offset-4">
          /app
        </Link>{" "}
        shows three numbers on one ledger. Convert moves website credit onto a rail. Redeem spends that rail.
      </DocsLead>

      <DocsH2 id="the-three-numbers">The three numbers</DocsH2>
      <DocsTable
        headers={["Balance", "What it is", "Next step"]}
        rows={[
          ["Website credit", "Posted reward, not yet on a rail", "Convert 1:1"],
          ["USDG", "Credit sitting on the USDG rail", "Redeem on Robinhood"],
          ["LLM credits", "Credit sitting on the LLM rail", "Mint an acc_ key or use Chat"],
        ]}
      />
      <DocsP>
        BPS already ran at claim. Convert does not take another cut. Minimum move is $1.00. The daily cap
        applies to credit that posts, not to convert itself.
      </DocsP>

      <DocsH2 id="convert">Convert</DocsH2>
      <DocsP>
        Enter an amount, then pick To LLM credits or To USDG. The desk opens a review panel before anything
        posts: amount, source, destination, rate, and timing.
      </DocsP>

      <DocsH2 id="review-before-it-posts">Review before it posts</DocsH2>
      <DocsP>
        Confirm move writes the ledger. Success shows a reference and a Redeem it link. If the write fails, the
        desk says no credit left your balance and lets you retry with the same idempotency key so a retry
        cannot double-post.
      </DocsP>
      <DocsCallout title="Do not skip convert">
        Redeem spends a rail, not raw website credit. Convert first, then open{" "}
        <Link href="/docs/usdg" className="text-zinc-100 underline decoration-white/20 underline-offset-4">
          USDG
        </Link>{" "}
        or{" "}
        <Link href="/docs/llm" className="text-zinc-100 underline decoration-white/20 underline-offset-4">
          LLM credits
        </Link>
        .
      </DocsCallout>
      <DocsPager href="/docs/balances" />
    </>
  );
}
