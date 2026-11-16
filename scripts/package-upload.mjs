import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const rootDir = process.cwd();
const targetDirName = "magora-production-build";
const targetDir = path.join(rootDir, targetDirName);
const desktopZipPath = path.join(process.env.USERPROFILE || "C:\\Users\\Sherr", "OneDrive", "Desktop", "magora-production-build.zip");
const localZipPath = path.join(rootDir, "magora-production-build.zip");

console.log("====================================================");
console.log("🔨 MAGORA STORE — PRODUCTION BUILD PACKAGER");
console.log("====================================================");

// 1. Clean previous build staging directory if exists
if (fs.existsSync(targetDir)) {
  console.log("🧹 Cleaning old build directory...");
  fs.rmSync(targetDir, { recursive: true, force: true });
}
fs.mkdirSync(targetDir, { recursive: true });

// Helper to copy files/folders recursively with ignore filter
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

console.log("📁 Copying Root configuration & deployment files...");
// Copy root files
["package.json", "package-lock.json", "README.md", "DEPLOY.md", "server.js"].forEach((file) => {
  const p = path.join(rootDir, file);
  if (fs.existsSync(p)) fs.copyFileSync(p, path.join(targetDir, file));
});

// Copy scripts & deploy
copyRecursive(path.join(rootDir, "scripts"), path.join(targetDir, "scripts"), ["package-upload.mjs"]);
copyRecursive(path.join(rootDir, "deploy"), path.join(targetDir, "deploy"));

console.log("📁 Copying Backend API & Database...");
// Copy apps/api
const apiDest = path.join(targetDir, "apps", "api");
["package.json", "tsconfig.json", "drizzle.config.ts", ".env.example"].forEach((f) => {
  const p = path.join(rootDir, "apps", "api", f);
  if (fs.existsSync(p)) copyRecursive(p, path.join(apiDest, f));
});
copyRecursive(path.join(rootDir, "apps", "api", "src"), path.join(apiDest, "src"));
copyRecursive(path.join(rootDir, "apps", "api", "drizzle"), path.join(apiDest, "drizzle"));

// Copy active database
const dbSrc = path.join(rootDir, "apps", "api", "data", "store.db");
const dbDest = path.join(apiDest, "data", "store.db");
if (fs.existsSync(dbSrc)) {
  fs.mkdirSync(path.dirname(dbDest), { recursive: true });
  fs.copyFileSync(dbSrc, dbDest);
}
// Create empty uploads and backups dirs
fs.mkdirSync(path.join(apiDest, "uploads"), { recursive: true });
fs.writeFileSync(path.join(apiDest, "uploads", ".gitkeep"), "");
fs.mkdirSync(path.join(apiDest, "backups"), { recursive: true });
fs.writeFileSync(path.join(apiDest, "backups", ".gitkeep"), "");

// Write pre-configured .env for new.officialhayafoundation.com
const apiEnvContent = `NODE_ENV=production
PORT=4000
HOST=127.0.0.1
DATABASE_URL=file:./data/store.db
JWT_SECRET=c8d4f9b2a1e76543089dcbafe1234567890abcdef1234567890abcdef1234567
WEB_REVALIDATE_SECRET=c8d4f9b2a1e76543089dcbafe1234567890abcdef1234567890abcdef1234567
WEB_REVALIDATE_URL=http://127.0.0.1:3000/api/revalidate
CORS_ORIGINS=https://new.officialhayafoundation.com,http://new.officialhayafoundation.com
PUBLIC_WEB_URL=https://new.officialhayafoundation.com
PUBLIC_API_URL=https://new.officialhayafoundation.com/api/v1
UPLOAD_DIR=./uploads
STORE_NAME=Magora
SUPPORT_PHONE=+92 300 0000000
SUPPORT_WHATSAPP=923000000000
SUPPORT_EMAIL=support@new.officialhayafoundation.com
STORE_ADDRESS=Karachi, Pakistan
OPEN_PARCEL_DEFAULT=true
ADMIN_EMAIL=admin@magora.pk
ADMIN_PASSWORD=ChangeMe@123
`;
fs.writeFileSync(path.join(apiDest, ".env"), apiEnvContent);

console.log("📁 Copying Frontend Web App & Compiled .next Build...");
// Copy apps/web
const webDest = path.join(targetDir, "apps", "web");
["package.json", "tsconfig.json", "next.config.ts", "eslint.config.mjs", ".env.example"].forEach((f) => {
  const p = path.join(rootDir, "apps", "web", f);
  if (fs.existsSync(p)) copyRecursive(p, path.join(webDest, f));
});
copyRecursive(path.join(rootDir, "apps", "web", "src"), path.join(webDest, "src"));
copyRecursive(path.join(rootDir, "apps", "web", "public"), path.join(webDest, "public"));

