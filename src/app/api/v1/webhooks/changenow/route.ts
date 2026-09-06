import { AdminError } from "@/lib/auth/admin";
import { env } from "@/lib/env";
import { assertWebhookSecret } from "@/lib/jobs/auth";
import { upsertPendingSettle } from "@/lib/jobs/pending";
import { processPendingSettles } from "@/lib/jobs/settles";
import { jsonError } from "@/lib/security/origin";

export async function POST(request: Request) {
  try {
    assertWebhookSecret(request, env.changeNowWebhookSecret);
    const body = (await request.json()) as {
      id?: string;
      payinHash?: string;
      userId?: string;
      fromNetwork?: string;
      toNetwork?: string;
    };
    if (body.userId && (body.payinHash || body.id)) {
      await upsertPendingSettle({
        userId: body.userId,
        provider: "changenow",
        txHash: body.payinHash ?? body.id ?? "unknown",
        exchangeId: body.id,
        fromChain: body.fromNetwork ?? "unknown",
        toChain: body.toNetwork ?? "unknown",
      });
    }
    const processed = await processPendingSettles();
    return Response.json({ ok: true, processed });
  } catch (error) {
    if (error instanceof AdminError) {
      return jsonError(error.status, error.message, "Webhook rejected.");
    }
    return jsonError(
      400,
      "changenow_webhook_failed",
      error instanceof Error ? error.message : "changenow_webhook_failed",
    );
  }
}
