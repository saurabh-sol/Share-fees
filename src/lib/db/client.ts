import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { PGlite } from "@electric-sql/pglite";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";
import { env } from "@/lib/env";
import * as schema from "./schema";
import { applyMigrations } from "./migrate";

type AppDb =
  | ReturnType<typeof drizzleNeon<typeof schema>>
  | ReturnType<typeof drizzlePglite<typeof schema>>;

const DB_CACHE_GEN = 4;

const globalForDb = globalThis as unknown as {
  t2cDbGen?: number;
  t2cDb?: AppDb;
  t2cDbReady?: Promise<AppDb>;
};

if (globalForDb.t2cDbGen !== DB_CACHE_GEN) {
  globalForDb.t2cDbGen = DB_CACHE_GEN;
  globalForDb.t2cDb = undefined;
  globalForDb.t2cDbReady = undefined;
}

if (typeof WebSocket !== "undefined") {
  neonConfig.webSocketConstructor = WebSocket;
}

function databaseUrl(): string | undefined {
  const raw = process.env.DATABASE_URL ?? env.databaseUrl;
  if (!raw) return undefined;
  const value = typeof raw === "string" ? raw.trim() : String(raw);
  if (
    (value.startsWith("'") && value.endsWith("'")) ||
    (value.startsWith('"') && value.endsWith('"'))
  ) {
    return value.slice(1, -1);
  }
  return value || undefined;
}

function localDataDir(): string {
  const cwd = process.cwd();
  const base = cwd.startsWith("file:") ? fileURLToPath(cwd) : cwd;
  return path.join(base, ".data", "t2c");
}

async function createDb(): Promise<AppDb> {
  const url = databaseUrl();
  if (url) {
    const pool = new Pool({ connectionString: url });
    const db = drizzleNeon({ client: pool, schema });
    await applyMigrations(db);
    return db;
  }

  const dataDir = localDataDir();
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
    globalForDb.t2cDbReady = createDb()
      .then((db) => {
        globalForDb.t2cDb = db;
        return db;
      })
      .catch((error) => {
        globalForDb.t2cDbReady = undefined;
        throw error;
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