const webEnvContent = `NEXT_PUBLIC_API_URL=https://new.officialhayafoundation.com/api/v1
API_URL=http://127.0.0.1:4000/api/v1
NEXT_PUBLIC_SITE_URL=https://new.officialhayafoundation.com
NEXT_PUBLIC_STORE_NAME=Magora
NEXT_PUBLIC_WHATSAPP=923000000000
REVALIDATE_SECRET=c8d4f9b2a1e76543089dcbafe1234567890abcdef1234567890abcdef1234567
`;
fs.writeFileSync(path.join(webDest, ".env.local"), webEnvContent);

// Copy compiled production .next directory (strictly ignoring cache, dev, diagnostics)
console.log("⚡ Bundling compiled Next.js production files...");
copyRecursive(
  path.join(rootDir, "apps", "web", ".next"),
  path.join(webDest, ".next"),
  ["cache", "dev", "diagnostics"]
);

// Create a clear HOW-TO-RUN instruction file
const instructions = `======================================================================
MAGORA STORE — PRODUCTION DEPLOYMENT PACKAGE
======================================================================

Congratulations! This package contains the entire compiled Magora
Store (Next.js 16 Web App + Fastify API + SQLite Database).

HOW TO RUN ON YOUR SERVER (UBUNTU / VPS / CLOUD):
----------------------------------------------------------------------
1. Unzip this package into your server directory:
   e.g. /var/www/magora

2. Copy and configure your production environment variables:
   cp deploy/api.env.production apps/api/.env
   cp deploy/web.env.production apps/web/.env.local

   Edit both files to put your real domain and WhatsApp number.

3. Install production dependencies:
   cd /var/www/magora
   npm install

4. Start 24/7 with PM2:
   pm2 start deploy/ecosystem.config.cjs
   pm2 save
   pm2 startup

5. Set up free SSL with Caddy (optional but recommended):
   sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
   sudo systemctl reload caddy

Your website will be live with full SSL at https://yourdomain.pk!
======================================================================
`;
fs.writeFileSync(path.join(targetDir, "HOW-TO-RUN.txt"), instructions);

console.log("📦 Creating ZIP archives...");
// Remove existing zips
if (fs.existsSync(localZipPath)) fs.unlinkSync(localZipPath);
if (fs.existsSync(desktopZipPath)) fs.unlinkSync(desktopZipPath);

// Create ZIP using PowerShell Compress-Archive
try {
  const psCmd = `Compress-Archive -Path "${targetDir}\\*" -DestinationPath "${localZipPath}" -CompressionLevel Optimal -Force`;
  execSync(`powershell -Command "${psCmd}"`, { stdio: "inherit" });
  console.log("✓ Local ZIP created at: " + localZipPath);
  
  // Also copy directly to Desktop for one-click access
  try {
    fs.copyFileSync(localZipPath, desktopZipPath);
    console.log("✓ Desktop ZIP created at: " + desktopZipPath);
  } catch (err) {
    console.log("Note: Could not copy to desktop, local zip is ready.");
  }
} catch (e) {
  console.error("Error creating zip via PowerShell:", e);
}

// Calculate total sizes
function getDirSize(dirPath) {
  let size = 0;
  try {
    const list = fs.readdirSync(dirPath);
    for (const item of list) {
      const p = path.join(dirPath, item);
      const stat = fs.statSync(p);
      if (stat.isDirectory()) size += getDirSize(p);
      else size += stat.size;
    }
  } catch {}
  return size;
}

const unzippedSizeMB = (getDirSize(targetDir) / (1024 * 1024)).toFixed(1);
let zipSizeMB = "N/A";
if (fs.existsSync(localZipPath)) {
  zipSizeMB = (fs.statSync(localZipPath).size / (1024 * 1024)).toFixed(1);
}

console.log("====================================================");
console.log("🎉 BUILD PACKAGE READY FOR UPLOAD!");
console.log("----------------------------------------------------");
console.log("Uncompressed Folder Size: " + unzippedSizeMB + " MB");
console.log("Compressed ZIP Size:      " + zipSizeMB + " MB");
console.log("Unzipped Folder Path:     " + targetDir);
console.log("Ready-to-Upload ZIP Path: " + (fs.existsSync(desktopZipPath) ? desktopZipPath : localZipPath));
console.log("====================================================");
