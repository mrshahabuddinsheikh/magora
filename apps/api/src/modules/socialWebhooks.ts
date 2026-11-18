import type { FastifyInstance } from "fastify";
import { Type } from "typebox";
import { and, eq, like, or, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "../db/client";
import * as s from "../db/schema";
import { store } from "../config";
import { requireAdmin } from "../lib/auth";
import { badRequest } from "../lib/errors";
import { normalizePkPhone } from "./orders";
import { invalidate } from "../lib/cache";
import { trackServerPurchaseEvent } from "./marketing";

const META_VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN || "magora_meta_lead_token_2026";
const TIKTOK_VERIFY_TOKEN = process.env.TIKTOK_WEBHOOK_VERIFY_TOKEN || "magora_tiktok_lead_token_2026";

interface SocialLeadInput {
  source: "facebook_ad" | "tiktok_ad" | "google_ad" | "custom_ad";
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  city: string;
  line1: string;
  productSlug?: string;
  modelName?: string;
  colorName?: string;
  notes?: string;
  campaignName?: string;
  adId?: string;
  formId?: string;
}

/**
 * Universal helper that safely turns a social ad lead (Meta / TikTok / Google)
 * into a confirmed real order in MySQL with stock reservation and lead tracking.
 */
export async function createSocialAdOrder(input: SocialLeadInput) {
  const phone = normalizePkPhone(input.customerPhone);
  if (!phone) {
    throw badRequest("Please enter a valid mobile number (e.g. 0300 1234567)", "invalid_phone");
  }

  const cleanName = input.customerName?.trim() || "Valued Customer";
  const cleanCity = input.city?.trim() || "Karachi";
  const cleanAddress = input.line1?.trim() || "Delivery address requested via call/WhatsApp";

  // 1. Resolve product (default to best-seller crystal clear case if not matched)
  const productTarget = input.productSlug?.trim() || "crystal-clear-magsafe-case";
  let [product] = await db
    .select()
    .from(s.products)
    .where(eq(s.products.slug, productTarget));

  if (!product) {
    // Fallback to first active product
    [product] = await db
      .select()
      .from(s.products)
      .where(eq(s.products.active, true))
      .limit(1);
  }

  if (!product) {
    throw badRequest("No active product found in store catalogue", "no_product");
  }

  // 2. Resolve Phone Model
  let matchedModel: typeof s.phoneModels.$inferSelect | undefined;
  if (input.modelName) {
    const rawModel = input.modelName.toLowerCase().replace(/[^a-z0-9]/g, "");
    const allModels = await db.select().from(s.phoneModels).where(eq(s.phoneModels.active, true));
    matchedModel = allModels.find(
      (m) =>
        m.slug.toLowerCase().replace(/[^a-z0-9]/g, "") === rawModel ||
        m.name.toLowerCase().replace(/[^a-z0-9]/g, "") === rawModel ||
        rawModel.includes(m.slug.replace(/[^a-z0-9]/g, "")) ||
        m.slug.replace(/[^a-z0-9]/g, "").includes(rawModel),
    );
  }

  // Default to popular iPhone 18 Pro Max if model not found/specified
  if (!matchedModel) {
    const [def] = await db
      .select()
      .from(s.phoneModels)
      .where(and(eq(s.phoneModels.active, true), eq(s.phoneModels.popular, true)))
      .limit(1);
    matchedModel = def;
  }

  // 3. Resolve Color
  const colors = await db
    .select()
    .from(s.productColors)
    .where(eq(s.productColors.productId, product.id));

  let matchedColor = colors[0];
  if (input.colorName && colors.length > 0) {
    const rawColor = input.colorName.toLowerCase().trim();
    const found = colors.find((c) => c.name.toLowerCase().includes(rawColor) || rawColor.includes(c.name.toLowerCase()));
    if (found) matchedColor = found;
  }

  // 4. Resolve Variant & Price
  let variant: typeof s.variants.$inferSelect | undefined;
  if (matchedModel && matchedColor) {
    const [v] = await db
      .select()
      .from(s.variants)
      .where(
        and(
          eq(s.variants.productId, product.id),
          eq(s.variants.phoneModelId, matchedModel.id),
          eq(s.variants.colorId, matchedColor.id),
        ),
      );
    variant = v;
  }

  // Fallback variant
  if (!variant) {
    const [anyVar] = await db
      .select()
      .from(s.variants)
      .where(and(eq(s.variants.productId, product.id), eq(s.variants.active, true)))
      .limit(1);
    variant = anyVar;
  }

  const unitPrice = variant?.price ?? product.basePrice;
  const lineTotal = unitPrice;
  const subtotal = lineTotal;
  const shipping = subtotal >= store.shipping.freeAbove ? 0 : store.shipping.flatRate;
  const codFee = store.cod.fee;
  const total = subtotal + shipping + codFee;

  const notesArr: string[] = [];
  if (input.campaignName) notesArr.push(`Campaign: ${input.campaignName}`);
  if (input.adId) notesArr.push(`Ad ID: ${input.adId}`);
  if (input.formId) notesArr.push(`Form: ${input.formId}`);
  if (input.notes) notesArr.push(input.notes);
  const fullNotes = notesArr.join(" · ") || `Direct Lead Ad Order (${input.source})`;

  // 5. Database transaction: Order creation + stock reservation
  const result = await db.transaction(async (tx) => {
    // Reserve 1 item from stock if variant exists
    if (variant && variant.stock > 0) {
      await tx
        .update(s.variants)
        .set({ stock: sql`${s.variants.stock} - 1` })
        .where(and(eq(s.variants.id, variant.id), sql`${s.variants.stock} >= 1`));
    }

    const [createdRes] = await tx.insert(s.orders).values({
      number: `TMP-${nanoid(12)}`,
      accessToken: nanoid(32),
      status: "pending",
      paymentMethod: "cod",
      paymentStatus: "unpaid",
      customerName: cleanName,
      customerPhone: phone,
      customerEmail: input.customerEmail || null,
      city: cleanCity,
      line1: cleanAddress,
      notes: fullNotes,
      subtotal,
      discount: 0,
      shipping,
      codFee,
      total,
      source: input.source,
      openParcel: true,
    });

    const orderId = createdRes.insertId;
    const orderNumber = `MG${100000 + orderId}`;

    await tx.update(s.orders).set({ number: orderNumber }).where(eq(s.orders.id, orderId));

    // Order item
    await tx.insert(s.orderItems).values({
      orderId,
      variantId: variant?.id ?? null,
      productId: product.id,
      productSlug: product.slug,
      productName: product.name,
      modelName: matchedModel?.name || "Standard Model",
      colorName: matchedColor?.name || "Standard Color",
      colorHex: matchedColor?.hex || "#000000",
      sku: variant?.sku || `${product.id}-LEAD-${nanoid(6).toUpperCase()}`,
      unitPrice,
      qty: 1,
      lineTotal,
      category: "magsafe-cases",
      material: product.material,
    });

    // Events & payments
    await tx.insert(s.orderEvents).values({
      orderId,
      status: "pending",
      note: `Order automatically created from ${input.source.toUpperCase().replace("_", " ")} lead form.`,
    });

    await tx.insert(s.payments).values({
      orderId,
      provider: "cod",
      amount: total,
    });

    // Also update product sold count
    await tx
      .update(s.products)
      .set({ soldCount: sql`${s.products.soldCount} + 1` })
      .where(eq(s.products.id, product.id));

    // Update / insert into customerLeads CRM
    const [existingLead] = await tx
      .select()
      .from(s.customerLeads)
      .where(eq(s.customerLeads.phone, phone));

    if (existingLead) {
      await tx
        .update(s.customerLeads)
        .set({
          name: cleanName,
          city: cleanCity,
          source: input.source,
          preferredModel: matchedModel?.name || existingLead.preferredModel,
          cartValue: total,
          cartItemsSummary: `${product.name} (${matchedModel?.name || ""})`,
          notes: `Converted to Order #${orderNumber}`,
          visitCount: existingLead.visitCount + 1,
          updatedAt: new Date(),
        })
        .where(eq(s.customerLeads.id, existingLead.id));
    } else {
      await tx.insert(s.customerLeads).values({
        phone,
        name: cleanName,
        city: cleanCity,
        source: input.source,
        preferredModel: matchedModel?.name || null,
        cartValue: total,
        cartItemsSummary: `${product.name} (${matchedModel?.name || ""})`,
        notes: `Converted to Order #${orderNumber}`,
        whatsappCommunityOptIn: true,
      });
    }

    return { orderId, orderNumber, total, phone, name: cleanName };
  });

  invalidate("catalog:product");
  trackServerPurchaseEvent({
    number: result.orderNumber,
    total: result.total,
    name: result.name,
    phone: result.phone,
    items: [{ name: product.name, qty: 1, price: unitPrice }],
    eventId: `LEAD-${result.orderNumber}`,
  }).catch(() => {});
  return result;
}

export async function socialWebhooksRoutes(app: FastifyInstance) {
  /* ─────────────────────────────────────────────────────────────
   * 1. Meta (Facebook / Instagram) Lead Ads Webhooks
   * ───────────────────────────────────────────────────────────── */

  // Webhook Verification (Meta sends GET request when registering URL in App Dashboard)
  app.get("/webhooks/meta-leads", async (req, reply) => {
    const q = req.query as Record<string, string | undefined>;
    const mode = q["hub.mode"];
    const token = q["hub.verify_token"];
    const challenge = q["hub.challenge"];

    if (mode === "subscribe" && token === META_VERIFY_TOKEN) {
      app.log.info("✓ Meta Webhook successfully verified by Facebook App!");
      return reply.code(200).send(challenge);
    }
    return reply.code(403).send("Verification token mismatch");
  });

  // Webhook Event Receiver (Meta sends POST request when someone submits an Instant Form)
  app.post("/webhooks/meta-leads", async (req, reply) => {
    const body = req.body as any;
    app.log.info({ body }, "📩 Incoming Meta Lead webhook event");

    try {
      // 1. Direct lead JSON (e.g. from Zapier / Make / Lead Sync / Graph API payload)
      if (body.name || body.full_name || body.phone_number || body.phone) {
        const order = await createSocialAdOrder({
          source: "facebook_ad",
          customerName: body.name || body.full_name || body.first_name,
          customerPhone: body.phone || body.phone_number,
          customerEmail: body.email,
          city: body.city,
          line1: body.address || body.street_address || body.line1,
          productSlug: body.product || body.productSlug,
          modelName: body.model || body.phone_model || body.modelName,
          colorName: body.color || body.case_color,
          campaignName: body.campaign_name || body.campaign,
          adId: body.ad_id,
          formId: body.form_id,
          notes: body.notes,
        });
        return reply.code(201).send({ ok: true, created: true, order });
      }

      // 2. Standard Facebook Graph Webhook format with field_data
      const entry = body.entry?.[0];
      const change = entry?.changes?.[0]?.value;
      if (change) {
        // If field_data array is included directly in the webhook payload
        const fieldData = change.field_data || [];
        const getField = (...names: string[]) => {
          for (const n of names) {
            const f = fieldData.find((x: any) => x.name?.toLowerCase() === n.toLowerCase());
            if (f && f.values?.[0]) return String(f.values[0]);
          }
          return undefined;
        };

        const customerName = getField("full_name", "first_name", "name") || "Facebook Lead";
        const customerPhone = getField("phone_number", "phone", "contact_number") || "";
        const city = getField("city", "delivery_city") || "Karachi";
        const address = getField("street_address", "address", "delivery_address") || "Delivery address requested";
        const modelName = getField("phone_model", "model", "mobile_model");
        const colorName = getField("color", "case_color");

        if (customerPhone) {
          const order = await createSocialAdOrder({
            source: "facebook_ad",
            customerName,
            customerPhone,
            city,
            line1: address,
            modelName,
            colorName,
            adId: change.ad_id,
            formId: change.form_id,
            campaignName: change.campaign_name,
          });
          return reply.code(201).send({ ok: true, created: true, order });
        }
      }

      return reply.code(200).send({ ok: true, message: "Webhook acknowledged" });
    } catch (err: any) {
      app.log.error(err, "Meta lead webhook processing error");
      return reply.code(200).send({ ok: false, error: err?.message || err });
    }
  });

  /* ─────────────────────────────────────────────────────────────
   * 2. TikTok Instant Form Webhooks
   * ───────────────────────────────────────────────────────────── */

  app.get("/webhooks/tiktok-leads", async (req, reply) => {
    return reply.code(200).send({ ok: true, service: "Magora TikTok Lead Ads Webhook" });
  });

  app.post("/webhooks/tiktok-leads", async (req, reply) => {
    const body = req.body as any;
    app.log.info({ body }, "📩 Incoming TikTok Lead webhook event");

    try {
      const name = body.name || body.full_name || "TikTok Customer";
      const phone = body.phone || body.phone_number || body.contact_phone;
      const city = body.city || "Karachi";
      const address = body.address || body.street_address || "TikTok Order";

      if (phone) {
        const order = await createSocialAdOrder({
          source: "tiktok_ad",
          customerName: name,
          customerPhone: phone,
          customerEmail: body.email,
          city,
          line1: address,
          productSlug: body.product || body.productSlug,
          modelName: body.model || body.phone_model,
          colorName: body.color,
          campaignName: body.campaign_name || body.campaign,
          adId: body.ad_id,
          notes: body.notes,
        });
        return reply.code(201).send({ ok: true, created: true, order });
      }

      return reply.code(200).send({ ok: true, message: "TikTok webhook received" });
    } catch (err: any) {
      app.log.error(err, "TikTok webhook error");
      return reply.code(200).send({ ok: false, error: err?.message || err });
    }
  });

  /* ─────────────────────────────────────────────────────────────
   * 3. Google Ads Lead Form Webhook
   * ───────────────────────────────────────────────────────────── */

  app.post("/webhooks/google-leads", async (req, reply) => {
    const body = req.body as any;
    app.log.info({ body }, "📩 Incoming Google Lead webhook event");

    try {
      // Google Lead form columns: user_column_data array
      const cols = body.user_column_data || [];
      const getVal = (colId: string) => {
        const c = cols.find((x: any) => x.column_id === colId);
        return c?.string_value;
      };

      const name = getVal("FULL_NAME") || body.name || "Google Ad Customer";
      const phone = getVal("PHONE_NUMBER") || body.phone;
      const city = getVal("CITY") || body.city || "Karachi";
      const address = getVal("STREET_ADDRESS") || body.address || "Google Ad Order";

      if (phone) {
        const order = await createSocialAdOrder({
          source: "google_ad",
          customerName: name,
          customerPhone: phone,
          customerEmail: getVal("EMAIL") || body.email,
          city,
          line1: address,
          modelName: body.model || body.phone_model,
          colorName: body.color,
          campaignName: body.campaign_id ? `Campaign ${body.campaign_id}` : undefined,
        });
        return reply.code(201).send({ ok: true, created: true, order });
      }

      return reply.code(200).send({ ok: true, message: "Google lead received" });
    } catch (err: any) {
      app.log.error(err, "Google lead webhook error");
      return reply.code(200).send({ ok: false, error: err?.message || err });
    }
  });

  /* ─────────────────────────────────────────────────────────────
   * 4. Universal Ad Order Endpoint (For Zapier, Pabbly, Make or Direct Integrations)
   * ───────────────────────────────────────────────────────────── */

  app.post(
    "/webhooks/ad-order",
    {
      schema: {
        tags: ["Webhooks"],
        summary: "Universal Direct Ad Order endpoint (Meta, TikTok, Google, Zapier)",
        body: Type.Object({
          source: Type.Optional(Type.Union([Type.Literal("facebook_ad"), Type.Literal("tiktok_ad"), Type.Literal("google_ad"), Type.Literal("custom_ad")])),
          name: Type.String({ minLength: 2, maxLength: 100 }),
          phone: Type.String({ minLength: 10, maxLength: 20 }),
          email: Type.Optional(Type.String({ maxLength: 120 })),
          city: Type.String({ minLength: 2, maxLength: 80 }),
          address: Type.String({ minLength: 5, maxLength: 255 }),
          productSlug: Type.Optional(Type.String({ maxLength: 120 })),
          model: Type.Optional(Type.String({ maxLength: 80 })),
          color: Type.Optional(Type.String({ maxLength: 50 })),
          notes: Type.Optional(Type.String({ maxLength: 300 })),
          campaign: Type.Optional(Type.String({ maxLength: 150 })),
          adId: Type.Optional(Type.String({ maxLength: 100 })),
        }),
      },
    },
    async (req, reply) => {
      const b = req.body as any;
      const order = await createSocialAdOrder({
        source: b.source || "facebook_ad",
        customerName: b.name,
        customerPhone: b.phone,
        customerEmail: b.email,
        city: b.city,
        line1: b.address,
        productSlug: b.productSlug,
        modelName: b.model,
        colorName: b.color,
        notes: b.notes,
        campaignName: b.campaign,
        adId: b.adId,
      });

      return reply.code(201).send({
        ok: true,
        data: order,
        message: `Order #${order.orderNumber} successfully booked from ${b.source || "Social Ad"}!`,
      });
    },
  );

  /* ─────────────────────────────────────────────────────────────
   * 5. Admin: Social Webhooks Configuration & Test Order Generator
   * ───────────────────────────────────────────────────────────── */

  app.get(
    "/admin/social-webhooks/config",
    {
      preHandler: requireAdmin,
      schema: {
        tags: ["Admin"],
        summary: "Get webhook URLs, verification tokens, and integration details",
      },
    },
    async () => {
      const publicBase = process.env.PUBLIC_API_URL || "https://new.officialhayafoundation.com/api/v1";

      // Count recent orders by social source
      const [fbCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(s.orders)
        .where(eq(s.orders.source, "facebook_ad"));

      const [ttCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(s.orders)
        .where(eq(s.orders.source, "tiktok_ad"));

      const [googleCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(s.orders)
        .where(eq(s.orders.source, "google_ad"));

      return {
        data: {
          meta: {
            webhookUrl: `${publicBase}/webhooks/meta-leads`,
            verifyToken: META_VERIFY_TOKEN,
            totalOrders: Number(fbCount?.count || 0),
          },
          tiktok: {
            webhookUrl: `${publicBase}/webhooks/tiktok-leads`,
            verifyToken: TIKTOK_VERIFY_TOKEN,
            totalOrders: Number(ttCount?.count || 0),
          },
          google: {
            webhookUrl: `${publicBase}/webhooks/google-leads`,
            totalOrders: Number(googleCount?.count || 0),
          },
          universal: {
            webhookUrl: `${publicBase}/webhooks/ad-order`,
          },
        },
      };
    },
  );

  app.post(
    "/admin/social-webhooks/test-order",
    {
      preHandler: requireAdmin,
      schema: {
        tags: ["Admin"],
        summary: "Simulate a test order arriving from Facebook or TikTok Ad",
        body: Type.Object({
          source: Type.Union([Type.Literal("facebook_ad"), Type.Literal("tiktok_ad"), Type.Literal("google_ad")]),
          model: Type.Optional(Type.String()),
          color: Type.Optional(Type.String()),
        }),
      },
    },
    async (req, reply) => {
      const b = req.body as any;
      const testNames = ["Muhammad Hamza", "Bilal Ahmed", "Shahzad Sheikh", "Zeeshan Ali", "Usman Tariq"];
      const testCities = ["Lahore", "Karachi", "Islamabad", "Rawalpindi", "Faisalabad"];
      const randomName = testNames[Math.floor(Math.random() * testNames.length)];
      const randomCity = testCities[Math.floor(Math.random() * testCities.length)];
      const randomPhone = `0300${Math.floor(1000000 + Math.random() * 9000000)}`;

      const order = await createSocialAdOrder({
        source: b.source,
        customerName: `${randomName} (Ad Test)`,
        customerPhone: randomPhone,
        city: randomCity,
        line1: "House 45, Street 8, Block B",
        productSlug: "crystal-clear-magsafe-case",
        modelName: b.model || "iPhone 18 Pro Max",
        colorName: b.color || "Crystal Clear",
        campaignName: `${b.source.toUpperCase().replace("_", " ")} Test Campaign`,
        notes: "Test order created from Admin Panel to verify social webhook pipeline",
      });

      return reply.code(201).send({
        ok: true,
        data: order,
        message: `Test order #${order.orderNumber} successfully booked from ${b.source}!`,
      });
    },
  );
}
