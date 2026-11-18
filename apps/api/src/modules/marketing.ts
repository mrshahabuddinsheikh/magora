import type { FastifyInstance } from "fastify";
import { Type } from "typebox";
import { eq, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
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
        \`meta_capi_token\` TEXT,
        \`meta_test_event_code\` VARCHAR(64),
        \`tiktok_access_token\` TEXT,
        \`tiktok_test_event_code\` VARCHAR(64),
        \`track_purchases\` BOOLEAN NOT NULL DEFAULT TRUE,
        \`track_add_to_cart\` BOOLEAN NOT NULL DEFAULT TRUE,
        \`track_initiate_checkout\` BOOLEAN NOT NULL DEFAULT TRUE,
        \`updated_at\` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Ensure newly added columns exist if table was already created
    const alterColumns = [
      "ALTER TABLE `marketing_settings` ADD COLUMN `meta_capi_token` TEXT NULL;",
      "ALTER TABLE `marketing_settings` ADD COLUMN `meta_test_event_code` VARCHAR(64) NULL;",
      "ALTER TABLE `marketing_settings` ADD COLUMN `tiktok_access_token` TEXT NULL;",
      "ALTER TABLE `marketing_settings` ADD COLUMN `tiktok_test_event_code` VARCHAR(64) NULL;",
    ];

    for (const alt of alterColumns) {
      try {
        await pool.query(alt);
      } catch {}
    }

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

function sha256(val?: string | null): string | undefined {
  if (!val) return undefined;
  return createHash("sha256").update(val.trim().toLowerCase()).digest("hex");
}

function normalizePhone(phone?: string | null): string {
  if (!phone) return "";
  const d = phone.replace(/\D/g, "");
  if (d.startsWith("92")) return d;
  if (d.startsWith("0")) return "92" + d.slice(1);
  return d;
}

export interface ServerPurchaseEvent {
  number: string;
  total: number;
  name: string;
  phone: string;
  city?: string;
  items?: Array<{ name: string; qty: number; price: number }>;
  clientIp?: string;
  userAgent?: string;
  eventId?: string;
}

/**
 * Server-Side Conversions API (CAPI) Dispatcher for Meta and TikTok
 * Fires in background to ensure zero lag on order response.
 */
export async function trackServerPurchaseEvent(evt: ServerPurchaseEvent) {
  try {
    await ensureMarketingTable();
    const [settings] = await db.select().from(s.marketingSettings).where(eq(s.marketingSettings.id, 1));
    if (!settings || !settings.enabled || !settings.trackPurchases) return;

    // 1. Meta Conversions API (CAPI)
    if (settings.metaPixelId && settings.metaCapiToken) {
      const metaUrl = `https://graph.facebook.com/v19.0/${encodeURIComponent(settings.metaPixelId)}/events?access_token=${encodeURIComponent(settings.metaCapiToken)}`;
      const metaPayload = {
        data: [
          {
            event_name: "Purchase",
            event_time: Math.floor(Date.now() / 1000),
            event_id: evt.eventId || evt.number,
            action_source: "website",
            user_data: {
              ph: [sha256(normalizePhone(evt.phone))].filter(Boolean),
              fn: [sha256(evt.name.split(" ")[0])].filter(Boolean),
              ct: [sha256(evt.city)].filter(Boolean),
              client_ip_address: evt.clientIp || undefined,
              client_user_agent: evt.userAgent || undefined,
            },
            custom_data: {
              currency: "PKR",
              value: Number(evt.total),
              order_id: evt.number,
              content_type: "product",
              contents: evt.items?.map((it) => ({
                id: it.name,
                quantity: it.qty,
                item_price: it.price,
              })),
            },
          },
        ],
        ...(settings.metaTestEventCode ? { test_event_code: settings.metaTestEventCode } : {}),
      };

      fetch(metaUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(metaPayload),
      })
        .then(async (res) => {
          if (!res.ok) {
            const errBody = await res.text();
            console.warn(`[Meta CAPI Error] HTTP ${res.status}: ${errBody}`);
          }
        })
        .catch((e) => console.warn("[Meta CAPI Network Error]:", e.message));
    }

    // 2. TikTok Events API
    if (settings.tiktokPixelId && settings.tiktokAccessToken) {
      const ttUrl = "https://business-api.tiktok.com/open_api/v1.3/event/track/";
      const ttPayload = {
        event_source: "web",
        event_source_id: settings.tiktokPixelId,
        data: [
          {
            event: "CompletePayment",
            event_time: Math.floor(Date.now() / 1000),
            event_id: evt.eventId || evt.number,
            user: {
              phone_sha256: sha256(normalizePhone(evt.phone)),
              ip: evt.clientIp || undefined,
              user_agent: evt.userAgent || undefined,
            },
            properties: {
              currency: "PKR",
              value: Number(evt.total),
              order_id: evt.number,
            },
          },
        ],
        ...(settings.tiktokTestEventCode ? { test_event_code: settings.tiktokTestEventCode } : {}),
      };

      fetch(ttUrl, {
        method: "POST",
        headers: {
          "Access-Token": settings.tiktokAccessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(ttPayload),
      })
        .then(async (res) => {
          if (!res.ok) {
            const errBody = await res.text();
            console.warn(`[TikTok Events API Error] HTTP ${res.status}: ${errBody}`);
          }
        })
        .catch((e) => console.warn("[TikTok Events API Network Error]:", e.message));
    }
  } catch (err: any) {
    console.warn("[Server CAPI Dispatch Error]:", err?.message || err);
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
        if (row) {
          // Do not expose private CAPI access tokens to public storefront API
          const { metaCapiToken, tiktokAccessToken, ...safeRow } = row;
          return { data: safeRow };
        }
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

  // 2. Admin endpoint to get full settings including CAPI tokens
  app.get(
    "/admin/marketing-settings",
    {
      preHandler: requireAdmin,
      schema: {
        tags: ["Admin"],
        summary: "Get full marketing settings including CAPI access tokens",
      },
    },
    async () => {
      await ensureMarketingTable();
      const [row] = await db.select().from(s.marketingSettings).where(eq(s.marketingSettings.id, 1));
      return { data: row || {} };
    },
  );

  // 3. Admin endpoint to save pixel IDs and marketing preferences
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
          metaCapiToken: Type.Optional(Type.String()),
          metaTestEventCode: Type.Optional(Type.String()),
          tiktokAccessToken: Type.Optional(Type.String()),
          tiktokTestEventCode: Type.Optional(Type.String()),
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
      if (b.metaPixelId !== undefined) updatePayload.metaPixelId = b.metaPixelId ? b.metaPixelId.trim() : null;
      if (b.tiktokPixelId !== undefined) updatePayload.tiktokPixelId = b.tiktokPixelId ? b.tiktokPixelId.trim() : null;
      if (b.googleTagId !== undefined) updatePayload.googleTagId = b.googleTagId ? b.googleTagId.trim() : null;
      if (b.googleAdsConversionId !== undefined) updatePayload.googleAdsConversionId = b.googleAdsConversionId ? b.googleAdsConversionId.trim() : null;
      if (b.googleSearchConsoleCode !== undefined) updatePayload.googleSearchConsoleCode = b.googleSearchConsoleCode ? b.googleSearchConsoleCode.trim() : null;
      if (b.pinterestTagId !== undefined) updatePayload.pinterestTagId = b.pinterestTagId ? b.pinterestTagId.trim() : null;
      if (b.snapchatPixelId !== undefined) updatePayload.snapchatPixelId = b.snapchatPixelId ? b.snapchatPixelId.trim() : null;
      if (b.metaCapiToken !== undefined) updatePayload.metaCapiToken = b.metaCapiToken ? b.metaCapiToken.trim() : null;
      if (b.metaTestEventCode !== undefined) updatePayload.metaTestEventCode = b.metaTestEventCode ? b.metaTestEventCode.trim() : null;
      if (b.tiktokAccessToken !== undefined) updatePayload.tiktokAccessToken = b.tiktokAccessToken ? b.tiktokAccessToken.trim() : null;
      if (b.tiktokTestEventCode !== undefined) updatePayload.tiktokTestEventCode = b.tiktokTestEventCode ? b.tiktokTestEventCode.trim() : null;
      if (typeof b.trackPurchases === "boolean") updatePayload.trackPurchases = b.trackPurchases;
      if (typeof b.trackAddToCart === "boolean") updatePayload.trackAddToCart = b.trackAddToCart;
      if (typeof b.trackInitiateCheckout === "boolean") updatePayload.trackInitiateCheckout = b.trackInitiateCheckout;

      await db.update(s.marketingSettings).set(updatePayload).where(eq(s.marketingSettings.id, 1));

      const [updated] = await db.select().from(s.marketingSettings).where(eq(s.marketingSettings.id, 1));
      return { data: updated };
    },
  );

  // 4. Admin endpoint to test CAPI trigger
  app.post(
    "/admin/marketing/test-capi",
    {
      preHandler: requireAdmin,
      schema: {
        tags: ["Admin"],
        summary: "Send test purchase event to Meta CAPI & TikTok Events API",
      },
    },
    async (req, reply) => {
      await ensureMarketingTable();
      const [settings] = await db.select().from(s.marketingSettings).where(eq(s.marketingSettings.id, 1));
      if (!settings) return reply.status(400).send({ error: "Marketing settings not found" });

      const testOrder: ServerPurchaseEvent = {
        number: "TEST-MG-" + Math.floor(100000 + Math.random() * 900000),
        total: 2499,
        name: "Test Customer",
        phone: "03001234567",
        city: "Lahore",
        items: [{ name: "Frosted Matte MagSafe Case", qty: 1, price: 2499 }],
        clientIp: req.ip,
        userAgent: req.headers["user-agent"],
        eventId: "TEST-EVT-" + Date.now(),
      };

      const results: { meta?: any; tiktok?: any } = {};

      if (settings.metaPixelId && settings.metaCapiToken) {
        try {
          const metaUrl = `https://graph.facebook.com/v19.0/${encodeURIComponent(settings.metaPixelId)}/events?access_token=${encodeURIComponent(settings.metaCapiToken)}`;
          const metaPayload = {
            data: [
              {
                event_name: "Purchase",
                event_time: Math.floor(Date.now() / 1000),
                event_id: testOrder.eventId,
                action_source: "website",
                user_data: {
                  ph: [sha256(normalizePhone(testOrder.phone))],
                  fn: [sha256("Test")],
                  ct: [sha256("lahore")],
                  client_ip_address: testOrder.clientIp,
                  client_user_agent: testOrder.userAgent,
                },
                custom_data: {
                  currency: "PKR",
                  value: 2499,
                  order_id: testOrder.number,
                  content_type: "product",
                  contents: testOrder.items,
                },
              },
            ],
            ...(settings.metaTestEventCode ? { test_event_code: settings.metaTestEventCode } : {}),
          };

          const mRes = await fetch(metaUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(metaPayload),
          });
          const mData = await mRes.json();
          results.meta = { status: mRes.status, ok: mRes.ok, data: mData };
        } catch (e: any) {
          results.meta = { error: e.message };
        }
      } else {
        results.meta = { status: "skipped", note: "Meta Pixel ID or Meta CAPI Access Token not set" };
      }

      if (settings.tiktokPixelId && settings.tiktokAccessToken) {
        try {
          const ttUrl = "https://business-api.tiktok.com/open_api/v1.3/event/track/";
          const ttPayload = {
            event_source: "web",
            event_source_id: settings.tiktokPixelId,
            data: [
              {
                event: "CompletePayment",
                event_time: Math.floor(Date.now() / 1000),
                event_id: testOrder.eventId,
                user: {
                  phone_sha256: sha256(normalizePhone(testOrder.phone)),
                  ip: testOrder.clientIp,
                  user_agent: testOrder.userAgent,
                },
                properties: {
                  currency: "PKR",
                  value: 2499,
                  order_id: testOrder.number,
                },
              },
            ],
            ...(settings.tiktokTestEventCode ? { test_event_code: settings.tiktokTestEventCode } : {}),
          };

          const tRes = await fetch(ttUrl, {
            method: "POST",
            headers: {
              "Access-Token": settings.tiktokAccessToken,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(ttPayload),
          });
          const tData = await tRes.json();
          results.tiktok = { status: tRes.status, ok: tRes.ok, data: tData };
        } catch (e: any) {
          results.tiktok = { error: e.message };
        }
      } else {
        results.tiktok = { status: "skipped", note: "TikTok Pixel ID or TikTok Access Token not set" };
      }

      return {
        success: true,
        testOrder,
        results,
      };
    },
  );
}
