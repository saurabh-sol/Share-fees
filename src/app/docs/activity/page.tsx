import type { Metadata } from "next";
import { docsPageTitle } from "@/lib/brand";
import Link from "next/link";
import { DocsCallout, DocsH1, DocsH2, DocsLead, DocsP } from "@/components/docs/DocsPrimitives";
import { DocsPager } from "@/components/docs/DocsPager";

export const metadata: Metadata = {
  title: docsPageTitle("Activity"),
  description: "Scan wallet history or import a hash, then claim Accrued website credit.",
};

export default function ActivityDocsPage() {
  return (
    <>
      <DocsH1>Activity</DocsH1>
      <DocsLead>
        <Link href="/app/claims" className="text-zinc-100 underline decoration-white/20 underline-offset-4">
          /app/claims
        </Link>{" "}
        lists confirmed transfers on the signed-in wallet, sums swap volume, and lets you claim a qualifying
        fill.
      </DocsLead>

      <DocsH2 id="scan-the-wallet">Scan the wallet</DocsH2>
      <DocsP>
        Scan wallet pulls about 90 days of history when a scan key is configured. The desk queues those calls
        and reuses a scan for 15 minutes, so a busy minute does not hammer the provider. Sends do not count.
        Only swap volume is totaled.
      </DocsP>
      <DocsP>
        The three numbers at the top are transfers, swap volume, and estimated reward. Reward stays a dash
        until volume clears $250.
      </DocsP>
      <DocsCallout title="No scan key">
        If Scan wallet reports that history is unavailable, import a hash the desk can verify. The
        desk still works.
      </DocsCallout>

      <DocsH2 id="import-a-hash">Import a hash</DocsH2>
      <DocsP>
        Paste a source-chain transaction hash and the from / to chain ids. The desk verifies ownership before
        the row enters the list. A single imported fill still has to be a $250+ swap to claim on its own.
      </DocsP>

      <DocsH2 id="claim">Claim</DocsH2>
      <DocsP>
        Claim writes website credit. Convert it on the desk, then redeem USDG or an acc_ key. If the hash was
        already on the ledger, the desk says so and does not pay again.
      </DocsP>
      <DocsP>
        Rows that fail a rule stay on Activity. Below the floor, over the daily cap, a duplicate hash, or a
        wash hold — the transfer exists. The credit may not.
      </DocsP>
      <DocsPager href="/docs/activity" />
    </>
  );
}
