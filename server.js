// server.js — Universal production startup script (for cPanel, Passenger, VPS & Cloud)
import { spawn } from "node:child_process";
import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Phusion Passenger in cPanel passes a Unix socket or a port string
const port = process.env.PORT || 3000;
const apiPort = process.env.INTERNAL_API_PORT || 4000;

const fallbackSecret = "c8d4f9b2a1e76543089dcbafe1234567890abcdef1234567890abcdef1234567";
const domain = process.env.PUBLIC_WEB_URL || "https://new.officialhayafoundation.com";

console.log("=================================================");
console.log("🚀 Starting Magora Store Unified Server...");
console.log(`📡 Passenger Web Listen: ${port}`);
console.log(`🔌 Internal API Port: ${apiPort}`);
console.log(`🌐 Public Domain: ${domain}`);
console.log("=================================================");

async function bootstrap() {
  try {
    // Ensure critical storage directories exist
    const apiDir = path.join(__dirname, "apps", "api");
    const dataDir = path.join(apiDir, "data");
    const uploadsDir = path.join(apiDir, "uploads");
    const backupsDir = path.join(apiDir, "backups");
    [dataDir, uploadsDir, backupsDir].forEach((d) => {
      if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    });

    // 1. Launch Fastify API service in the background if not active
    let apiHealthy = false;
    try {
      const r = await fetch(`http://127.0.0.1:${apiPort}/health`);
      if (r.ok) apiHealthy = true;
    } catch {}

    if (!apiHealthy) {
      console.log("⏳ Launching background Fastify API service...");
      const isWindows = process.platform === "win32";
      const npxCmd = isWindows ? "npx.cmd" : "npx";
      const apiProcess = spawn(
        npxCmd,
        ["tsx", "src/server.ts"],
        {
          cwd: apiDir,
          env: {
            ...process.env,
            PORT: String(apiPort),
            HOST: "127.0.0.1",
            NODE_ENV: "production",
            JWT_SECRET: process.env.JWT_SECRET || fallbackSecret,
            WEB_REVALIDATE_SECRET: process.env.WEB_REVALIDATE_SECRET || fallbackSecret,
            CORS_ORIGINS: process.env.CORS_ORIGINS || `${domain},http://new.officialhayafoundation.com`,
            PUBLIC_WEB_URL: domain,
            PUBLIC_API_URL: process.env.PUBLIC_API_URL || `${domain}/api/v1`,
          },
          stdio: "inherit",
        }
      );

      apiProcess.on("error", (err) => {
        console.error("Fastify API spawn error:", err);
      });
    }

    // 2. Load Next.js production handler
    let next;
    try {
      next = (await import("next")).default;
    } catch (err) {
      const altNextPath = path.join(__dirname, "apps", "web", "node_modules", "next", "dist", "server", "next.js");
      if (fs.existsSync(altNextPath)) {
        next = (await import(altNextPath)).default;
      } else {
        throw new Error("Next.js package not found. Please run 'npm install' via cPanel Terminal.");
      }
    }

    const webApp = next({
      dev: false,
      dir: path.join(__dirname, "apps", "web"),
    });

    const handle = webApp.getRequestHandler();
    await webApp.prepare();

    const server = http.createServer((req, res) => {
      handle(req, res);
    });

    server.listen(port, () => {
      console.log(`✓ Magora Web Store is LIVE and listening for Passenger requests!`);
    });
  } catch (fatalError) {
    console.error("FATAL ERROR starting server:", fatalError);
    // Emergency fallback server so Passenger never gives 503 without explanation
    const emergencyServer = http.createServer((req, res) => {
      res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`
        <div style="font-family:sans-serif;padding:40px;max-width:650px;margin:auto;">
          <h2>⚠️ Magora Store Startup Error</h2>
          <p>The server could not start. Please run <code>npm install</code> in the cPanel Terminal.</p>
          <pre style="background:#f4f4f5;padding:15px;border-radius:8px;overflow:auto;">${fatalError.message || fatalError}</pre>
        </div>
      `);
    });
    emergencyServer.listen(port);
  }
}

bootstrap();
