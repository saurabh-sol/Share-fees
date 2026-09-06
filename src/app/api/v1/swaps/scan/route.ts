import { getSession } from "@/lib/auth/session";
import { ScanError, scanWallet } from "@/lib/indexer/scan";
import { OriginError, assertSameOrigin, jsonError } from "@/lib/security/origin";
import { RateLimitError, rateLimitOrThrow } from "@/lib/security/rate-limit";

function humanizeScanError(message: string) {
  if (message === "rate_limited") return "Wait a few minutes before scanning again.";
  if (message.startsWith("zerion_401") || message.startsWith("zerion_403")) {
    return "History provider rejected the key. Check ZERION_API_KEY.";
  }
  if (message.startsWith("zerion_429")) return "History provider is rate-limiting. Retry in a minute.";
  if (message.startsWith("zerion_")) return "History provider failed. Retry the scan.";
  if (message.includes("getTime") || message.includes("Invalid time")) {
    return "Scan state was unreadable. Retry.";
  }
  if (message.includes("AbortError") || message.toLowerCase().includes("timeout")) {
    return "History provider timed out. Retry.";
  }
  return message;
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);

    const session = await getSession(request);
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
    console.error("[scan]", error instanceof Error ? error.stack ?? error.message : error);
    if (error instanceof OriginError) {
      return jsonError(403, "forbidden_origin", "Request origin was rejected.");
    }
    if (
      error instanceof RateLimitError ||
      (error instanceof Error && (error.name === "RateLimitError" || error.message === "rate_limited"))
    ) {
      return jsonError(429, "scan_cooldown", "Wait a few minutes before scanning again.");
    }
    if (error instanceof ScanError) {
      return jsonError(error.status, "scan_failed", humanizeScanError(error.message));
    }
    const raw = error instanceof Error ? error.message : "scan_failed";
    return jsonError(502, "scan_failed", humanizeScanError(raw));
  }
}
