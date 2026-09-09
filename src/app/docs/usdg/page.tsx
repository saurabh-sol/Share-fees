import type { Metadata } from "next";
import { docsPageTitle } from "@/lib/brand";
import Link from "next/link";
import { DocsCallout, DocsH1, DocsH2, DocsLead, DocsP, DocsUl } from "@/components/docs/DocsPrimitives";
import { DocsPager } from "@/components/docs/DocsPager";
import { USDG_REWARD_VAULT, robinhoodAddressUrl } from "@/lib/chains/robinhood";

export const metadata: Metadata = {
  title: docsPageTitle("USDG"),
  description: "Claim Robinhood USDG from UsdgRewardVault to the signed-in EVM address.",
};

export default function UsdgDocsPage() {
  return (
    <>
      <DocsH1>USDG</DocsH1>
      <DocsLead>
        Convert website credit to the USDG rail, then redeem. Payment is an on-chain vault claim on Robinhood
        Chain. The destination is the signed-in EVM address. No other address is accepted.
      </DocsLead>

      <DocsH2 id="what-you-receive">What you receive</DocsH2>
      <DocsP>
        Robinhood USDG — not Paxos USDG on Ethereum mainnet. Gas is Robinhood ETH. The token lands on the same
        wallet that signed in. Solana sessions cannot take this rail.
      </DocsP>
      <DocsP>
        The vault contract is public:{" "}
        <a
          href={robinhoodAddressUrl(USDG_REWARD_VAULT)}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-zinc-100 underline decoration-white/20 underline-offset-4"
        >
          {USDG_REWARD_VAULT.slice(0, 6)}…{USDG_REWARD_VAULT.slice(-4)}
        </a>
        . A raw USDG transfer is not a reward claim. The vault stores the claim id.
      </DocsP>

      <DocsH2 id="how-a-claim-lands">How a claim lands</DocsH2>
      <DocsUl>
        <li>Convert at least $1.00 of website credit to USDG.</li>
        <li>Open Redeem, pick USDG on Robinhood, enter an amount, then Redeem.</li>
        <li>
          When the vault and treasury are unlocked, the wallet submits claim() with a desk signature, or
          treasury submits payClaim(). Either path writes the same on-chain record.
        </li>
      </DocsUl>

      <DocsH2 id="limits">Limits</DocsH2>
      <DocsP>
        Minimum redeem is $1.00. Each USDG vault claim is capped at $5.00. A 30-minute cooldown applies per
        wallet. Split larger credit across claims.
      </DocsP>

      <DocsH2 id="queued">Queued, not paid</DocsH2>
      <DocsP>
        If the vault is unset or treasury is locked, the redeem still books. The desk shows queued, not claimed
        on-chain. Nothing has left the vault. Wait, or check the payout status on Redeem.
      </DocsP>
      <DocsCallout title="Same wallet only" tone="warn">
        There is no destination field. You cannot send USDG to a friend, a CEX deposit address, or a different
        chain.
      </DocsCallout>
      <DocsP>
        Convert first on{" "}
        <Link href="/docs/balances" className="text-zinc-100 underline decoration-white/20 underline-offset-4">
          Balances
        </Link>
        .
      </DocsP>
      <DocsPager href="/docs/usdg" />
    </>
  );
}
