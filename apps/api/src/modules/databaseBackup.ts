import type { FastifyInstance } from "fastify";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { nanoid } from "nanoid";
import { client } from "../db/client";
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

export async function databaseBackupRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAdmin);

  const dbPath = resolve(config.databaseUrl.replace(/^file:/, ""));
  const backupDir = resolve("./backups");
  mkdirSync(backupDir, { recursive: true });

  /** 1. Get Live Database Health, Size & Available Server Backups */
  app.get("/database/info", async () => {
    let dbSize = 0;
    let walSize = 0;
    let lastModified = new Date().toISOString();

    if (existsSync(dbPath)) {
      const st = statSync(dbPath);
      dbSize = st.size;
      lastModified = st.mtime.toISOString();
    }
    const walPath = `${dbPath}-wal`;
    if (existsSync(walPath)) {
      walSize = statSync(walPath).size;
    }

    // Query table counts safely
    const [orders, products, variants, customers, leads, reels, reviews, returns, coupons] = await Promise.all([
      client.execute("SELECT count(*) as count FROM orders").then((r) => Number((r.rows[0] as any)?.count || 0)).catch(() => 0),
      client.execute("SELECT count(*) as count FROM products").then((r) => Number((r.rows[0] as any)?.count || 0)).catch(() => 0),
      client.execute("SELECT count(*) as count FROM variants").then((r) => Number((r.rows[0] as any)?.count || 0)).catch(() => 0),
      client.execute("SELECT count(*) as count FROM users").then((r) => Number((r.rows[0] as any)?.count || 0)).catch(() => 0),
      client.execute("SELECT count(*) as count FROM customer_leads").then((r) => Number((r.rows[0] as any)?.count || 0)).catch(() => 0),
      client.execute("SELECT count(*) as count FROM shoppable_reels").then((r) => Number((r.rows[0] as any)?.count || 0)).catch(() => 0),
      client.execute("SELECT count(*) as count FROM reviews").then((r) => Number((r.rows[0] as any)?.count || 0)).catch(() => 0),
      client.execute("SELECT count(*) as count FROM return_requests").then((r) => Number((r.rows[0] as any)?.count || 0)).catch(() => 0),
      client.execute("SELECT count(*) as count FROM coupons").then((r) => Number((r.rows[0] as any)?.count || 0)).catch(() => 0),
    ]);

    // List server backups
    const serverBackups: Array<{ name: string; size: string; sizeBytes: number; createdAt: string }> = [];
    if (existsSync(backupDir)) {
      const files = readdirSync(backupDir)
        .filter((f) => f.endsWith(".db") || f.endsWith(".bak"))
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
        databaseFile: "store.db",
        size: formatBytes(dbSize),
        sizeBytes: dbSize,
        walSize: formatBytes(walSize),
        lastModified,
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
        },
        serverBackups,
      },
    };
  });

  /** 2. 1-Click Binary SQLite Download */
  app.get("/database/download", async (_req, reply) => {
    // Checkpoint any open WAL changes
    try {
      await client.execute("PRAGMA wal_checkpoint(TRUNCATE)");
    } catch {}

    const tempDir = resolve("./data/temp_backups");
    mkdirSync(tempDir, { recursive: true });

    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const tempFile = join(tempDir, `snap-${nanoid(8)}.db`);

    // VACUUM INTO produces an atomic, zero-lock, clean standalone copy
    await client.execute(`VACUUM INTO '${tempFile.replace(/'/g, "''")}'`);

    const buf = readFileSync(tempFile);
    rmSync(tempFile, { force: true });

    const downloadName = `magora-database-backup-${stamp}.db`;

    return reply
      .header("Content-Type", "application/x-sqlite3")
      .header("Content-Disposition", `attachment; filename="${downloadName}"`)
      .header("Content-Length", buf.length)
      .send(buf);
  });

  /** 3. 1-Click JSON Data Export Download */
  app.get("/database/download-json", async (_req, reply) => {
    const tables = [
      "products", "variants", "categories", "product_brands", "custom_styles",
      "orders", "order_items", "users", "customer_leads", "shoppable_reels",
      "reviews", "coupons", "trust_signals", "trust_settings", "return_requests"
    ];

    const exportData: Record<string, unknown[]> = {};
    for (const tbl of tables) {
      try {
        const res = await client.execute(`SELECT * FROM ${tbl}`);
        exportData[tbl] = res.rows as unknown[];
      } catch {
        exportData[tbl] = [];
      }
    }

    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const jsonStr = JSON.stringify({
      app: "Magora E-Commerce",
      exportedAt: new Date().toISOString(),
      databaseVersion: "1.0.0",
      tables: exportData,
    }, null, 2);

    const buf = Buffer.from(jsonStr, "utf-8");
    const downloadName = `magora-database-export-${stamp}.json`;

    return reply
      .header("Content-Type", "application/json")
      .header("Content-Disposition", `attachment; filename="${downloadName}"`)
      .header("Content-Length", buf.length)
      .send(buf);
  });

  /** 4. Create an on-demand server snapshot in ./backups */
  app.post("/database/create-snapshot", async () => {
    try {
      await client.execute("PRAGMA wal_checkpoint(TRUNCATE)");
    } catch {}

    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const snapshotName = `store-manual-${stamp}.db`;
    const snapshotPath = join(backupDir, snapshotName);

    await client.execute(`VACUUM INTO '${snapshotPath.replace(/'/g, "''")}'`);
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

  /** 5. Restore Database from Uploaded File (.db or .json) */
  app.post("/database/restore", async (req) => {
    const file = await req.file({ limits: { fileSize: 100 * 1024 * 1024 } }).catch(() => null);
    if (!file) throw badRequest("Please upload a .db SQLite backup or .json export file", "no_file");

    const buf = await file.toBuffer().catch(() => {
      throw badRequest("Database file is larger than 100 MB", "too_large");
    });

    const filename = file.filename || "backup.db";
    const isJson = filename.toLowerCase().endsWith(".json");

    // If binary, verify SQLite format 3 signature
    if (!isJson) {
      const header = buf.subarray(0, 16).toString("utf8");
      if (!header.startsWith("SQLite format 3")) {
        throw badRequest("Invalid database file. Must be a valid SQLite database (.db) file.", "invalid_db");
      }
    }

    // 1. Create an automated pre-restore safety rollback snapshot
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const rollbackName = `pre-restore-${stamp}.db`;
    const rollbackPath = join(backupDir, rollbackName);

    try {
      await client.execute("PRAGMA wal_checkpoint(TRUNCATE)");
      await client.execute(`VACUUM INTO '${rollbackPath.replace(/'/g, "''")}'`);
    } catch (err) {
      console.warn("Could not create pre-restore snapshot:", err);
    }

    if (!isJson) {
      // Binary SQLite restore
      const walPath = `${dbPath}-wal`;
      const shmPath = `${dbPath}-shm`;

      // Flush and delete existing WAL & SHM to prevent stale journal playback
      try { await client.execute("PRAGMA wal_checkpoint(TRUNCATE)"); } catch {}
      if (existsSync(walPath)) { try { rmSync(walPath); } catch {} }
      if (existsSync(shmPath)) { try { rmSync(shmPath); } catch {} }

      // Write restored database file
      writeFileSync(dbPath, buf);

      // Verify restored database integrity
      try {
        const check = await client.execute("PRAGMA integrity_check");
        const row = check.rows[0] as any;
        const res = row?.[0] || row?.integrity_check || "ok";
        if (res !== "ok") {
          // Auto rollback
          if (existsSync(rollbackPath)) {
            writeFileSync(dbPath, readFileSync(rollbackPath));
          }
          throw badRequest("Integrity check failed on uploaded database. Automatically rolled back.", "corrupt_db");
        }
      } catch (e: unknown) {
        if (e instanceof Error && e.message.includes("Integrity check failed")) throw e;
      }
    } else {
      // JSON Restore: import tables
      try {
        const parsed = JSON.parse(buf.toString("utf-8"));
        const tables = parsed.tables || parsed;
        
        try {
          await client.execute("SET FOREIGN_KEY_CHECKS = 0;");
        } catch {}
        for (const [tbl, rows] of Object.entries(tables)) {
          if (!Array.isArray(rows) || rows.length === 0) continue;
          // Verify table exists in MySQL / information_schema
          const checkTable = await client.execute(`SELECT table_name as name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = '${tbl.replace(/'/g, "")}'`);
          if (checkTable.rows.length === 0) continue;

          await client.execute(`DELETE FROM ${tbl}`);
          for (const row of rows as Record<string, unknown>[]) {
            const keys = Object.keys(row);
            const placeholders = keys.map(() => "?").join(", ");
            const values = Object.values(row).map((v) => (v === undefined ? null : v));
            await client.execute({
              sql: `INSERT INTO ${tbl} (${keys.join(", ")}) VALUES (${placeholders})`,
              args: values as never,
            });
          }
        }
        try {
          await client.execute("SET FOREIGN_KEY_CHECKS = 1;");
        } catch {}
      } catch (err: unknown) {
        // Rollback from snapshot
        if (existsSync(rollbackPath)) {
          writeFileSync(dbPath, readFileSync(rollbackPath));
        }
        throw badRequest(`JSON restore failed: ${err instanceof Error ? err.message : "Unknown error"}. Rolled back.`, "json_error");
      }
    }

    // Invalidate web cache and revalidate pages
    invalidate("catalog:");
    await revalidateWeb(["products", "models"]);

    // Fetch updated stats
    const [ordersCnt, productsCnt, leadsCnt, reelsCnt] = await Promise.all([
      client.execute("SELECT count(*) as count FROM orders").then((r) => Number((r.rows[0] as any)?.count || 0)).catch(() => 0),
      client.execute("SELECT count(*) as count FROM products").then((r) => Number((r.rows[0] as any)?.count || 0)).catch(() => 0),
      client.execute("SELECT count(*) as count FROM customer_leads").then((r) => Number((r.rows[0] as any)?.count || 0)).catch(() => 0),
      client.execute("SELECT count(*) as count FROM shoppable_reels").then((r) => Number((r.rows[0] as any)?.count || 0)).catch(() => 0),
    ]);

    return {
      data: {
        success: true,
        message: "Database restored successfully!",
        rollbackBackupCreated: rollbackName,
        restoredCounts: {
          orders: ordersCnt,
          products: productsCnt,
          leads: leadsCnt,
          reels: reelsCnt,
        },
      },
    };
  });

  /** 6. Restore from an existing server snapshot in ./backups */
  app.post("/database/restore-snapshot", async (req) => {
    const body = req.body as { snapshotName?: string };
    if (!body?.snapshotName) throw badRequest("Please provide snapshotName", "missing_param");

    const targetFile = join(backupDir, body.snapshotName);
    if (!existsSync(targetFile)) throw badRequest("Selected snapshot does not exist on server", "not_found");

    // 1. Create safety snapshot of current
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const rollbackName = `pre-restore-${stamp}.db`;
    const rollbackPath = join(backupDir, rollbackName);

    try {
      await client.execute("PRAGMA wal_checkpoint(TRUNCATE)");
      await client.execute(`VACUUM INTO '${rollbackPath.replace(/'/g, "''")}'`);
    } catch {}

    const walPath = `${dbPath}-wal`;
    const shmPath = `${dbPath}-shm`;
    try { await client.execute("PRAGMA wal_checkpoint(TRUNCATE)"); } catch {}
    if (existsSync(walPath)) { try { rmSync(walPath); } catch {} }
    if (existsSync(shmPath)) { try { rmSync(shmPath); } catch {} }

    // Copy snapshot to dbPath
    writeFileSync(dbPath, readFileSync(targetFile));

    invalidate("catalog:");
    await revalidateWeb(["products", "models"]);

    return {
      data: {
        success: true,
        message: `Restored successfully from ${body.snapshotName}!`,
        rollbackBackupCreated: rollbackName,
      },
    };
  });
}
