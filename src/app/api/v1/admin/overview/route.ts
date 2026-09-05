import { AdminError, assertAdmin } from "@/lib/auth/admin";
import { adminOverview } from "@/lib/admin/liability";
import { jsonError } from "@/lib/security/origin";

export async function GET(request: Request) {
  try {
    await assertAdmin(request);
    return Response.json(await adminOverview());
  } catch (error) {
    if (error instanceof AdminError) {
      return jsonError(error.status, error.message, "Admin request failed.");
    }
    return jsonError(400, "overview_failed", error instanceof Error ? error.message : "overview_failed");
  }
}
