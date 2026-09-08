import type { Metadata } from "next";
import { DocsH1, DocsH2, DocsLead, DocsP, DocsTable } from "@/components/docs/DocsPrimitives";
import { DocsPager } from "@/components/docs/DocsPager";

export const metadata: Metadata = {
  title: "What the desk will not do — Docs",
  description: "Accrued product constraints: destination, duplicates, wash holds, keys.",
};

export default function RulesDocsPage() {
  return (
    <>
      <DocsH1>What the desk will not do</DocsH1>
      <DocsLead>
        These are product constraints, not marketing. If a fill fails a rule, the swap can still exist. The
        credit does not.
      </DocsLead>

      <DocsH2 id="constraints">Constraints</DocsH2>
      <DocsTable
        headers={["Rule", "What happens"]}
        rows={[
          ["No email account", "The address that signs SIWE or SIWS is the desk. There is no password reset."],
          [
            "Same wallet only",
            "USDG redeem pays the session EVM address on Robinhood. No other destination is accepted.",
          ],
          ["One hash, once", "A (tx, chain) pair credits at most one time. Re-import and retry do not mint a second row."],
          ["No fill below $250", "The swap can settle. The credit does not post on its own."],
          ["No second balance", "Website credit, USDG, and LLM are the same ledger, different rails."],
          ["Key shown once", "The plaintext acc_ key is not stored. Leave the page and you mint a new one."],
          [
            "Paper fills stay local",
            "Practice rows exist only when ALLOW_MOCK_SWAPS is on, and that switch is rejected in production.",
          ],
        ]}
      />

      <DocsH2 id="holds">Holds</DocsH2>
      <DocsP>
        Round-trip wash (A → B → A on the same wallet inside 60 minutes) still executes on-chain. The credit
        can be held for review. Release posts it. Reject does not pay.
      </DocsP>
      <DocsP>
        Over the daily cap, the fill stays visible and unpaid. The desk does not roll unused room into the next
        UTC day as extra credit.
      </DocsP>
      <DocsPager href="/docs/rules" />
    </>
  );
}
