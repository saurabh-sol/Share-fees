import type { Metadata } from "next";
import Link from "next/link";
import { DocsCallout, DocsH1, DocsH2, DocsLead, DocsP } from "@/components/docs/DocsPrimitives";
import { DocsPager } from "@/components/docs/DocsPager";

export const metadata: Metadata = {
  title: "Swap Studio — Docs",
  description: "Quote and execute a live Accrued fill through the swap router or Robinhood ETH.",
};

export default function SwapDocsPage() {
  return (
    <>
      <DocsH1>Swap Studio</DocsH1>
      <DocsLead>
        <Link href="/app/swap" className="text-zinc-100 underline decoration-white/20 underline-offset-4">
          /app/swap
        </Link>{" "}
        quotes a pair, you sign the fill, then the desk settles credit against the same rule engine used by
        Activity.
      </DocsLead>

      <DocsH2 id="run-a-fill">Run a fill</DocsH2>
      <DocsP>
        Pick from and to tokens, enter an amount, then Get route. The swap router covers the usual EVM pairs. Confirm the
        quote, reconnect the signed-in address if asked, then Swap. The wallet signs. The desk waits for
        confirmation, then prices the fill.
      </DocsP>
      <DocsP>
        Credit posts as website credit first — not USDG and not a key. Convert after the balance updates.
      </DocsP>

      <DocsH2 id="below-the-floor">Below the floor</DocsH2>
      <DocsP>
        A live fill under $250 still happens on-chain. It does not pay on its own. The volume still counts
        toward the $250 floor. Once that floor is cleared, later fills at or above $250 can credit at 50 bps
        until the daily cap.
      </DocsP>
      <DocsCallout title="Held credit" tone="warn">
        Round-trip wash (A → B → A on the same wallet inside an hour) still executes. The credit can be held
        for review. Release posts it. Reject does not.
      </DocsCallout>

      <DocsH2 id="pairs-desk-pay-in">Pairs the swap router cannot quote</DocsH2>
      <DocsP>
        Robinhood Chain ETH and some missing pairs use a desk pay-in: you send a deposit, the payout lands on
        the same wallet, then the desk settles the credit after the exchange finishes. That path is not a
        second reward rule. Same floor, same bps.
      </DocsP>
      <DocsP>
        After a fill posts, convert on{" "}
        <Link href="/docs/balances" className="text-zinc-100 underline decoration-white/20 underline-offset-4">
          Balances
        </Link>{" "}
        or pull older volume from{" "}
        <Link href="/docs/activity" className="text-zinc-100 underline decoration-white/20 underline-offset-4">
          Activity
        </Link>
        .
      </DocsP>
      <DocsPager href="/docs/swap" />
    </>
  );
}
