// One-time setup: creates .env files (if missing), the database and demo data.
import { existsSync, copyFileSync } from "node:fs";
import { execSync } from "node:child_process";

const copy = (from, to) => {
  if (!existsSync(to)) {
    copyFileSync(from, to);
    console.log(`✓ created ${to}`);
  }
};
copy("apps/api/.env.example", "apps/api/.env");
copy("apps/web/.env.example", "apps/web/.env.local");

execSync("npm run setup -w @magora/api", { stdio: "inherit" });
console.log("\n✓ All set! Now run:  npm run dev\n  Website → http://localhost:3000\n  API docs → http://localhost:4000/docs\n");
