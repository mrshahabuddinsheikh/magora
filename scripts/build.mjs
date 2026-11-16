// The website pre-renders pages from the API, so the API must be running while building.
import { spawn, execSync } from "node:child_process";
import path from "node:path";

let alreadyRunning = false;
try {
  const r = await fetch("http://127.0.0.1:4000/health");
  if (r.ok) alreadyRunning = true;
} catch {}

let api = null;
if (!alreadyRunning) {
  const fallbackSecret = "c8d4f9b2a1e76543089dcbafe1234567890abcdef1234567890abcdef1234567";
  const tsxCli = path.resolve("node_modules", "tsx", "dist", "cli.mjs");
  api = spawn(process.execPath, [tsxCli, "src/server.ts"], {
    cwd: "apps/api",
    env: {
      ...process.env,
      PORT: "4000",
      HOST: "0.0.0.0",
      JWT_SECRET: process.env.JWT_SECRET || fallbackSecret,
      WEB_REVALIDATE_SECRET: process.env.WEB_REVALIDATE_SECRET || fallbackSecret,
      CORS_ORIGINS: process.env.CORS_ORIGINS || "https://new.officialhayafoundation.com",
      PUBLIC_API_URL: process.env.PUBLIC_API_URL || "https://new.officialhayafoundation.com/api/v1",
      PUBLIC_WEB_URL: process.env.PUBLIC_WEB_URL || "https://new.officialhayafoundation.com",
    },
    stdio: "inherit",
  });
  let healthy = false;
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch("http://127.0.0.1:4000/health");
      if (r.ok) {
        healthy = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!healthy) throw new Error("API did not start");
}

try {
  execSync("npm run build -w @magora/web", { stdio: "inherit" });
} finally {
  if (api) api.kill();
}
