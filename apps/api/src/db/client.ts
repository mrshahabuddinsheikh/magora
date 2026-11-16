import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { config } from "../config";
import * as schema from "./schema";

if (config.databaseUrl.startsWith("file:")) {
  mkdirSync(dirname(config.databaseUrl.slice(5)), { recursive: true });
}

export const client = createClient({
  url: config.databaseUrl,
  authToken: config.databaseAuthToken,
});

export const db = drizzle(client, { schema });
export type DB = typeof db;

/** Faster local SQLite: WAL lets reads continue while orders are being written */
export async function tuneDatabase() {
  if (!config.databaseUrl.startsWith("file:")) return;
  await client.execute("PRAGMA journal_mode = WAL");
  await client.execute("PRAGMA synchronous = NORMAL");
  await client.execute("PRAGMA foreign_keys = ON");
  await client.execute("PRAGMA busy_timeout = 5000");
}

/**
 * Apply pending migrations. Foreign keys are switched off while they run so
 * SQLite table rebuilds (drop + rename) never cascade into carts or orders.
 */
export async function runMigrations(folder: string) {
  const { migrate } = await import("drizzle-orm/libsql/migrator");
  const local = config.databaseUrl.startsWith("file:");
  if (local) await client.execute("PRAGMA foreign_keys = OFF");
  try {
    await migrate(db, { migrationsFolder: folder });
  } finally {
    if (local) await client.execute("PRAGMA foreign_keys = ON");
  }
}
