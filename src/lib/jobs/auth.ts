import { AdminError, assertAdmin } from "@/lib/auth/admin";
import { env } from "@/lib/env";

export async function assertJobCaller(request: Request) {
  const cron = env.cronSecret;
  const authorization = request.headers.get("authorization");
  if (cron && authorization === `Bearer ${cron}`) {
    return;
  }
  if (request.method === "GET") {
    throw new AdminError("cron_unauthorized", 401);
  }
  await assertAdmin(request);
}

export function assertWebhookSecret(request: Request, secret: string | undefined) {
  if (!secret) {
    throw new AdminError("webhook_unconfigured", 503);
  }
  const header =
    request.headers.get("x-webhook-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (header !== secret) {
    throw new AdminError("webhook_unauthorized", 401);
  }
}
