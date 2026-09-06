import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { pendingSettles } from "@/lib/db/schema";
import { newLedgerId } from "@/lib/ledger/post-swap-reward";

export async function upsertPendingSettle(input: {
  userId: string;
  provider: "lifi" | "changenow";
  txHash: string;
  exchangeId?: string;
  fromChain: string;
  toChain: string;
  db?: Awaited<ReturnType<typeof getDb>>;
}) {
  const client = input.db ?? (await getDb());
  const [existing] = await client
    .select()
    .from(pendingSettles)
    .where(
      and(eq(pendingSettles.provider, input.provider), eq(pendingSettles.txHash, input.txHash)),
    )
    .limit(1);

  if (existing) {
    if (existing.status === "done") return existing;
    const [updated] = await client
      .update(pendingSettles)
      .set({
        status: "pending",
        exchangeId: input.exchangeId ?? existing.exchangeId,
        updatedAt: new Date(),
      })
      .where(eq(pendingSettles.id, existing.id))
      .returning();
    return updated ?? existing;
  }

  const [created] = await client
    .insert(pendingSettles)
    .values({
      id: newLedgerId("set"),
      userId: input.userId,
      provider: input.provider,
      txHash: input.txHash,
      exchangeId: input.exchangeId,
      fromChain: input.fromChain,
      toChain: input.toChain,
      status: "pending",
    })
    .returning();
  return created;
}
