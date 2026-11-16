/**
 * Daily backup:  npm run db:backup
 *  - consistent copy of the SQLite database  → backups/store-YYYY-MM-DD_HHMM.db  (keeps the newest 14)
 *  - new uploaded photos / 3D files           → backups/uploads/ (only files not copied yet)
 * Put it on a schedule (see DEPLOY.md) and copy the backups folder off the server now and then.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { client } from "./client";
import { config } from "../config";

const dir = resolve(process.env.BACKUP_DIR ?? "./backups");
mkdirSync(dir, { recursive: true });

if (config.databaseUrl.startsWith("file:")) {
  const stamp = new Date().toISOString().slice(0, 16).replace("T", "_").replace(":", "");
  const file = join(dir, `store-${stamp}.db`).replace(/'/g, "''");
  await client.execute(`VACUUM INTO '${file}'`);
  console.log(`✓ Database → ${file} (${(statSync(file).size / 1024 / 1024).toFixed(1)} MB)`);
  const old = readdirSync(dir).filter((f) => /^store-.*\.db$/.test(f)).sort().reverse().slice(14);
  for (const f of old) rmSync(join(dir, f));
} else {
  console.log("• Database is hosted (Turso) — it keeps its own backups.");
}

const up = resolve(config.uploadDir);
if (existsSync(up)) {
  cpSync(up, join(dir, "uploads"), { recursive: true, force: false, errorOnExist: false });
  console.log(`✓ Uploads copied → ${join(dir, "uploads")}`);
}
client.close();
