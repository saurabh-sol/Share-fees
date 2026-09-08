import type { Metadata } from "next";
import { docsPageTitle } from "@/lib/brand";
import { DocsH1, DocsH2, DocsLead, DocsP, DocsTable } from "@/components/docs/DocsPrimitives";
import { DocsPager } from "@/components/docs/DocsPager";

export const metadata: Metadata = {
  title: docsPageTitle("Published numbers"),
  description: "Floor, 50 bps, daily cap, redeem minimum, and USDG claim cap.",
};

export default function LimitsDocsPage() {
  return (
    <>
      <DocsH1>Published numbers</DocsH1>
      <DocsLead>
        Floor, bps, and daily cap are the live reward rule. Operators can tighten them. They cannot invent a
        second balance.
      </DocsLead>

      <DocsH2 id="live-rule">The live rule</DocsH2>
      <DocsTable
        headers={["Term", "Value", "Meaning"]}
        rows={[
          [
            "Floor",
            "$250",
            "Confirmed swap volume before BPS is listed. A fill below this can still settle. It does not write credit on its own.",
          ],
          ["Conversion", "50 bps", "0.50% of qualifying notional."],
          [
            "Daily room",
            "$2,500",
            "Credit that posts in a UTC day stops here. Excess stays visible, unpaid.",
          ],
          ["Minimum redeem", "$1.00", "USDG and LLM redeem both start at one dollar."],
          [
            "USDG per claim",
            "$5.00",
            "Each vault claim is capped at five dollars. A 30-minute cooldown applies per wallet and network.",
          ],
        ]}
      />

      <DocsH2 id="what-cannot-change">What cannot change after a row posts</DocsH2>
      <DocsP>
        Changing the published rule later does not rewrite booked rows. A fill priced at 50 bps stays at 50
        bps. One (tx, chain) pair still credits at most once.
      </DocsP>
      <DocsPager href="/docs/limits" />
    </>
  );
}
