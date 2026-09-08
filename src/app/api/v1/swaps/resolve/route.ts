import { getSession } from "@/lib/auth/session";
import { resolveErc20 } from "@/lib/chains/resolve-token";
import { jsonError } from "@/lib/security/origin";
import { RateLimitError, rateLimitOrThrow } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/swaps/resolve?address=0x…
 * Resolves an arbitrary ERC-20 contract address on Robinhood Chain.
 * Returns { token } with symbol, name, decimals, logoURI.
 */
export async function GET(request: Request) {
  try {
    const session = await getSession(request);
    if (!session) {
      return jsonError(401, "unauthenticated", "Sign in with a wallet first.");
    }

    await rateLimitOrThrow(`resolve:${session.user.id}`, 30, 15 * 60 * 1000);

    const address = new URL(request.url).searchParams.get("address") ?? "";
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
      return jsonError(400, "invalid_address", "Provide a valid 0x address (40 hex chars).");
    }

    const token = await resolveErc20(address);
    if (!token) {
      return jsonError(404, "not_erc20", "Address is not a valid ERC-20 on Robinhood Chain.");
    }

    return Response.json({ token }, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return jsonError(429, "rate_limited", "Too many resolve requests.");
    }
    return jsonError(500, "resolve_failed", error instanceof Error ? error.message : "resolve_failed");
  }
}
