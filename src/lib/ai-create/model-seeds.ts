import { sql } from "drizzle-orm";
import type { AiModelInputSchema } from "./models";

export type AiModelSeed = {
  id: string;
  modelSlug: string;
  displayName: string;
  category: "image" | "video" | "audio";
  maxCostCents: number;
  inputSchema: AiModelInputSchema;
  asyncRequired: boolean;
  sortOrder: number;
};

const FLUX_2_PRO_SCHEMA: AiModelInputSchema = {
  prompt: { type: "string", required: true, maxLength: 4000 },
  resolution: { type: "string", enum: ["0.5 MP", "1 MP", "2 MP"], default: "1 MP" },
  aspect_ratio: {
    type: "string",
    enum: ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"],
    default: "1:1",
  },
  input_images: { type: "array", default: [] },
  output_format: { type: "string", enum: ["webp", "png", "jpg"], default: "webp" },
  output_quality: { type: "number", default: 80 },
  safety_tolerance: { type: "number", default: 2 },
};

const PROMPT_ASPECT_SCHEMA: AiModelInputSchema = {
  prompt: { type: "string", required: true, maxLength: 4000 },
  aspect_ratio: {
    type: "string",
    enum: ["1:1", "16:9", "9:16", "4:3", "3:4"],
    default: "1:1",
  },
};

const PROMPT_ONLY_SCHEMA: AiModelInputSchema = {
  prompt: { type: "string", required: true, maxLength: 4000 },
};

export const AI_MODEL_SEEDS: AiModelSeed[] = [
  {
    id: "flux-2-pro",
    modelSlug: "black-forest-labs/flux-2-pro",
    displayName: "FLUX 2 Pro",
    category: "image",
    maxCostCents: 35,
    inputSchema: FLUX_2_PRO_SCHEMA,
    asyncRequired: false,
    sortOrder: 0,
  },
  {
    id: "imagen-4",
    modelSlug: "google/imagen-4",
    displayName: "Imagen 4",
    category: "image",
    maxCostCents: 30,
    inputSchema: PROMPT_ASPECT_SCHEMA,
    asyncRequired: false,
    sortOrder: 1,
  },
  {
    id: "flux-kontext-pro",
    modelSlug: "black-forest-labs/flux-kontext-pro",
    displayName: "FLUX Kontext Pro",
    category: "image",
    maxCostCents: 30,
    inputSchema: {
      ...PROMPT_ASPECT_SCHEMA,
      input_image: { type: "string", required: false },
    },
    asyncRequired: false,
    sortOrder: 2,
  },
  {
    id: "flux-1-1-pro",
    modelSlug: "black-forest-labs/flux-1.1-pro",
    displayName: "FLUX 1.1 Pro",
    category: "image",
    maxCostCents: 20,
    inputSchema: PROMPT_ASPECT_SCHEMA,
    asyncRequired: false,
    sortOrder: 3,
  },
  {
    id: "ideogram-v3-turbo",
    modelSlug: "ideogram-ai/ideogram-v3-turbo",
    displayName: "Ideogram V3 Turbo",
    category: "image",
    maxCostCents: 15,
    inputSchema: PROMPT_ASPECT_SCHEMA,
    asyncRequired: false,
    sortOrder: 4,
  },
  {
    id: "flux-schnell",
    modelSlug: "black-forest-labs/flux-schnell",
    displayName: "FLUX Schnell",
    category: "image",
    maxCostCents: 10,
    inputSchema: PROMPT_ASPECT_SCHEMA,
    asyncRequired: false,
    sortOrder: 10,
  },
  {
    id: "minimax-video-01",
    modelSlug: "minimax/video-01",
    displayName: "MiniMax Video-01",
    category: "video",
    maxCostCents: 150,
    inputSchema: PROMPT_ONLY_SCHEMA,
    asyncRequired: true,
    sortOrder: 10,
  },
];

type SeedDb = {
  execute: (query: ReturnType<typeof sql>) => Promise<unknown>;
};

export async function seedAiModels(db: SeedDb) {
  for (const model of AI_MODEL_SEEDS) {
    const inputSchema = JSON.stringify(model.inputSchema).replace(/'/g, "''");
    await db.execute(sql.raw(`
      INSERT INTO ai_models (
        id, provider, category, model_slug, display_name, enabled, pricing_type, max_cost_cents, input_schema, async_required, sort_order
      )
      VALUES (
        '${model.id}',
        'replicate',
        '${model.category}',
        '${model.modelSlug}',
        '${model.displayName.replace(/'/g, "''")}',
        1,
        'fixed_max',
        ${model.maxCostCents},
        '${inputSchema}',
        ${model.asyncRequired ? 1 : 0},
        ${model.sortOrder}
      )
      ON CONFLICT (id) DO UPDATE SET
        model_slug = EXCLUDED.model_slug,
        display_name = EXCLUDED.display_name,
        max_cost_cents = EXCLUDED.max_cost_cents,
        input_schema = EXCLUDED.input_schema,
        async_required = EXCLUDED.async_required,
        sort_order = EXCLUDED.sort_order
    `));
  }
}
