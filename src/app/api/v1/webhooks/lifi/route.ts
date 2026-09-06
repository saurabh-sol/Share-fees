import { AdminError } from "@/lib/auth/admin";
import { env } from "@/lib/env";
import { assertWebhookSecret } from "@/lib/jobs/auth";
import { upsertPendingSettle } from "@/lib/jobs/pending";
import { processPendingSettles } from "@/lib/jobs/settles";
import { jsonError } from "@/lib/security/origin";

export async function POST(request: Request) {
  try {
    assertWebhookSecret(request, env.lifiWebhookSecret);
    const body = (await request.json()) as {
      txHash?: string;
      fromAddress?: string;
      fromChainId?: string | number;
      toChainId?: string | number;
      userId?: string;
    };
    if (body.txHash && body.userId) {
      await upsertPendingSettle({
        userId: body.userId,
        provider: "lifi",
        txHash: body.txHash,
        fromChain: String(body.fromChainId ?? "unknown"),
        toChain: String(body.toChainId ?? "unknown"),
      });
    }
    const processed = await processPendingSettles();
    return Response.json({ ok: true, processed });
  } catch (error) {
    if (error instanceof AdminError) {
      return jsonError(error.status, error.message, "Webhook rejected.");
    }
    return jsonError(400, "lifi_webhook_failed", error instanceof Error ? error.message : "lifi_webhook_failed");
  }
}
