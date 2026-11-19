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

    // Idempotent column check for cod_settings (COD city restriction & Payoneer settings)
    try {
      const [cols] = await conn.query(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'cod_settings'`,
        [config.db.database]
      );
      const existing = new Set((cols as any[]).map((c: any) => c.COLUMN_NAME));
      if (!existing.has("city_restriction")) {
        await conn.query(`ALTER TABLE cod_settings ADD COLUMN city_restriction VARCHAR(32) NOT NULL DEFAULT 'selected_only'`);
      }
      if (!existing.has("allowed_cities")) {
        await conn.query(`ALTER TABLE cod_settings ADD COLUMN allowed_cities TEXT NOT NULL`);
        await conn.query(`UPDATE cod_settings SET allowed_cities = '["Karachi"]' WHERE allowed_cities IS NULL OR allowed_cities = ''`);
      }
      if (!existing.has("non_cod_notice")) {
        await conn.query(`ALTER TABLE cod_settings ADD COLUMN non_cod_notice TEXT`);
      }
      if (!existing.has("payoneer_enabled")) {
        await conn.query(`ALTER TABLE cod_settings ADD COLUMN payoneer_enabled BOOLEAN NOT NULL DEFAULT TRUE`);
      }
      if (!existing.has("payoneer_title")) {
        await conn.query(`ALTER TABLE cod_settings ADD COLUMN payoneer_title VARCHAR(255) DEFAULT 'Payoneer / Card / Online Transfer'`);
      }
      if (!existing.has("payoneer_email")) {
        await conn.query(`ALTER TABLE cod_settings ADD COLUMN payoneer_email VARCHAR(255) DEFAULT ''`);
      }
      if (!existing.has("payoneer_link")) {
        await conn.query(`ALTER TABLE cod_settings ADD COLUMN payoneer_link VARCHAR(500) DEFAULT ''`);
      }
      if (!existing.has("payoneer_instructions")) {
        await conn.query(`ALTER TABLE cod_settings ADD COLUMN payoneer_instructions TEXT`);
      }
      if (!existing.has("bank_title")) {
        await conn.query(`ALTER TABLE cod_settings ADD COLUMN bank_title VARCHAR(255) DEFAULT ''`);
      }
      if (!existing.has("bank_account")) {
        await conn.query(`ALTER TABLE cod_settings ADD COLUMN bank_account VARCHAR(255) DEFAULT ''`);
      }
      if (!existing.has("bank_iban")) {
        await conn.query(`ALTER TABLE cod_settings ADD COLUMN bank_iban VARCHAR(255) DEFAULT ''`);
      }
    } catch (e: any) {
      console.warn("Notice checking cod_settings columns:", e?.message);
    }

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
