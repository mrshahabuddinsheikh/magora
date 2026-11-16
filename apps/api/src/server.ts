import { buildApp } from "./app";
import { config } from "./config";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { runMigrations, tuneDatabase } from "./db/client";

await tuneDatabase();
// apply any new database migrations automatically on start (safe to run every time)
await runMigrations(join(dirname(fileURLToPath(import.meta.url)), "../drizzle"));
const app = await buildApp();
await app.listen({ port: config.port, host: config.host });
console.log(`✓ API running   → http://localhost:${config.port}/api/v1`);
console.log(`✓ API docs      → http://localhost:${config.port}/docs`);

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, async () => {
    await app.close();
    process.exit(0);
  });
}
