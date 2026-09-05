import { AdminError, assertAdmin } from "@/lib/auth/admin";
import { adminLedger } from "@/lib/admin/liability";
import { jsonError } from "@/lib/security/origin";

export async function GET(request: Request) {
  try {
    await assertAdmin(request);
    return Response.json(await adminLedger());
  } catch (error) {
    if (error instanceof AdminError) {
      return jsonError(error.status, error.message, "Admin request failed.");
    }
    return jsonError(400, "ledger_failed", error instanceof Error ? error.message : "ledger_failed");
  }
}
