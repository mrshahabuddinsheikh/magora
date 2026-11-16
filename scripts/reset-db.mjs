// Deletes the local SQLite database and recreates it with demo data.
import { rmSync } from "node:fs";
import { execSync } from "node:child_process";
rmSync("apps/api/data", { recursive: true, force: true });
execSync("npm run setup -w @magora/api", { stdio: "inherit" });
