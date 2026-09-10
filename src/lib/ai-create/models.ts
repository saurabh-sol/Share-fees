import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { aiModels } from "@/lib/db/schema";
import { AiCreateError } from "./errors";

export type AiModelFieldSchema = {
  type: "string" | "number" | "boolean" | "array";
  required?: boolean;
  maxLength?: number;
  enum?: string[];
  default?: string | number | boolean | unknown[];
};

export type AiModelInputSchema = Record<string, AiModelFieldSchema>;

export type AiModelPublic = {
  id: string;
  category: string;
  displayName: string;
  maxCostCents: number;
  inputSchema: AiModelInputSchema;
  asyncRequired: boolean;
};

function parseInputSchema(raw: string): AiModelInputSchema {
  try {
    return JSON.parse(raw) as AiModelInputSchema;
  } catch {
    return { prompt: { type: "string", required: true, maxLength: 2000 } };
  }
}

export async function listEnabledModels(category?: string): Promise<AiModelPublic[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(aiModels)
    .where(
      category
        ? and(eq(aiModels.enabled, 1), eq(aiModels.category, category))
        : eq(aiModels.enabled, 1),
    )
    .orderBy(asc(aiModels.sortOrder), asc(aiModels.displayName));

  return rows.map((row) => ({
    id: row.id,
    category: row.category,
    displayName: row.displayName,
    maxCostCents: row.maxCostCents,
    inputSchema: parseInputSchema(row.inputSchema),
    asyncRequired: row.asyncRequired === 1,
  }));
}

export type AiModelAdmin = {
  id: string;
  provider: string;
  category: string;
  modelSlug: string;
  displayName: string;
  enabled: boolean;
  pricingType: string;
  maxCostCents: number;
  inputSchema: AiModelInputSchema;
  asyncRequired: boolean;
  sortOrder: number;
  createdAt: string;
};

function toAdminRow(row: typeof aiModels.$inferSelect): AiModelAdmin {
  return {
    id: row.id,
    provider: row.provider,
    category: row.category,
    modelSlug: row.modelSlug,
    displayName: row.displayName,
    enabled: row.enabled === 1,
    pricingType: row.pricingType,
    maxCostCents: row.maxCostCents,
    inputSchema: parseInputSchema(row.inputSchema),
    asyncRequired: row.asyncRequired === 1,
    sortOrder: row.sortOrder,
    createdAt: new Date(row.createdAt).toISOString(),
  };
}

export async function listAllModels(db?: Awaited<ReturnType<typeof getDb>>): Promise<AiModelAdmin[]> {
  const client = db ?? (await getDb());
  const rows = await client
    .select()
    .from(aiModels)
    .orderBy(asc(aiModels.category), asc(aiModels.sortOrder), desc(aiModels.createdAt));
  return rows.map(toAdminRow);
}

export async function upsertModel(
  input: {
    id: string;
    provider?: string;
    category: string;
    modelSlug: string;
    displayName: string;
    enabled: boolean;
    pricingType?: string;
    maxCostCents: number;
    inputSchema: AiModelInputSchema;
    asyncRequired: boolean;
    sortOrder?: number;
  },
  db?: Awaited<ReturnType<typeof getDb>>,
) {
  const client = db ?? (await getDb());
  const payload = {
    id: input.id,
    provider: input.provider ?? "replicate",
    category: input.category,
    modelSlug: input.modelSlug,
    displayName: input.displayName,
    enabled: input.enabled ? 1 : 0,
    pricingType: input.pricingType ?? "fixed_max",
    maxCostCents: input.maxCostCents,
    inputSchema: JSON.stringify(input.inputSchema),
    asyncRequired: input.asyncRequired ? 1 : 0,
    sortOrder: input.sortOrder ?? 0,
  };

  const [existing] = await client.select().from(aiModels).where(eq(aiModels.id, input.id)).limit(1);
  if (existing) {
    await client.update(aiModels).set(payload).where(eq(aiModels.id, input.id));
    return { id: input.id, created: false as const };
  }

  await client.insert(aiModels).values(payload);
  return { id: input.id, created: true as const };
}

export async function setModelEnabled(
  modelId: string,
  enabled: boolean,
  db?: Awaited<ReturnType<typeof getDb>>,
) {
  const client = db ?? (await getDb());
  const [row] = await client.select().from(aiModels).where(eq(aiModels.id, modelId)).limit(1);
  if (!row) {
    throw new AiCreateError("model_not_found", 404);
  }
  await client.update(aiModels).set({ enabled: enabled ? 1 : 0 }).where(eq(aiModels.id, modelId));
  return { id: modelId, enabled };
}

export async function getEnabledModel(modelId: string) {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(aiModels)
    .where(and(eq(aiModels.id, modelId), eq(aiModels.enabled, 1)))
    .limit(1);
  if (!row) {
    throw new AiCreateError("model_not_allowed", 404);
  }
  return {
    ...row,
    inputSchema: parseInputSchema(row.inputSchema),
  };
}
