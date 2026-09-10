import { AdminError } from "@/lib/auth/admin";
import { handleReplicateWebhookPrediction } from "@/lib/ai-create/webhook-handler";
import { env } from "@/lib/env";
import { jsonError } from "@/lib/security/origin";
import type { ReplicatePrediction } from "@/lib/replicate/client";
import { verifyReplicateWebhook } from "@/lib/replicate/webhook";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const valid = verifyReplicateWebhook(rawBody, {
      webhookId: request.headers.get("webhook-id"),
      webhookTimestamp: request.headers.get("webhook-timestamp"),
      webhookSignature: request.headers.get("webhook-signature"),
    }, env.replicateWebhookSecret);

    if (!valid) {
      throw new AdminError("webhook_unauthorized", 401);
    }

    const prediction = JSON.parse(rawBody) as ReplicatePrediction;
    const result = await handleReplicateWebhookPrediction(prediction);
    return Response.json(result);
  } catch (error) {
    if (error instanceof AdminError) {
      return jsonError(error.status, error.message, "Webhook rejected.");
    }
    return jsonError(
      400,
      "replicate_webhook_failed",
      error instanceof Error ? error.message : "replicate_webhook_failed",
    );
  }
}
