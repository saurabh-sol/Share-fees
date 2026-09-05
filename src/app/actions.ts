"use server";

import { neon } from "@neondatabase/serverless";
import { getDb } from "@/lib/db/client";

export type NeonConnectionData = {
  ok: true;
  connectedAt: string;
  users: number;
  rewardRules: number;
  swaps: number;
  wallets: number;
};

function createSql() {
  let databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }
  if (
    (databaseUrl.startsWith("'") && databaseUrl.endsWith("'")) ||
    (databaseUrl.startsWith('"') && databaseUrl.endsWith('"'))
  ) {
    databaseUrl = databaseUrl.slice(1, -1);
  }
  return neon(databaseUrl);
}

export async function getData(): Promise<NeonConnectionData> {
  await getDb();

  const sql = createSql();
  const rows = await sql`
    SELECT
      1 AS ok,
      now() AS connected_at,
      (SELECT count(*)::int FROM users) AS users,
      (SELECT count(*)::int FROM reward_rules) AS reward_rules,
      (SELECT count(*)::int FROM swaps) AS swaps,
      (SELECT count(*)::int FROM wallets) AS wallets
  `;

  const row = rows[0];
  if (!row) {
    throw new Error("Neon query returned no rows");
  }

  return {
    ok: true,
    connectedAt: new Date(String(row.connected_at)).toISOString(),
    users: Number(row.users),
    rewardRules: Number(row.reward_rules),
    swaps: Number(row.swaps),
    wallets: Number(row.wallets),
  };
}
