import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { aiGenerations, aiModels } from "@/lib/db/schema";
import { getAiCreateDisplayCents } from "@/lib/deposit/display";
import { getSpendableAiCreditCents } from "./ledger";
import { pollAndFinalizeJob } from "./finalize";

export type AiJobPublic = {
  id: string;
  modelId: string;
  modelName: string;
  category: string;
  status: string;
  estimatedCostCents: number;
  finalCostCents: number | null;
  input: Record<string, unknown>;
  outputUrls: string[];
  error: string | null;
  createdAt: string;
  completedAt: string | null;
};

function parseJob(row: {
  job: typeof aiGenerations.$inferSelect;
  modelName: string;
  category: string;
}): AiJobPublic {
  let input: Record<string, unknown> = {};
  let outputUrls: string[] = [];
  try {
    input = JSON.parse(row.job.input) as Record<string, unknown>;
  } catch {
    input = {};
  }
  if (row.job.output) {
    try {
      const parsed = JSON.parse(row.job.output) as { urls?: string[] };
      outputUrls = parsed.urls ?? [];
    } catch {
      outputUrls = [];
    }
  }

  return {
    id: row.job.id,
    modelId: row.job.modelId,
    modelName: row.modelName,
    category: row.category,
    status: row.job.status,
    estimatedCostCents: row.job.estimatedCostCents,
    finalCostCents: row.job.finalCostCents,
    input,
    outputUrls,
    error: row.job.error,
    createdAt: new Date(row.job.createdAt).toISOString(),
    completedAt: row.job.completedAt ? new Date(row.job.completedAt).toISOString() : null,
  };
}

async function loadJobRow(jobId: string, userId?: string) {
  const db = await getDb();
  const rows = await db
    .select({
      job: aiGenerations,
      modelName: aiModels.displayName,
      category: aiModels.category,
    })
    .from(aiGenerations)
    .innerJoin(aiModels, eq(aiGenerations.modelId, aiModels.id))
    .where(eq(aiGenerations.id, jobId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (userId && row.job.userId !== userId) return null;
  return row;
}

export async function getAiJob(jobId: string, userId: string) {
  let row = await loadJobRow(jobId, userId);
  if (!row) return null;

  if (row.job.status === "pending" || row.job.status === "processing") {
    await pollAndFinalizeJob(jobId, userId);
    row = await loadJobRow(jobId, userId);
    if (!row) return null;
  }

  return parseJob(row);
}

export async function listAiJobs(userId: string, limit = 30) {
  const db = await getDb();
  const rows = await db
    .select({
      job: aiGenerations,
      modelName: aiModels.displayName,
      category: aiModels.category,
    })
    .from(aiGenerations)
    .innerJoin(aiModels, eq(aiGenerations.modelId, aiModels.id))
    .where(eq(aiGenerations.userId, userId))
    .orderBy(desc(aiGenerations.createdAt))
    .limit(limit);

  return rows.map(parseJob);
}

export async function getAiCreateBalance(userId: string) {
  const db = await getDb();
  const [spendableCents, displayCents] = await Promise.all([
    getSpendableAiCreditCents(userId, db),
    getAiCreateDisplayCents(userId, db),
  ]);
  return { spendableCents, displayCents };
}
