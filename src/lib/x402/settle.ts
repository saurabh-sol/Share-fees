import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { x402Settlements } from "@/lib/db/schema";
import type { LlmProvider } from "@/lib/gateway/catalog";
import type { X402SettlementStatus } from "./types";

type Db = Awaited<ReturnType<typeof getDb>>;

export async function recordX402Settlement(
  input: {
    requestId: string;
    payer: string;
    txHash: string;
    amountUsdg: string;
    model: string;
    provider: LlmProvider;
    promptTokens: number;
    completionTokens: number;
    actualCents: number;
    status?: X402SettlementStatus;
  },
  db?: Db,
) {
  const client = db ?? (await getDb());
  const id = crypto.randomUUID();
  try {
    await client.insert(x402Settlements).values({
      id,
      requestId: input.requestId,
      payer: input.payer.toLowerCase(),
      txHash: input.txHash.toLowerCase(),
      amountUsdg: input.amountUsdg,
      model: input.model,
      provider: input.provider,
      promptTokens: input.promptTokens,
      completionTokens: input.completionTokens,
      actualCents: input.actualCents,
      status: input.status ?? "settled",
    });
    return id;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("unique") || message.includes("duplicate")) {
      const [existing] = await client
        .select()
        .from(x402Settlements)
        .where(eq(x402Settlements.txHash, input.txHash.toLowerCase()))
        .limit(1);
      if (existing) return existing.id;
    }
    throw error;
  }
}
