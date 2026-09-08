import type { Metadata } from "next";
import { docsPageTitle } from "@/lib/brand";
import Link from "next/link";
import { DocsH1, DocsH2, DocsLead, DocsOl, DocsP, DocsTable } from "@/components/docs/DocsPrimitives";
import { DocsPager } from "@/components/docs/DocsPager";

export const metadata: Metadata = {
  title: docsPageTitle("How it pays"),
  description: "The six steps from a signed-in wallet to posted Accrued credit.",
};

export default function HowItPaysDocsPage() {
  return (
    <>
      <DocsH1>How it pays</DocsH1>
      <DocsLead>
        A qualifying swap is priced once. You take USDG or LLM credits. Six steps, same ledger, no second
        balance.
      </DocsLead>

      <DocsH2 id="the-six-steps">The six steps</DocsH2>
      <DocsOl>
        <li>
          <span className="text-zinc-100">Connect the wallet.</span> Sign SIWE or SIWS. There is no email
          account. The address that signs is the desk.
        </li>
        <li>
          <span className="text-zinc-100">Swap live, or scan history.</span> Run a fill in Swap Studio (swap router or
          Robinhood ETH) or scan the same wallet on Activity. Both paths hit one rule engine.
        </li>
        <li>
          <span className="text-zinc-100">Clear the $250 floor.</span> Once the connected wallet’s confirmed
          swap volume clears $250, BPS is listed. Each later swap at or above $250 can credit. Smaller
          transfers stay visible. They do not pay on their own.
        </li>
        <li>
          <span className="text-zinc-100">Convert at 50 bps.</span> Qualifying notional × 0.50% writes website
          credit. Changing the rule never rewrites old rows.
        </li>
        <li>
          <span className="text-zinc-100">Claim, then convert.</span> BPS posts website credit first. Convert
          1:1 to LLM or USDG any time. Redeem an acc_ key or claim Robinhood USDG after that.
        </li>
        <li>
          <span className="text-zinc-100">One hash, one credit.</span> Each tx hash is booked once. Re-scan,
          retry, and a second claim on the same fill do not pay twice.
        </li>
      </DocsOl>

      <DocsH2 id="worked-example">Worked example</DocsH2>
      <DocsTable
        headers={["Fill", "Notional", "Rule", "Credit"]}
        rows={[
          ["ETH / USDC", "$1,842.60", "50 bps", "$9.21"],
          ["SOL / USDT", "$764.18", "50 bps", "$3.82"],
          ["A $40 send", "$40.00", "Does not count", "—"],
          ["A $180 swap before the floor", "$180.00", "Counts toward $250", "Pays only after the floor"],
        ]}
      />
      <DocsP>
        The landing hero has the same math as a slider. Drag it and you get the published ratio, not an
        estimate.
      </DocsP>

      <DocsH2 id="what-counts">What counts as volume</DocsH2>
      <DocsP>
        Confirmed <span className="text-zinc-200">swaps</span> count. Sends, receives, and approvals do not. A
        single imported fill still has to be at or above $250 to claim on its own. Live fills below $250 still
        execute on-chain; the credit is held or skipped, not invented later.
      </DocsP>
      <DocsP>
        Next:{" "}
        <Link href="/docs/connect" className="text-zinc-100 underline decoration-white/20 underline-offset-4">
          connect a wallet
        </Link>{" "}
        or jump to{" "}
        <Link href="/docs/limits" className="text-zinc-100 underline decoration-white/20 underline-offset-4">
          published numbers
        </Link>
        .
      </DocsP>
      <DocsPager href="/docs/how-it-pays" />
    </>
  );
}
