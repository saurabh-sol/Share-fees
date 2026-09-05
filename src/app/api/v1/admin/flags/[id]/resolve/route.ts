import { z } from "zod";
import { AdminError, assertAdmin } from "@/lib/auth/admin";
import { ReviewError, resolveFraudFlag } from "@/lib/fraud/review";
import { LedgerError } from "@/lib/ledger/post-swap-reward";
import { OriginError, assertSameOrigin, jsonError } from "@/lib/security/origin";
import { flagResolveSchema } from "@/lib/validation/swap";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    await assertAdmin(request);
    const { id } = await context.params;
    if (!/^flag_[0-9a-fA-F-]{36}$/.test(id)) {
      return jsonError(400, "invalid_flag_id", "Flag id failed validation.");
    }
    const body = flagResolveSchema.parse(await request.json());
    const result = await resolveFraudFlag({
      flagId: id,
      action: body.action,
      reviewer: "admin",
    });
    return Response.json(result);
  } catch (error) {
    if (error instanceof OriginError) {
      return jsonError(403, "forbidden_origin", "Request origin was rejected.");
    }
    if (error instanceof AdminError) {
      return jsonError(error.status, error.message, "Admin request failed.");
    }
    if (error instanceof ReviewError || error instanceof LedgerError) {
      return jsonError(error.status, error.message, "Flag review was rejected.");
    }
    if (error instanceof z.ZodError) {
      return jsonError(400, "invalid_body", "Resolve payload failed validation.");
    }
    return jsonError(400, "resolve_failed", error instanceof Error ? error.message : "resolve_failed");
  }
}
