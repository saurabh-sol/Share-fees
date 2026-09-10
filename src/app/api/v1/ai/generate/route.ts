import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { AiCreateError } from "@/lib/ai-create/errors";
import { startAiGeneration } from "@/lib/ai-create/generate";
import { OriginError, assertSameOrigin, clientIp, jsonError } from "@/lib/security/origin";
import { RateLimitError, rateLimitOrThrow } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  model: z.string().min(1),
  input: z.record(z.string(), z.unknown()),
  idempotencyKey: z.string().min(8).max(128),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await rateLimitOrThrow(`ai-generate:${clientIp(request)}`, 10, 15 * 60 * 1000);

    const session = await getSession(request);
    if (!session) {
      return jsonError(401, "unauthenticated", "Sign in with a wallet first.");
    }

    const body = bodySchema.parse(await request.json());
    const result = await startAiGeneration({
      userId: session.user.id,
      modelId: body.model,
      rawInput: body.input,
      idempotencyKey: body.idempotencyKey,
    });

    return Response.json(
      {
        jobId: result.job.id,
        status: result.job.status,
        estimatedCostCents: result.job.estimatedCostCents,
        finalCostCents: result.job.finalCostCents,
        outputUrls: result.job.output
          ? ((JSON.parse(result.job.output) as { urls?: string[] }).urls ?? [])
          : [],
        error: result.job.error,
        alreadyExists: result.alreadyExists,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof OriginError) {
      return jsonError(403, "forbidden_origin", "Request origin was rejected.");
    }
    if (error instanceof RateLimitError) {
      return jsonError(429, "rate_limited", "Too many generation requests.");
    }
    if (error instanceof AiCreateError) {
      return jsonError(error.status, error.message, error.message);
    }
    if (error instanceof z.ZodError) {
      return jsonError(400, "invalid_body", "Generation payload failed validation.");
    }
    return jsonError(502, "generate_failed", error instanceof Error ? error.message : "generate_failed");
  }
}
