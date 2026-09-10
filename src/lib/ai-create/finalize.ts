import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { aiGenerations } from "@/lib/db/schema";
import {
  getPrediction,
  mapReplicateStatus,
  normalizePredictionOutput,
  type ReplicatePrediction,
} from "@/lib/replicate/client";
import { computeFinalCostCents } from "./billing";
import { TERMINAL_JOB_STATUSES, type AiJobStatus } from "./constants";
import { releaseAiCreditHold, settleAiCreditHold } from "./ledger";
import { persistJobOutputs } from "./storage";

type JobRow = typeof aiGenerations.$inferSelect;

function isTerminalJobStatus(status: AiJobStatus): status is (typeof TERMINAL_JOB_STATUSES)[number] {
  return (TERMINAL_JOB_STATUSES as readonly string[]).includes(status);
}

export async function finalizeJobFromPrediction(
  job: JobRow,
  prediction: ReplicatePrediction,
  db?: Awaited<ReturnType<typeof getDb>>,
) {
  const client = db ?? (await getDb());
  const status = mapReplicateStatus(prediction.status);
  if (!isTerminalJobStatus(status)) {
    return { job, finalized: false as const };
  }

  if (job.status === status && job.completedAt) {
    return { job, finalized: true as const, alreadyDone: true as const };
  }

  const sourceUrls = normalizePredictionOutput(prediction.output);
  const finalCostCents = computeFinalCostCents(job, prediction);
  const error = prediction.error ?? null;
  const completedAt = new Date();

  let output: string | null = null;
  if (sourceUrls.length > 0 && status === "succeeded") {
    try {
      const stored = await persistJobOutputs(job.id, sourceUrls);
      output = JSON.stringify({
        urls: stored.urls,
        stored: stored.stored,
        sourceUrls: stored.stored ? sourceUrls : undefined,
      });
    } catch {
      output = JSON.stringify({ urls: sourceUrls, stored: false });
    }
  }

  if (finalCostCents > 0) {
    await settleAiCreditHold(job.userId, job.holdId, finalCostCents, job.id, client);
  } else {
    await releaseAiCreditHold(job.userId, job.holdId, client);
  }

  await client
    .update(aiGenerations)
    .set({
      status,
      finalCostCents,
      output,
      error,
      providerPredictionId: prediction.id,
      completedAt,
    })
    .where(eq(aiGenerations.id, job.id));

  const [updated] = await client.select().from(aiGenerations).where(eq(aiGenerations.id, job.id)).limit(1);
  return { job: updated ?? job, finalized: true as const, alreadyDone: false as const };
}

export async function pollAndFinalizeJob(jobId: string, userId?: string) {
  const db = await getDb();
  const [job] = await db.select().from(aiGenerations).where(eq(aiGenerations.id, jobId)).limit(1);
  if (!job) {
    return null;
  }
  if (userId && job.userId !== userId) {
    return null;
  }
  if (TERMINAL_JOB_STATUSES.includes(job.status as (typeof TERMINAL_JOB_STATUSES)[number])) {
    return job;
  }
  if (!job.providerPredictionId) {
    return job;
  }

  const prediction = await getPrediction(job.providerPredictionId);
  const result = await finalizeJobFromPrediction(job, prediction, db);
  return result.job;
}

export async function failJob(job: JobRow, message: string, db?: Awaited<ReturnType<typeof getDb>>) {
  const client = db ?? (await getDb());
  await releaseAiCreditHold(job.userId, job.holdId, client);
  await client
    .update(aiGenerations)
    .set({
      status: "failed",
      error: message,
      finalCostCents: 0,
      completedAt: new Date(),
    })
    .where(eq(aiGenerations.id, job.id));
}
