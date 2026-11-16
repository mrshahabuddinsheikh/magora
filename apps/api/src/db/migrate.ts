import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tuneDatabase, client, runMigrations } from "./client";

const here = dirname(fileURLToPath(import.meta.url));

await tuneDatabase();
await runMigrations(join(here, "../../drizzle"));
console.log("✓ Database migrated");
client.close();
