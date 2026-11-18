import type { FastifyInstance } from "fastify";
import { Type } from "typebox";
import { eq, sql } from "drizzle-orm";
import { pool, db } from "../db/client";
import * as s from "../db/schema";
import { requireAdmin } from "../lib/auth";

let tableEnsured = false;
async function ensureMarketingTable() {
  if (tableEnsured) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`marketing_settings\` (
        \`id\` INT PRIMARY KEY AUTO_INCREMENT,
        \`enabled\` BOOLEAN NOT NULL DEFAULT TRUE,
        \`meta_pixel_id\` VARCHAR(64),
        \`tiktok_pixel_id\` VARCHAR(64),
        \`google_tag_id\` VARCHAR(64),
        \`google_ads_conversion_id\` VARCHAR(128),
        \`google_search_console_code\` VARCHAR(255),
        \`pinterest_tag_id\` VARCHAR(64),
        \`snapchat_pixel_id\` VARCHAR(64),
        \`track_purchases\` BOOLEAN NOT NULL DEFAULT TRUE,
        \`track_add_to_cart\` BOOLEAN NOT NULL DEFAULT TRUE,
        \`track_initiate_checkout\` BOOLEAN NOT NULL DEFAULT TRUE,
        \`updated_at\` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Check if row 1 exists
    const [rows] = await pool.query<any[]>("SELECT id FROM `marketing_settings` WHERE id = 1");
    if (!rows || rows.length === 0) {
      await pool.query(`
        INSERT INTO \`marketing_settings\` 
        (id, enabled, meta_pixel_id, tiktok_pixel_id, google_tag_id, google_search_console_code)
        VALUES (1, TRUE, NULL, NULL, NULL, NULL)
      `);
    }
    tableEnsured = true;
  } catch (err: any) {
    console.warn("Marketing table check notice:", err?.message || err);
  }
}

export async function marketingRoutes(app: FastifyInstance) {
  // 1. Public endpoint to fetch active pixel IDs for storefront injection
  app.get(
    "/marketing-settings",
    {
      schema: {
        tags: ["Marketing"],
        summary: "Get live tracking pixels configuration (Meta, TikTok, Google)",
      },
    },
    async () => {
      await ensureMarketingTable();
      try {
        const [row] = await db.select().from(s.marketingSettings).where(eq(s.marketingSettings.id, 1));
        if (row) return { data: row };
      } catch {}
      return {
        data: {
          id: 1,
          enabled: true,
          metaPixelId: null,
          tiktokPixelId: null,
          googleTagId: null,
          googleAdsConversionId: null,
          googleSearchConsoleCode: null,
          trackPurchases: true,
          trackAddToCart: true,
          trackInitiateCheckout: true,
        },
      };
    },
  );

  // 2. Admin endpoint to save pixel IDs and marketing preferences
  app.post(
    "/admin/marketing-settings",
    {
      preHandler: requireAdmin,
      schema: {
        tags: ["Admin"],
        summary: "Update Marketing Pixels (Meta, TikTok, Google Ads, GSC)",
        body: Type.Object({
          enabled: Type.Optional(Type.Boolean()),
          metaPixelId: Type.Optional(Type.String()),
          tiktokPixelId: Type.Optional(Type.String()),
          googleTagId: Type.Optional(Type.String()),
          googleAdsConversionId: Type.Optional(Type.String()),
          googleSearchConsoleCode: Type.Optional(Type.String()),
          pinterestTagId: Type.Optional(Type.String()),
          snapchatPixelId: Type.Optional(Type.String()),
          trackPurchases: Type.Optional(Type.Boolean()),
          trackAddToCart: Type.Optional(Type.Boolean()),
          trackInitiateCheckout: Type.Optional(Type.Boolean()),
        }),
      },
    },
    async (req) => {
      await ensureMarketingTable();
      const b = req.body as Partial<typeof s.marketingSettings.$inferInsert>;

      const updatePayload: Partial<typeof s.marketingSettings.$inferInsert> = {
        updatedAt: new Date(),
      };

      if (typeof b.enabled === "boolean") updatePayload.enabled = b.enabled;
      if (b.metaPixelId !== undefined) updatePayload.metaPixelId = b.metaPixelId.trim() || null;
      if (b.tiktokPixelId !== undefined) updatePayload.tiktokPixelId = b.tiktokPixelId.trim() || null;
      if (b.googleTagId !== undefined) updatePayload.googleTagId = b.googleTagId.trim() || null;
      if (b.googleAdsConversionId !== undefined) updatePayload.googleAdsConversionId = b.googleAdsConversionId.trim() || null;
      if (b.googleSearchConsoleCode !== undefined) updatePayload.googleSearchConsoleCode = b.googleSearchConsoleCode.trim() || null;
      if (b.pinterestTagId !== undefined) updatePayload.pinterestTagId = b.pinterestTagId.trim() || null;
      if (b.snapchatPixelId !== undefined) updatePayload.snapchatPixelId = b.snapchatPixelId.trim() || null;
      if (typeof b.trackPurchases === "boolean") updatePayload.trackPurchases = b.trackPurchases;
      if (typeof b.trackAddToCart === "boolean") updatePayload.trackAddToCart = b.trackAddToCart;
      if (typeof b.trackInitiateCheckout === "boolean") updatePayload.trackInitiateCheckout = b.trackInitiateCheckout;

      await db.update(s.marketingSettings).set(updatePayload).where(eq(s.marketingSettings.id, 1));

      const [updated] = await db.select().from(s.marketingSettings).where(eq(s.marketingSettings.id, 1));
      return { data: updated };
    },
  );
}
