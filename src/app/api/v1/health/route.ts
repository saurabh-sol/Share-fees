import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { env } from "@/lib/env";
import { redisPing } from "@/lib/redis/client";
import { treasuryCanBroadcast } from "@/lib/redeem/treasury";

export async function GET() {
  let database = false;
  try {
    const db = await getDb();
    await db.execute(sql`SELECT 1 AS ok`);
    database = true;
  } catch {
    database = false;
  }

  let redis = false;
  try {
    redis = await redisPing();
  } catch {
    redis = false;
  }

  const ok = database && (env.nodeEnv !== "production" || redis);
  return Response.json(
    {
      ok,
      database,
      redis,
      treasuryCanBroadcast: treasuryCanBroadcast(),
      cronConfigured: Boolean(env.cronSecret),
      adminConfigured: Boolean(env.adminSecret),
    },
    { status: ok ? 200 : 503 },
  );
}
