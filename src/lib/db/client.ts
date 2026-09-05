import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { PGlite } from "@electric-sql/pglite";
import postgres from "postgres";
import fs from "node:fs";
import path from "node:path";
import { env } from "@/lib/env";
import * as schema from "./schema";
import { applyMigrations } from "./migrate";

type AppDb =
  | ReturnType<typeof drizzlePglite<typeof schema>>
  | ReturnType<typeof drizzlePostgres<typeof schema>>;

const globalForDb = globalThis as unknown as {
  t2cDb?: AppDb;
  t2cDbReady?: Promise<AppDb>;
};

async function createDb(): Promise<AppDb> {
  if (env.databaseUrl) {
    const client = postgres(env.databaseUrl, {
      max: 5,
      prepare: false,
    });
    const db = drizzlePostgres(client, { schema });
    await applyMigrations(db);
    return db;
  }

  const dataDir = path.join(process.cwd(), ".data", "t2c");
  fs.mkdirSync(path.dirname(dataDir), { recursive: true });
  const pglite = new PGlite(dataDir);
  await pglite.waitReady;
  const db = drizzlePglite(pglite, { schema });
  await applyMigrations(db);
  return db;
}

export async function getDb(): Promise<AppDb> {
  if (globalForDb.t2cDb) {
    return globalForDb.t2cDb;
  }
  if (!globalForDb.t2cDbReady) {
    globalForDb.t2cDbReady = createDb().then((db) => {
      globalForDb.t2cDb = db;
      return db;
    });
  }
  return globalForDb.t2cDbReady;
}

export async function createTestDb() {
  const pglite = new PGlite();
  await pglite.waitReady;
  const db = drizzlePglite(pglite, { schema });
  await applyMigrations(db);
  return db;
}
