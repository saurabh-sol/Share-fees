import type { Metadata } from "next";
import { docsPageTitle } from "@/lib/brand";
import Link from "next/link";
import { DocsH1, DocsH2, DocsLead, DocsP } from "@/components/docs/DocsPrimitives";
import { DocsPager } from "@/components/docs/DocsPager";

export const metadata: Metadata = {
  title: docsPageTitle("Chat"),
  description: "Talk to a model on the Accrued desk without minting an acc_ key.",
};

export default function ChatDocsPage() {
  return (
    <>
      <DocsH1>Chat</DocsH1>
      <DocsLead>
        <Link href="/app/chat" className="text-zinc-100 underline decoration-white/20 underline-offset-4">
          /app/chat
        </Link>{" "}
        talks to a model on the desk. Usage spends LLM credit. You do not paste a vendor key.
      </DocsLead>

      <DocsH2 id="when-to-use-chat">When to use Chat</DocsH2>
      <DocsP>
        Use Chat when you want a reply inside the desk after you have converted website credit to the LLM rail.
        Pick a provider and a model on the composer. Threads stay on this browser. The desk still meters the
        spend against your remaining cents.
      </DocsP>
      <DocsP>
        Claude, OpenAI, DeepSeek, Google, and Grok marks on the control are the same rail. They are not separate
        balances.
      </DocsP>

      <DocsH2 id="when-to-mint-a-key">When to mint a key</DocsH2>
      <DocsP>
        Mint an acc_ key when you need the official vendor API in Cursor or another client. Chat does not give
        you that key. Redeem on{" "}
        <Link href="/docs/llm" className="text-zinc-100 underline decoration-white/20 underline-offset-4">
          LLM credits
        </Link>{" "}
        does. After the key exists, point the SDK at this origin as shown in{" "}
        <Link href="/docs/api" className="text-zinc-100 underline decoration-white/20 underline-offset-4">
          API
        </Link>
        .
      </DocsP>
      <DocsPager href="/docs/chat" />
    </>
  );
}
