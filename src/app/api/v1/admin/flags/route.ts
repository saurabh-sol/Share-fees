import { AdminError, assertAdmin } from "@/lib/auth/admin";
import { listOpenFlags } from "@/lib/admin/liability";
import { jsonError } from "@/lib/security/origin";

export async function GET(request: Request) {
  try {
    await assertAdmin(request);
    return Response.json({ flags: await listOpenFlags() });
  } catch (error) {
    if (error instanceof AdminError) {
      return jsonError(error.status, error.message, "Admin request failed.");
    }
    return jsonError(400, "flags_failed", error instanceof Error ? error.message : "flags_failed");
  }
}
