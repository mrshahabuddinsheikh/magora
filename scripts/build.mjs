// The website pre-renders pages from the API, so the API must be running while building.
import { spawn, execSync } from "node:child_process";

let alreadyRunning = false;
try {
  const r = await fetch("http://127.0.0.1:4000/health");
  if (r.ok) alreadyRunning = true;
} catch {}

let api = null;
if (!alreadyRunning) {
  api = spawn(process.execPath, ["--import", "tsx", "src/server.ts"], { cwd: "apps/api", stdio: "inherit" });
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
