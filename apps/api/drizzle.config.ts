import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: {
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "officialhayafoun_magora",
    password: process.env.DB_PASSWORD || "Shahab@1122",
    database: process.env.DB_NAME || "officialhayafoun_magora",
    port: Number(process.env.DB_PORT || 3306),
  },
});
