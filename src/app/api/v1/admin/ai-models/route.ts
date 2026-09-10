import { z } from "zod";
import { AdminError, assertAdmin } from "@/lib/auth/admin";
import { upsertModel, listAllModels } from "@/lib/ai-create/models";
import { OriginError, assertSameOrigin, jsonError } from "@/lib/security/origin";
import { aiModelAdminSchema } from "@/lib/validation/swap";

export async function GET(request: Request) {
  try {
    await assertAdmin(request);
    const models = await listAllModels();
    return Response.json({ models });
  } catch (error) {
    if (error instanceof AdminError) {
      return jsonError(error.status, error.message, "Admin request failed.");
    }
    return jsonError(400, "ai_models_failed", error instanceof Error ? error.message : "ai_models_failed");
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await assertAdmin(request);
    const body = aiModelAdminSchema.parse(await request.json());
    const result = await upsertModel(body);
    return Response.json(result);
  } catch (error) {
    if (error instanceof OriginError) {
      return jsonError(403, "forbidden_origin", "Request origin was rejected.");
    }
    if (error instanceof z.ZodError) {
      return jsonError(400, "invalid_body", "AI model payload failed validation.");
    }
    if (error instanceof AdminError) {
      return jsonError(error.status, error.message, "Admin request failed.");
    }
    return jsonError(400, "ai_models_failed", error instanceof Error ? error.message : "ai_models_failed");
  }
}
