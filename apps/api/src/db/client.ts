import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { config } from "../config";
import * as schema from "./schema";

const isLocalFile =
  config.databaseUrl.startsWith("file:") ||
  (!config.databaseUrl.startsWith("http:") &&
    !config.databaseUrl.startsWith("https:") &&
    !config.databaseUrl.startsWith("libsql:") &&
    !config.databaseUrl.startsWith("ws:"));

let dbInstance: any;
let clientInstance: any;

if (isLocalFile) {
  const Database = (await import("better-sqlite3")).default;
  const { drizzle } = await import("drizzle-orm/better-sqlite3");

  const rawPath = config.databaseUrl.startsWith("file:")
    ? config.databaseUrl.slice(5)
    : config.databaseUrl;

  mkdirSync(dirname(rawPath), { recursive: true });

  const sqlite = new Database(rawPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("synchronous = NORMAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");

  dbInstance = drizzle(sqlite, { schema });

  clientInstance = {
    execute: async (stmt: any) => {
      const sqlText = typeof stmt === "string" ? stmt : stmt.sql;
      const args = typeof stmt === "string" ? [] : Array.isArray(stmt.args) ? stmt.args : Object.values(stmt.args || {});
      const trimmed = sqlText.trim();

      if (/^(SELECT|PRAGMA\s+[a-z_]+$)/i.test(trimmed) && !/PRAGMA\s+.*=/i.test(trimmed)) {
        const rows = sqlite.prepare(sqlText).all(args);
        return {
          rows,
          columns: rows.length ? Object.keys(rows[0] as object) : [],
        };
      }

      const result = sqlite.prepare(sqlText).run(args);
      return {
        rows: [],
        columns: [],
        rowsAffected: result.changes,
        lastInsertRowid: result.lastInsertRowid,
      };
    },
    close: () => {
      try {
        sqlite.close();
      } catch {}
    },
  };
} else {
  const { createClient } = await import("@libsql/client");
  const { drizzle } = await import("drizzle-orm/libsql");

  clientInstance = createClient({
    url: config.databaseUrl,
    authToken: config.databaseAuthToken,
  });
  dbInstance = drizzle(clientInstance, { schema });
}

export const client = clientInstance;
export const db = dbInstance;
export type DB = typeof db;

export async function tuneDatabase() {
  if (!isLocalFile) return;
  await client.execute("PRAGMA journal_mode = WAL");
  await client.execute("PRAGMA synchronous = NORMAL");
  await client.execute("PRAGMA foreign_keys = ON");
  await client.execute("PRAGMA busy_timeout = 5000");
}

export async function runMigrations(folder: string) {
  if (isLocalFile) {
    const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
    await client.execute("PRAGMA foreign_keys = OFF");
    try {
      migrate(db, { migrationsFolder: folder });
    } finally {
      await client.execute("PRAGMA foreign_keys = ON");
    }
  } else {
    const { migrate } = await import("drizzle-orm/libsql/migrator");
    try {
      await migrate(db, { migrationsFolder: folder });
    } finally {}
  }
}
