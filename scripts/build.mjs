import { execSync } from "node:child_process";

console.log("====================================================");
console.log("⚡ Building Magora Store Web Application...");
console.log("====================================================");

try {
  execSync("npm run build -w @magora/web", { stdio: "inherit" });
  console.log("✓ Next.js production build compiled successfully!");
} catch (error) {
  console.error("❌ Build failed:", error.message);
  process.exit(1);
}
