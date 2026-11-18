import type { FastifyInstance } from "fastify";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pool, client } from "../db/client";
import { config } from "../config";
import { requireAdmin } from "../lib/auth";
import { badRequest } from "../lib/errors";
import { invalidate } from "../lib/cache";
import { revalidateWeb } from "../lib/revalidate";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function escapeSqlVal(v: any): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "1" : "0";
  if (v instanceof Date) return `'${v.toISOString().slice(0, 19).replace("T", " ")}'`;
  if (typeof v === "object") return `'${JSON.stringify(v).replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
  return `'${String(v).replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\r/g, "\\r").replace(/\n/g, "\\n")}'`;
}

async function generateMysqlDump(): Promise<string> {
  const [tablesRows] = await pool.query<any[]>("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
  const tables = tablesRows.map((r: any) => Object.values(r)[0] as string);

  let dump = `-- Magora Store MySQL Database Backup\n`;
  dump += `-- Generated: ${new Date().toISOString()}\n`;
  dump += `-- Database: ${config.db.database}\n`;
  dump += `\nSET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS = 0;\n\n`;

  for (const tbl of tables) {
    try {
      const [createRows] = await pool.query<any[]>(`SHOW CREATE TABLE \`${tbl}\``);
      const createSql = createRows[0]?.["Create Table"];
      if (createSql) {
        dump += `-- --------------------------------------------------------\n`;
        dump += `-- Table structure for table \`${tbl}\`\n`;
        dump += `-- --------------------------------------------------------\n`;
        dump += `DROP TABLE IF EXISTS \`${tbl}\`;\n`;
        dump += `${createSql};\n\n`;
      }
    } catch (e: any) {
      console.warn(`Could not export schema for table ${tbl}:`, e.message);
    }

    try {
      const [dataRows] = await pool.query<any[]>(`SELECT * FROM \`${tbl}\``);
      if (Array.isArray(dataRows) && dataRows.length > 0) {
        dump += `-- Dumping data for table \`${tbl}\` (${dataRows.length} rows)\n`;
        const cols = Object.keys(dataRows[0]).map((c) => `\`${c}\``).join(", ");
        
        const chunkSize = 100;
        for (let i = 0; i < dataRows.length; i += chunkSize) {
          const slice = dataRows.slice(i, i + chunkSize);
          const valuesSql = slice.map((row: any) => {
            const vals = Object.values(row).map(escapeSqlVal).join(", ");
            return `(${vals})`;
          }).join(",\n  ");
          dump += `INSERT INTO \`${tbl}\` (${cols}) VALUES\n  ${valuesSql};\n`;
        }
        dump += `\n`;
      }
    } catch (e: any) {
      console.warn(`Could not export data for table ${tbl}:`, e.message);
    }
  }

  dump += `SET FOREIGN_KEY_CHECKS = 1;\n-- Dump completed successfully\n`;
  return dump;
}

