import { and, lt, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { aiGenerations } from "@/lib/db/schema";
import { failJob } from "./finalize";

const STUCK_MS = 15 * 60 * 1000;

export async function releaseStuckAiJobs(limit = 20) {
  const db = await getDb();
  const cutoff = new Date(Date.now() - STUCK_MS);
  const rows = await db
    .select()
    .from(aiGenerations)
    .where(
      and(
        sql`${aiGenerations.status} in ('pending', 'processing')`,
        lt(aiGenerations.createdAt, cutoff),
      ),
    )
    .limit(limit);

  let released = 0;
  for (const job of rows) {
    await failJob(job, "generation_timed_out", db);
    released += 1;
  }
  return released;
}
