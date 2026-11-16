import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { config } from "../config";
import * as schema from "./schema";

export const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export const db = drizzle(pool, { schema, mode: "default" });

export const client = {
  execute: async (stmt: any): Promise<{ rows: any[]; columns: string[]; rowsAffected: number; lastInsertRowid: number }> => {
    const sqlText = typeof stmt === "string" ? stmt : stmt.sql;
    const args = typeof stmt === "string" ? [] : Array.isArray(stmt.args) ? stmt.args : Object.values(stmt.args || {});
    const [rows, fields] = await pool.query(sqlText, args);
    return {
      rows: Array.isArray(rows) ? (rows as any[]) : [],
      columns: Array.isArray(fields) ? (fields as any[]).map((f: any) => f.name) : [],
      rowsAffected: (rows as any)?.affectedRows || 0,
      lastInsertRowid: (rows as any)?.insertId || 0,
    };
  },
  close: async () => {
    try {
      await pool.end();
    } catch {}
  },
};

export type DB = typeof db;

export async function tuneDatabase() {
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    console.log(`✓ Connected to MySQL database (${config.db.database})`);
  } catch (err: any) {
    console.error(`✗ Failed to connect to MySQL database (${config.db.database}):`, err.message);
    throw err;
  }
}

export async function runMigrations(folder: string) {
  try {
    const { migrate } = await import("drizzle-orm/mysql2/migrator");
    await migrate(db, { migrationsFolder: folder });
  } catch (err: any) {
    console.warn("Migration notice:", err.message);
  }
}
