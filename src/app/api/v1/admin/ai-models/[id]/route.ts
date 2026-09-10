import { z } from "zod";
import { AdminError, assertAdmin } from "@/lib/auth/admin";
import { AiCreateError } from "@/lib/ai-create/errors";
import { setModelEnabled } from "@/lib/ai-create/models";
import { OriginError, assertSameOrigin, jsonError } from "@/lib/security/origin";
import { aiModelToggleSchema } from "@/lib/validation/swap";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    await assertAdmin(request);
    const { id } = await context.params;
    const body = aiModelToggleSchema.parse(await request.json());
    const result = await setModelEnabled(id, body.enabled);
    return Response.json(result);
  } catch (error) {
    if (error instanceof OriginError) {
      return jsonError(403, "forbidden_origin", "Request origin was rejected.");
    }
    if (error instanceof z.ZodError) {
      return jsonError(400, "invalid_body", "Toggle payload failed validation.");
    }
    if (error instanceof AiCreateError) {
      return jsonError(error.status, error.message, error.message);
    }
    if (error instanceof AdminError) {
      return jsonError(error.status, error.message, "Admin request failed.");
    }
    return jsonError(400, "ai_model_toggle_failed", error instanceof Error ? error.message : "ai_model_toggle_failed");
  }
}
