import { desc } from "drizzle-orm";
import { AdminError, assertAdmin } from "@/lib/auth/admin";
import { getDb } from "@/lib/db/client";
import { payoutOutbox } from "@/lib/db/schema";
import { jsonError } from "@/lib/security/origin";

export async function GET(request: Request) {
  try {
    await assertAdmin(request);
    const db = await getDb();
    const rows = await db.select().from(payoutOutbox).orderBy(desc(payoutOutbox.createdAt)).limit(40);
    return Response.json({ payouts: rows });
  } catch (error) {
    if (error instanceof AdminError) {
      return jsonError(error.status, error.message, "Admin request failed.");
    }
    return jsonError(400, "payouts_failed", error instanceof Error ? error.message : "payouts_failed");
  }
}