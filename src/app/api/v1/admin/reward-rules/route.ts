import { desc } from "drizzle-orm";
import { z } from "zod";
import { AdminError, assertAdmin } from "@/lib/auth/admin";
import { getDb } from "@/lib/db/client";
import { rewardRules } from "@/lib/db/schema";
import { OriginError, assertSameOrigin, jsonError } from "@/lib/security/origin";
import { rewardRuleSchema } from "@/lib/validation/swap";

export async function GET(request: Request) {
  try {
    await assertAdmin(request);
    const db = await getDb();
    const rules = await db.select().from(rewardRules).orderBy(desc(rewardRules.version));
    return Response.json({ rules });
  } catch (error) {
    if (error instanceof AdminError) {
      return jsonError(error.status, error.message, "Admin request failed.");
    }
    return jsonError(400, "rules_failed", error instanceof Error ? error.message : "rules_failed");
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await assertAdmin(request);
    const body = rewardRuleSchema.parse(await request.json());
    const db = await getDb();
    const latest = await db
      .select()
      .from(rewardRules)
      .orderBy(desc(rewardRules.version))
      .limit(1);
    const version = (latest[0]?.version ?? 0) + 1;
    const id = `rule_v${version}`;
    await db.insert(rewardRules).values({
      id,
      version,
      conversionBps: body.conversionBps,
      minNotionalUsdCents: body.minNotionalUsdCents,
      dailyCapUsdCents: body.dailyCapUsdCents,
      enabled: body.enabled ? 1 : 0,
      activeFrom: new Date(),
    });
    return Response.json({ id, version });
  } catch (error) {
    if (error instanceof OriginError) {
      return jsonError(403, "forbidden_origin", "Request origin was rejected.");
    }
    if (error instanceof z.ZodError) {
      return jsonError(400, "invalid_body", "Rule payload failed validation.");
    }
    if (error instanceof AdminError) {
      return jsonError(error.status, error.message, "Admin request failed.");
    }
    return jsonError(400, error instanceof Error ? error.message : "admin_failed", "Admin request failed.");
  }
}
