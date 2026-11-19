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
      if (!existing.has("bank_enabled")) {
        await conn.query(`ALTER TABLE cod_settings ADD COLUMN bank_enabled BOOLEAN NOT NULL DEFAULT TRUE`);
      }
      if (!existing.has("bank_instructions")) {
        await conn.query(`ALTER TABLE cod_settings ADD COLUMN bank_instructions TEXT`);
      }
      if (!existing.has("card_enabled")) {
        await conn.query(`ALTER TABLE cod_settings ADD COLUMN card_enabled BOOLEAN NOT NULL DEFAULT TRUE`);
      }
      if (!existing.has("card_title")) {
        await conn.query(`ALTER TABLE cod_settings ADD COLUMN card_title VARCHAR(255) DEFAULT 'Debit / Credit Card'`);
      }
      if (!existing.has("card_instructions")) {
        await conn.query(`ALTER TABLE cod_settings ADD COLUMN card_instructions TEXT`);
      }
      if (!existing.has("jazzcash_title")) {
        await conn.query(`ALTER TABLE cod_settings ADD COLUMN jazzcash_title VARCHAR(255) DEFAULT 'JazzCash'`);
      }
      if (!existing.has("jazzcash_account_title")) {
        await conn.query(`ALTER TABLE cod_settings ADD COLUMN jazzcash_account_title VARCHAR(255) DEFAULT ''`);
      }
      if (!existing.has("jazzcash_account_number")) {
        await conn.query(`ALTER TABLE cod_settings ADD COLUMN jazzcash_account_number VARCHAR(255) DEFAULT ''`);
      }
      if (!existing.has("jazzcash_instructions")) {
        await conn.query(`ALTER TABLE cod_settings ADD COLUMN jazzcash_instructions TEXT`);
      }
      if (!existing.has("easypaisa_enabled")) {
        await conn.query(`ALTER TABLE cod_settings ADD COLUMN easypaisa_enabled BOOLEAN NOT NULL DEFAULT TRUE`);
      }
      if (!existing.has("easypaisa_title")) {
        await conn.query(`ALTER TABLE cod_settings ADD COLUMN easypaisa_title VARCHAR(255) DEFAULT 'Easypaisa'`);
      }
      if (!existing.has("easypaisa_account_title")) {
        await conn.query(`ALTER TABLE cod_settings ADD COLUMN easypaisa_account_title VARCHAR(255) DEFAULT ''`);
      }
      if (!existing.has("easypaisa_account_number")) {
        await conn.query(`ALTER TABLE cod_settings ADD COLUMN easypaisa_account_number VARCHAR(255) DEFAULT ''`);
      }
      if (!existing.has("easypaisa_instructions")) {
        await conn.query(`ALTER TABLE cod_settings ADD COLUMN easypaisa_instructions TEXT`);
      }
      if (!existing.has("safepay_enabled")) {
        await conn.query(`ALTER TABLE cod_settings ADD COLUMN safepay_enabled BOOLEAN NOT NULL DEFAULT FALSE`);
      }
      if (!existing.has("safepay_api_key")) {
        await conn.query(`ALTER TABLE cod_settings ADD COLUMN safepay_api_key VARCHAR(255) DEFAULT ''`);
      }
      if (!existing.has("safepay_secret_key")) {
        await conn.query(`ALTER TABLE cod_settings ADD COLUMN safepay_secret_key VARCHAR(255) DEFAULT ''`);
      }
      if (!existing.has("safepay_env")) {
        await conn.query(`ALTER TABLE cod_settings ADD COLUMN safepay_env VARCHAR(32) NOT NULL DEFAULT 'sandbox'`);
      }
      if (!existing.has("jazzcash_enabled")) {
        await conn.query(`ALTER TABLE cod_settings ADD COLUMN jazzcash_enabled BOOLEAN NOT NULL DEFAULT FALSE`);
      }
      if (!existing.has("jazzcash_merchant_id")) {
        await conn.query(`ALTER TABLE cod_settings ADD COLUMN jazzcash_merchant_id VARCHAR(255) DEFAULT ''`);
      }
      if (!existing.has("jazzcash_password")) {
        await conn.query(`ALTER TABLE cod_settings ADD COLUMN jazzcash_password VARCHAR(255) DEFAULT ''`);
      }
      if (!existing.has("jazzcash_salt")) {
        await conn.query(`ALTER TABLE cod_settings ADD COLUMN jazzcash_salt VARCHAR(255) DEFAULT ''`);
      }
      if (!existing.has("jazzcash_env")) {
        await conn.query(`ALTER TABLE cod_settings ADD COLUMN jazzcash_env VARCHAR(32) NOT NULL DEFAULT 'sandbox'`);
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
