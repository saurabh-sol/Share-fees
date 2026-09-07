import type { Metadata } from "next";
import Link from "next/link";
import { DocsCallout, DocsH1, DocsH2, DocsLead, DocsP, DocsUl } from "@/components/docs/DocsPrimitives";
import { DocsPager } from "@/components/docs/DocsPager";

export const metadata: Metadata = {
  title: "LLM credits — Docs",
  description: "Redeem a metered t2c_ key for OpenAI, Anthropic, DeepSeek, Google, or Grok.",
};

export default function LlmDocsPage() {
  return (
    <>
      <DocsH1>LLM credits</DocsH1>
      <DocsLead>
        Convert website credit to the LLM rail, pick a provider and a model, then redeem. The desk mints a
        t2c_ virtual key. That key is the official vendor contract. Usage burns remaining cents.
      </DocsLead>

      <DocsH2 id="mint-a-key">Mint a key</DocsH2>
      <DocsUl>
        <li>Convert at least $1.00 to LLM credits.</li>
        <li>Open Redeem, pick LLM credits, then lock a vendor and a model.</li>
        <li>The spend cap equals the amount you redeem. A $1.00 key can spend at most $1.00.</li>
      </DocsUl>
      <DocsP>
        Redeem locks the vendor. Extra tokens past the cap are rejected. Upstream OpenAI, Anthropic, DeepSeek,
        Google, and Grok keys stay on the server. You never paste them.
      </DocsP>

      <DocsH2 id="shown-once">Shown once</DocsH2>
      <DocsP>
        The full t2c_ key is shown once. After that, only a prefix and a hash are stored. Leave the page
        without copying and you mint a new key from remaining credit. The old plaintext is gone.
      </DocsP>
      <DocsCallout title="Copy it now" tone="warn">
        There is no email with the key. There is no “show again.” Treat it like a password.
      </DocsCallout>

      <DocsH2 id="revoke">Revoke</DocsH2>
      <DocsP>
        Revoke on the key list. The gateway rejects that prefix on the next request. Remaining unused cap does
        not come back as website credit.
      </DocsP>
      <DocsP>
        Point the official SDK at this origin — see{" "}
        <Link href="/docs/api" className="text-zinc-100 underline decoration-white/20 underline-offset-4">
          API
        </Link>
        . Or stay on the desk and use{" "}
        <Link href="/docs/chat" className="text-zinc-100 underline decoration-white/20 underline-offset-4">
          Chat
        </Link>
        .
      </DocsP>
      <DocsPager href="/docs/llm" />
    </>
  );
}
