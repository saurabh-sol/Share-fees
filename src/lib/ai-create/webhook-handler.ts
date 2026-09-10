import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { aiGenerations } from "@/lib/db/schema";
import type { ReplicatePrediction } from "@/lib/replicate/client";
import { finalizeJobFromPrediction } from "./finalize";

export async function handleReplicateWebhookPrediction(
  prediction: ReplicatePrediction,
  db?: Awaited<ReturnType<typeof getDb>>,
) {
  const client = db ?? (await getDb());
  const [job] = await client
    .select()
    .from(aiGenerations)
    .where(eq(aiGenerations.providerPredictionId, prediction.id))
    .limit(1);

  if (!job) {
    return { ok: true as const, matched: false as const };
  }

  const result = await finalizeJobFromPrediction(job, prediction, client);
  return {
    ok: true as const,
    matched: true as const,
    jobId: job.id,
    finalized: result.finalized,
    alreadyDone: "alreadyDone" in result ? result.alreadyDone : false,
  };
}
