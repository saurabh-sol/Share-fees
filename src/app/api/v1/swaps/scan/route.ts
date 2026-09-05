import { getSession } from "@/lib/auth/session";
import { ScanError, scanWallet } from "@/lib/indexer/scan";
import { OriginError, assertSameOrigin, jsonError } from "@/lib/security/origin";
import { RateLimitError, rateLimitOrThrow } from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);

    const session = await getSession();
    if (!session) {
      return jsonError(401, "unauthenticated", "Sign in with a wallet first.");
    }

    await rateLimitOrThrow(`scan:${session.user.id}`, 30, 15 * 60 * 1000);

    const result = await scanWallet({
      userId: session.user.id,
      address: session.user.address,
    });
    return Response.json(result);
  } catch (error) {
    if (error instanceof OriginError) {
      return jsonError(403, "forbidden_origin", "Request origin was rejected.");
    }
    if (error instanceof RateLimitError) {
      return jsonError(429, "scan_cooldown", "Wait a few minutes before scanning again.");
    }
    if (error instanceof ScanError && error.status === 429) {
      return jsonError(429, "scan_cooldown", "Wait a few minutes before scanning again.");
    }
    return jsonError(502, "scan_failed", error instanceof Error ? error.message : "scan_failed");
  }
}
