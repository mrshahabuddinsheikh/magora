/**
 * Forgot the admin password?  Run on the server:
 *   npm run admin:password -- you@email.com NewStrongPassword
 * Creates the admin if that email doesn't exist yet.
 */
import bcrypt from "bcryptjs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { client, db, runMigrations } from "./client";
import * as s from "./schema";

const [email, pass] = process.argv.slice(2);
if (!email || !pass || pass.length < 10) {
  console.error("Usage: npm run admin:password -- you@email.com NewStrongPassword   (10+ characters)");
  process.exit(1);
}
await runMigrations(join(dirname(fileURLToPath(import.meta.url)), "../../drizzle"));
const e = email.trim().toLowerCase();
const hash = await bcrypt.hash(pass, 10);
const [u] = await db.select().from(s.users).where(eq(s.users.email, e));
if (u) await db.update(s.users).set({ passwordHash: hash, role: "admin" }).where(eq(s.users.id, u.id));
else await db.insert(s.users).values({ name: "Store Admin", email: e, passwordHash: hash, role: "admin" });
console.log(`✓ Admin password set for ${e}`);
client.close();
