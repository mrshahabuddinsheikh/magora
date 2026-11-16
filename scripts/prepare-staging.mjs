import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const stagingDir = path.join(rootDir, "staging");

console.log("📦 Preparing clean production staging bundle...");

// 1. Clean staging directory
if (fs.existsSync(stagingDir)) {
  fs.rmSync(stagingDir, { recursive: true, force: true });
}
fs.mkdirSync(stagingDir, { recursive: true });

function copyRecursive(src, dest, ignoreNames = []) {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    const items = fs.readdirSync(src);
    for (const item of items) {
      if (ignoreNames.includes(item)) continue;
      copyRecursive(path.join(src, item), path.join(dest, item), ignoreNames);
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

// 2. Root files
["package.json", "package-lock.json", "server.js"].forEach((file) => {
  const p = path.join(rootDir, file);
  if (fs.existsSync(p)) fs.copyFileSync(p, path.join(stagingDir, file));
});

// 3. apps/api files (STRICTLY NO store.db, NO uploads, NO backups)
const apiDest = path.join(stagingDir, "apps", "api");
["package.json", "tsconfig.json", "drizzle.config.ts"].forEach((f) => {
  const p = path.join(rootDir, "apps", "api", f);
  if (fs.existsSync(p)) copyRecursive(p, path.join(apiDest, f));
});
copyRecursive(path.join(rootDir, "apps", "api", "src"), path.join(apiDest, "src"));
copyRecursive(path.join(rootDir, "apps", "api", "dist"), path.join(apiDest, "dist"));
copyRecursive(path.join(rootDir, "apps", "api", "drizzle"), path.join(apiDest, "drizzle"));

// 4. apps/web files
const webDest = path.join(stagingDir, "apps", "web");
["package.json", "tsconfig.json", "next.config.ts"].forEach((f) => {
  const p = path.join(rootDir, "apps", "web", f);
  if (fs.existsSync(p)) copyRecursive(p, path.join(webDest, f));
});
copyRecursive(path.join(rootDir, "apps", "web", "public"), path.join(webDest, "public"));

// Copy compiled .next output (excluding cache, diagnostics, dev)
const nextBuildDir = path.join(rootDir, "apps", "web", ".next");
if (fs.existsSync(nextBuildDir)) {
  console.log("⚡ Copying compiled Next.js output...");
  copyRecursive(nextBuildDir, path.join(webDest, ".next"), ["cache", "diagnostics", "dev"]);
} else {
  console.warn("⚠️ Warning: apps/web/.next not found. Make sure to run 'npm run build' first!");
}

console.log("✓ Staging bundle successfully prepared at: " + stagingDir);
