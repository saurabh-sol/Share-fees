#!/usr/bin/env node
/**
 * Demo: agent pay-per-request against Accrued LLM gateway via x402.
 *
 * Requires @meshgateway/mpp-client and a Robinhood USDG wallet signer.
 *
 *   npm install @meshgateway/mpp-client
 *   ORIGIN=https://trade2credits.onrender.com node scripts/x402-agent-demo.mjs
 *
 * With a local wallet private key (dev only):
 *   AGENT_PRIVATE_KEY=0x... ORIGIN=http://localhost:3000 node scripts/x402-agent-demo.mjs
 */

const origin = (process.env.ORIGIN ?? "http://localhost:3000").replace(/\/$/, "");
const model = process.env.MODEL ?? "gpt-4o-mini";

async function rawFetchDemo() {
  const first = await fetch(`${origin}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: "Reply with the single word ok." }],
    }),
  });

  if (first.status !== 402) {
    console.error("Expected HTTP 402 on first request, got", first.status);
    process.exit(1);
  }

  const offer = await first.json();
  console.log("402 offer:", JSON.stringify(offer, null, 2));
  console.log(
    "\nSign the payment with @meshgateway/mpp-client and retry with the payment-signature header.",
  );
  console.log("Example:\n");
  console.log(`  import { createClient, getSettlement } from "@meshgateway/mpp-client";`);
  console.log(`  const mpp = createClient({ signer, maxAmount: "0.05" });`);
  console.log(`  const res = await mpp.fetch("${origin}/v1/chat/completions", {`);
  console.log(`    method: "POST",`);
  console.log(`    headers: { "Content-Type": "application/json" },`);
  console.log(`    body: JSON.stringify({ model: "${model}", messages: [{ role: "user", content: "ok" }] }),`);
  console.log(`  });`);
  console.log(`  console.log(getSettlement(res));`);
  console.log(`  // Or read plain headers:`);
  console.log(`  console.log(res.headers.get("X-Accrued-X402-Tx-Hash"));`);
  console.log(`  console.log(res.headers.get("X-Accrued-X402-Settled"));`);
}

rawFetchDemo().catch((error) => {
  console.error(error);
  process.exit(1);
});
