import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

console.log("====================================================");
console.log("⚡ Building Magora Store (API + Web)...");
console.log("====================================================");

try {
  // 1. Compile Fastify API into lightweight standalone Node.js bundle
  console.log("📦 Compiling Fastify API with esbuild...");
  const apiDist = path.join(process.cwd(), "apps", "api", "dist");
  if (!fs.existsSync(apiDist)) fs.mkdirSync(apiDist, { recursive: true });

  execSync(
    'npx esbuild apps/api/src/server.ts --bundle --platform=node --target=node20 --format=esm --packages=external --outfile=apps/api/dist/server.js',
    { stdio: "inherit" }
  );
  execSync(
    'npx esbuild apps/api/src/db/seed.ts --bundle --platform=node --target=node20 --format=esm --packages=external --outfile=apps/api/dist/seed.js',
    { stdio: "inherit" }
  );
  execSync(
    'npx esbuild apps/api/src/db/seed-reviews.ts --bundle --platform=node --target=node20 --format=esm --packages=external --outfile=apps/api/dist/seed-reviews.js',
    { stdio: "inherit" }
  );
  console.log("✓ Fastify API standalone bundles compiled successfully!");

  // 2. Compile Next.js Web Application
  console.log("⚡ Compiling Next.js Web Application...");
  execSync("npm run build -w @magora/web", { stdio: "inherit" });
  console.log("✓ Next.js production build compiled successfully!");
} catch (error) {
  console.error("❌ Build failed:", error.message);
  process.exit(1);
}
