import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { aiGenerations } from "@/lib/db/schema";
import { LedgerError, newLedgerId } from "@/lib/ledger/post-swap-reward";
import { env } from "@/lib/env";
import { createModelPrediction, mapReplicateStatus } from "@/lib/replicate/client";
import { AiCreateError } from "./errors";
import { finalizeJobFromPrediction, failJob } from "./finalize";
import { assertAiCreateGuards } from "./guards";
import { reserveAiCredit } from "./ledger";
import { getEnabledModel } from "./models";
import { validateModelInput } from "./validate-input";

function newJobId() {
  return `aig_${crypto.randomUUID()}`;
}

function replicateWebhookUrl() {
  if (!env.replicateWebhookSecret) return undefined;
  return `${env.appOrigin.replace(/\/$/, "")}/api/v1/webhooks/replicate`;
}

export async function startAiGeneration(input: {
  userId: string;
  modelId: string;
  rawInput: Record<string, unknown>;
  idempotencyKey: string;
}) {
  await assertAiCreateGuards(input.userId);

  const db = await getDb();
  const [existing] = await db
    .select()
    .from(aiGenerations)
    .where(
      and(
        eq(aiGenerations.userId, input.userId),
        eq(aiGenerations.idempotencyKey, input.idempotencyKey),
      ),
    )
    .limit(1);
  if (existing) {
    return { job: existing, alreadyExists: true as const };
  }

  const model = await getEnabledModel(input.modelId);
  const validatedInput = validateModelInput(model.inputSchema, input.rawInput);
  const jobId = newJobId();
  const holdId = newLedgerId("hld");
  const estimatedCostCents = model.maxCostCents;

  try {
    await reserveAiCredit(input.userId, holdId, estimatedCostCents, db);
  } catch (error) {
    if (error instanceof LedgerError && error.message === "insufficient_credits") {
      throw new AiCreateError("insufficient_credits", 402);
    }
    throw error;
  }

  await db.insert(aiGenerations).values({
    id: jobId,
    userId: input.userId,
    modelId: model.id,
    provider: model.provider,
    status: "pending",
    estimatedCostCents,
    reservedCreditCents: estimatedCostCents,
    holdId,
    input: JSON.stringify(validatedInput),
    idempotencyKey: input.idempotencyKey,
  });

  let job = (
    await db.select().from(aiGenerations).where(eq(aiGenerations.id, jobId)).limit(1)
  )[0]!;

  try {
    const prediction = await createModelPrediction(model.modelSlug, validatedInput, {
      waitSeconds: model.asyncRequired ? undefined : 60,
      webhookUrl: model.asyncRequired ? replicateWebhookUrl() : undefined,
    });

    const mappedStatus = mapReplicateStatus(prediction.status);
    await db
      .update(aiGenerations)
      .set({
        providerPredictionId: prediction.id,
        status: mappedStatus === "succeeded" || mappedStatus === "failed" || mappedStatus === "canceled"
          ? mappedStatus
          : "processing",
      })
      .where(eq(aiGenerations.id, jobId));

    job = (await db.select().from(aiGenerations).where(eq(aiGenerations.id, jobId)).limit(1))[0]!;

    const finalized = await finalizeJobFromPrediction(job, prediction, db);
    return { job: finalized.job, alreadyExists: false as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "generation_failed";
    await failJob(job, message, db);
    if (error instanceof AiCreateError) {
      throw error;
    }
    throw new AiCreateError(message, 502);
  }
}
