import type { Metadata } from "next";
import { docsPageTitle, PRODUCTION_APP_ORIGIN } from "@/lib/brand";
import { DocsCode } from "@/components/docs/DocsCode";
import {
  DocsA,
  DocsCallout,
  DocsH1,
  DocsH2,
  DocsH3,
  DocsLead,
  DocsOl,
  DocsP,
  DocsTable,
} from "@/components/docs/DocsPrimitives";
import { DocsPager } from "@/components/docs/DocsPager";

const MESH_SLUG = "accrued-llm";
const FACILITATOR_URL = "https://facilitator.meshgateway.co";
const TREASURY_WALLET = "0x183B3C77F26676E1C12BCA55080d4cA20F7C5a66";
const MAX_PRICE_USDG = "0.05";

export const metadata: Metadata = {
  title: docsPageTitle("x402 agent payments"),
  description: "Pay-per-request LLM access for autonomous agents via HTTP 402 and USDG on Robinhood Chain.",
};

export default function X402DocsPage() {
  const origin = PRODUCTION_APP_ORIGIN;
  const meshBase = `https://api.meshgateway.co/m/${MESH_SLUG}`;
  const discoveryAccrued = `${origin}/.well-known/x402`;
  const discoveryMesh = `${meshBase}/openapi.json`;

  return (
    <>
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">HTTP 402 · USDG · Robinhood Chain</p>
      <DocsH1>x402 agent payments</DocsH1>
      <DocsLead>
        Autonomous agents call Accrued&apos;s LLM gateway without an acc_ key. The server returns HTTP 402 with a
        machine-readable price; the agent signs a Permit2 USDG authorization and retries. Settlement is verified
        through the{" "}
        <DocsA href="https://facilitator.meshgateway.co">MeshGateway x402 facilitator</DocsA> — funds go straight
        to the treasury wallet.
      </DocsLead>

      <div className="mt-8 max-w-[65ch] border border-accent/30 bg-accent/[0.04] px-5 py-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">Live endpoints</p>
        <dl className="mt-4 space-y-4 font-mono text-xs leading-relaxed text-zinc-200">
          <div>
            <dt className="text-zinc-500">Direct API (Accrued)</dt>
            <dd className="mt-1 break-all">{origin}/v1/chat/completions</dd>
          </div>
          <div>
            <dt className="text-zinc-500">MeshGateway marketplace</dt>
            <dd className="mt-1 break-all">{meshBase}/v1/chat/completions</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Discovery (Accrued)</dt>
            <dd className="mt-1 break-all">{discoveryAccrued}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Discovery (MeshGateway)</dt>
            <dd className="mt-1 break-all">{discoveryMesh}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Facilitator</dt>
            <dd className="mt-1 break-all">{FACILITATOR_URL}</dd>
          </div>
        </dl>
      </div>

      <DocsH2 id="dual-rail">Dual rail</DocsH2>
      <DocsTable
        headers={["Audience", "Auth", "How they pay"]}
        rows={[
          [
            "Desk users",
            "acc_ virtual key",
            "Prepaid — redeem LLM credits, mint key, usage burns cents",
          ],
          [
            "Autonomous agents",
            "x402 / USDG",
            "Pay per request — 402 offer → sign → settle on Robinhood Chain",
          ],
        ]}
      />
      <DocsP>Both rails hit the same LLM routes. acc_ is tried first; x402 applies when no key is present.</DocsP>

      <DocsH2 id="payment-flow">Payment flow</DocsH2>
      <DocsOl>
        <li>Agent POSTs without credentials → server responds 402 + payment-required header (USDG price, network, recipient).</li>
        <li>Agent signs Permit2 witness transfer pinned to the treasury wallet.</li>
        <li>Agent retries with payment-signature (or x-payment) header.</li>
        <li>Facilitator verifies and settles on-chain → LLM inference runs → 200 + receipt headers (tx hash, payer).</li>
      </DocsOl>

      <DocsH2 id="pricing">Pricing</DocsH2>
      <DocsTable
        headers={["Field", "Value"]}
        rows={[
          ["Asset", "USDG on Robinhood Chain (eip155:4663)"],
          ["Max per request", `$${MAX_PRICE_USDG} USDG (worst-case quote cap)`],
          ["Recipient", TREASURY_WALLET],
          ["Scheme", "x402 exact · Permit2 witness"],
          ["Facilitator", FACILITATOR_URL],
        ]}
      />

      <DocsH2 id="routes">Paywalled routes</DocsH2>
      <DocsTable
        headers={["Method", "Path", "Description"]}
        rows={[
          ["POST", "/v1/chat/completions", "OpenAI-compatible chat (OpenAI, DeepSeek, Grok, …)"],
          ["POST", "/v1/messages", "Anthropic messages API"],
          ["POST", "/v1beta/models/{model}:generateContent", "Google Gemini native API"],
          ["GET", "/v1/models", "Model list with x402 metadata (no auth required)"],
        ]}
      />

      <DocsH2 id="discovery">Discovery</DocsH2>
      <DocsTable
        headers={["URL", "Format"]}
        rows={[
          [discoveryAccrued, "Accrued x402 discovery document"],
          [`${origin}/v1/x402/openapi.json`, "OpenAPI 3.1 + x-x402 extension"],
          [`${origin}/v1/models`, "OpenAI-style model list with x402 per model"],
          [discoveryMesh, "MeshGateway marketplace OpenAPI for this merchant"],
        ]}
      />

      <DocsH2 id="receipt">Settlement receipt</DocsH2>
      <DocsP>After a successful paid request, the response includes:</DocsP>
      <DocsTable
        headers={["Header", "Meaning"]}
        rows={[
          ["payment-response", "Base64 JSON receipt (success, transaction, payer, network)"],
          ["X-Accrued-X402-Settled", "true when verify + settle succeeded"],
          ["X-Accrued-X402-Tx-Hash", "Robinhood Chain transaction hash"],
          ["X-Accrued-X402-Payer", "Wallet that signed the authorization"],
        ]}
      />

      <DocsH2 id="agent-example">Agent example</DocsH2>
      <DocsCode
        language="js"
        code={`import { createClient, getSettlement } from "@meshgateway/mpp-client";

const mpp = createClient({ signer, maxAmount: "${MAX_PRICE_USDG}" });

// Direct Accrued origin:
const res = await mpp.fetch("${origin}/v1/chat/completions", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: "Hello" }],
  }),
});

console.log(await res.json());
console.log(getSettlement(res)); // { transaction, payer }

// Or via MeshGateway marketplace:
// await mpp.fetch("${meshBase}/v1/chat/completions", { ... });`}
      />

      <DocsH3 id="curl-probe">Probe with curl (expect 402)</DocsH3>
      <DocsCode
        language="bash"
        code={`curl -i -X POST ${origin}/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"hi"}]}'`}
      />

      <DocsCallout title="Desk users unchanged">
        Humans still redeem LLM credits and use acc_ keys. x402 is the agent rail — no account, no prepaid key.
        See <DocsA href="/docs/llm">LLM credits</DocsA> and <DocsA href="/docs/api">API</DocsA> for the desk flow.
      </DocsCallout>

      <DocsCallout title="MeshGateway merchant">
        Listed on{" "}
        <DocsA href="https://meshgateway.co/">MeshGateway</DocsA> as{" "}
        <DocsA href={discoveryMesh}>{MESH_SLUG}</DocsA>. Facilitator docs:{" "}
        <DocsA href={FACILITATOR_URL}>{FACILITATOR_URL}</DocsA>.
      </DocsCallout>

      <DocsPager href="/docs/x402" />
    </>
  );
}