export async function databaseBackupRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAdmin);

  const backupDir = resolve("./apps/api/backups");
  mkdirSync(backupDir, { recursive: true });

  /** 1. Get Live MySQL Database Health, Size & Available Server Backups */
  app.get("/database/info", async () => {
    let totalSizeBytes = 0;
    let mysqlVersion = "MySQL 8.0";

    try {
      const [verRows] = await pool.query<any[]>("SELECT VERSION() as v");
      if (verRows[0]?.v) mysqlVersion = verRows[0].v;
    } catch {}

    try {
      const [sizeRows] = await pool.query<any[]>(`
        SELECT coalesce(SUM(data_length + index_length), 0) AS total_size
        FROM information_schema.TABLES
        WHERE table_schema = DATABASE()
      `);
      totalSizeBytes = Number(sizeRows[0]?.total_size || 0);
    } catch {}

    // Query table counts safely
    const [orders, products, variants, customers, leads, reels, reviews, returns, coupons, loyalty] = await Promise.all([
      client.execute("SELECT count(*) as count FROM orders").then((r) => Number((r.rows[0] as any)?.count || 0)).catch(() => 0),
      client.execute("SELECT count(*) as count FROM products").then((r) => Number((r.rows[0] as any)?.count || 0)).catch(() => 0),
      client.execute("SELECT count(*) as count FROM variants").then((r) => Number((r.rows[0] as any)?.count || 0)).catch(() => 0),
      client.execute("SELECT count(*) as count FROM users").then((r) => Number((r.rows[0] as any)?.count || 0)).catch(() => 0),
      client.execute("SELECT count(*) as count FROM customer_leads").then((r) => Number((r.rows[0] as any)?.count || 0)).catch(() => 0),
      client.execute("SELECT count(*) as count FROM shoppable_reels").then((r) => Number((r.rows[0] as any)?.count || 0)).catch(() => 0),
      client.execute("SELECT count(*) as count FROM reviews").then((r) => Number((r.rows[0] as any)?.count || 0)).catch(() => 0),
      client.execute("SELECT count(*) as count FROM return_requests").then((r) => Number((r.rows[0] as any)?.count || 0)).catch(() => 0),
      client.execute("SELECT count(*) as count FROM coupons").then((r) => Number((r.rows[0] as any)?.count || 0)).catch(() => 0),
      client.execute("SELECT count(*) as count FROM coin_transactions").then((r) => Number((r.rows[0] as any)?.count || 0)).catch(() => 0),
    ]);

    // List server backups (.sql or .json)
    const serverBackups: Array<{ name: string; size: string; sizeBytes: number; createdAt: string }> = [];
    if (existsSync(backupDir)) {
      const files = readdirSync(backupDir)
        .filter((f) => f.endsWith(".sql") || f.endsWith(".json") || f.endsWith(".db"))
        .sort()
        .reverse();

      for (const f of files.slice(0, 15)) {
        try {
          const s = statSync(join(backupDir, f));
          serverBackups.push({
            name: f,
            size: formatBytes(s.size),
            sizeBytes: s.size,
            createdAt: s.mtime.toISOString(),
          });
        } catch {}
      }
    }

    return {
      data: {
        databaseFile: `${config.db.database} (${mysqlVersion})`,
        databaseEngine: "MySQL 8 / InnoDB",
        mysqlVersion,
        size: formatBytes(totalSizeBytes),
        sizeBytes: totalSizeBytes,
        lastModified: new Date().toISOString(),
        counts: {
          orders,
          products,
          variants,
          customers,
          leads,
          reels,
          reviews,
          returns,
          coupons,
          loyalty,
        },
        serverBackups,
      },
    };
  });

  /** 2. 1-Click MySQL SQL Dump Download (.sql) */
  app.get("/database/download", async (_req, reply) => {
    const dump = await generateMysqlDump();
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const downloadName = `magora-mysql-backup-${stamp}.sql`;
    const buf = Buffer.from(dump, "utf-8");

    return reply
      .header("Content-Type", "application/sql; charset=utf-8")
      .header("Content-Disposition", `attachment; filename="${downloadName}"`)
      .header("Content-Length", buf.length)
      .send(buf);
  });

  /** 3. 1-Click JSON Data Export Download (.json) */
  app.get("/database/download-json", async (_req, reply) => {
    const [tablesRows] = await pool.query<any[]>("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
    const tables = tablesRows.map((r: any) => Object.values(r)[0] as string);

    const exportData: Record<string, unknown[]> = {};
    for (const tbl of tables) {
      try {
        const [rows] = await pool.query(`SELECT * FROM \`${tbl}\``);
        exportData[tbl] = rows as unknown[];
      } catch {
        exportData[tbl] = [];
      }
    }

    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const jsonStr = JSON.stringify({
      app: "Magora E-Commerce",
      exportedAt: new Date().toISOString(),
      databaseEngine: "MySQL",
      databaseName: config.db.database,
      tables: exportData,
    }, null, 2);

    const buf = Buffer.from(jsonStr, "utf-8");
    const downloadName = `magora-database-export-${stamp}.json`;

    return reply
      .header("Content-Type", "application/json; charset=utf-8")
      .header("Content-Disposition", `attachment; filename="${downloadName}"`)
      .header("Content-Length", buf.length)
      .send(buf);
  });

  /** 4. Create an on-demand server snapshot in ./backups */
  app.post("/database/create-snapshot", async () => {
    const dump = await generateMysqlDump();
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const snapshotName = `magora-mysql-snapshot-${stamp}.sql`;
    const snapshotPath = join(backupDir, snapshotName);

    writeFileSync(snapshotPath, dump, "utf-8");
    const s = statSync(snapshotPath);

    return {
      data: {
        success: true,
        name: snapshotName,
        size: formatBytes(s.size),
        createdAt: s.mtime.toISOString(),
      },
    };
  });

  /** 5. Restore Database from Uploaded File (.sql or .json) */
  app.post("/database/restore", async (req) => {
    const file = await req.file({ limits: { fileSize: 100 * 1024 * 1024 } }).catch(() => null);
    if (!file) throw badRequest("Please upload a .sql MySQL dump or .json export file", "no_file");

    const buf = await file.toBuffer().catch(() => {
      throw badRequest("Database file is larger than 100 MB", "too_large");
    });

    const filename = file.filename || "backup.sql";
    const isJson = filename.toLowerCase().endsWith(".json");
    const content = buf.toString("utf-8");

    // 1. Create safety snapshot before restore
    try {
      const dump = await generateMysqlDump();
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      writeFileSync(join(backupDir, `pre-restore-${stamp}.sql`), dump, "utf-8");
    } catch (e: any) {
      console.warn("Safety pre-restore backup skipped:", e.message);
    }

    if (!isJson) {
      // Execute SQL Dump
      try {
        await pool.query("SET FOREIGN_KEY_CHECKS = 0;");
        // Split statements by semicolon at the end of lines
        const stmts = content
          .split(/;\s*[\r\n]+/)
          .map((s) => s.trim())
          .filter((s) => s.length > 0 && !s.startsWith("--") && !s.startsWith("/*"));

        for (const stmt of stmts) {
          try {
            await pool.query(stmt);
          } catch (stmtErr: any) {
            console.warn("SQL statement warning during restore:", stmtErr.message);
          }
        }
        await pool.query("SET FOREIGN_KEY_CHECKS = 1;");
      } catch (err: any) {
        throw badRequest(`SQL Restore failed: ${err.message}`, "sql_error");
      }
    } else {
      // JSON Restore
      try {
        const parsed = JSON.parse(content);
        const tables = parsed.tables || parsed;
        await pool.query("SET FOREIGN_KEY_CHECKS = 0;");

        for (const [tbl, rows] of Object.entries(tables)) {
          if (!Array.isArray(rows) || rows.length === 0) continue;
          try {
            await pool.query(`DELETE FROM \`${tbl}\``);
            for (const row of rows as Record<string, unknown>[]) {
              const keys = Object.keys(row).map((k) => `\`${k}\``);
              const vals = Object.values(row).map(escapeSqlVal);
              await pool.query(`INSERT INTO \`${tbl}\` (${keys.join(", ")}) VALUES (${vals.join(", ")})`);
            }
          } catch (tblErr: any) {
            console.warn(`Could not restore table ${tbl}:`, tblErr.message);
          }
        }
        await pool.query("SET FOREIGN_KEY_CHECKS = 1;");
      } catch (err: any) {
        throw badRequest(`JSON Restore failed: ${err.message}`, "json_error");
      }
    }

    invalidate("catalog:");
    await revalidateWeb(["products", "models"]);

    const [ordersCnt, productsCnt, leadsCnt, reelsCnt] = await Promise.all([
      client.execute("SELECT count(*) as count FROM orders").then((r) => Number((r.rows[0] as any)?.count || 0)).catch(() => 0),
      client.execute("SELECT count(*) as count FROM products").then((r) => Number((r.rows[0] as any)?.count || 0)).catch(() => 0),
      client.execute("SELECT count(*) as count FROM customer_leads").then((r) => Number((r.rows[0] as any)?.count || 0)).catch(() => 0),
      client.execute("SELECT count(*) as count FROM shoppable_reels").then((r) => Number((r.rows[0] as any)?.count || 0)).catch(() => 0),
    ]);

    return {
      data: {
        success: true,
        message: "MySQL database restored successfully!",
        restoredCounts: {
          orders: ordersCnt,
          products: productsCnt,
          leads: leadsCnt,
          reels: reelsCnt,
        },
      },
    };
  });
}
