import { getSession } from "@/lib/auth/session";
import { HOLDER_MIN_TOKENS } from "@/lib/holder/constants";
import { HolderError, startHolderVerification } from "@/lib/holder/service";
import { OriginError, assertSameOrigin, jsonError } from "@/lib/security/origin";
import { RateLimitError, rateLimitOrThrow } from "@/lib/security/rate-limit";

function humanize(code: string) {
  if (code === "insufficient_accr_balance") {
    return `Hold at least ${HOLDER_MIN_TOKENS.toLocaleString()} $ACCR in this wallet on Robinhood Chain.`;
  }
  if (code === "holder_reward_already_claimed") {
    return "This wallet already received the holder reward.";
  }
  return code;
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await getSession(request);
    if (!session) {
      return jsonError(401, "unauthenticated", "Sign in with a wallet first.");
    }

    await rateLimitOrThrow(`holder-verify:${session.user.id}`, 10, 60 * 60 * 1000);

    const verification = await startHolderVerification(session.user.id, session.user.address);
    return Response.json({ verification });
  } catch (error) {
    if (error instanceof OriginError) {
      return jsonError(403, "forbidden_origin", "Request origin was rejected.");
    }
    if (error instanceof RateLimitError) {
      return jsonError(429, "rate_limited", "Too many verification attempts. Try again later.");
    }
    if (error instanceof HolderError) {
      return jsonError(error.status, error.message, humanize(error.message));
    }
    console.error("[holder/verify]", error);
    return jsonError(502, "holder_verify_failed", "Could not start holder verification.");
  }
}
