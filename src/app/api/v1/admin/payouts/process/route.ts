import { AdminError, assertAdmin } from "@/lib/auth/admin";
import { processPayoutOutbox } from "@/lib/redeem/treasury";
import { OriginError, assertSameOrigin, jsonError } from "@/lib/security/origin";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    assertAdmin(request);
    const processed = await processPayoutOutbox();
    return Response.json({ processed });
  } catch (error) {
    if (error instanceof OriginError) {
      return jsonError(403, "forbidden_origin", "Request origin was rejected.");
    }
    if (error instanceof AdminError) {
      return jsonError(error.status, error.message, "Admin request failed.");
    }
    return jsonError(400, "payout_process_failed", error instanceof Error ? error.message : "payout_process_failed");
  }
}
