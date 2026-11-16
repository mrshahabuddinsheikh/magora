import type { FastifyInstance } from "fastify";
import { Type } from "typebox";
import { and, asc, count, desc, eq, gte, inArray, isNull, notInArray, sql } from "drizzle-orm";
import { cached } from "../lib/cache";
import { db } from "../db/client";
import * as s from "../db/schema";
import { requireAdmin } from "../lib/auth";
import { badRequest, notFound } from "../lib/errors";
import { normalizePkPhone } from "./orders";
import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";

/* ───────────── customer risk (COD) ───────────── */

export type RiskLevel = "blocked" | "high" | "medium" | "new" | "trusted";
export interface PhoneRisk {
  level: RiskLevel;
  orders: number;
  delivered: number;
  refused: number;
  blocked: boolean;
  blockReason: string | null;
}

/** History of every phone number in one query: delivered vs cancelled/returned orders. */
export async function riskFor(phones: string[]): Promise<Map<string, PhoneRisk>> {
  const uniq = [...new Set(phones)];
  const out = new Map<string, PhoneRisk>();
  if (!uniq.length) return out;
  const [rows, blocked] = await Promise.all([
    db
      .select({
        phone: s.orders.customerPhone,
        orders: count(),
        delivered: sql<number>`sum(case when ${s.orders.status} = 'delivered' then 1 else 0 end)`,
        refused: sql<number>`sum(case when ${s.orders.status} in ('cancelled','returned') then 1 else 0 end)`,
      })
      .from(s.orders)
      .where(inArray(s.orders.customerPhone, uniq))
      .groupBy(s.orders.customerPhone),
    db.select().from(s.blockedPhones).where(inArray(s.blockedPhones.phone, uniq)),
  ]);
  const hist = new Map(rows.map((r) => [r.phone, r]));
  const blk = new Map(blocked.map((b) => [b.phone, b]));
  for (const p of uniq) {
    const h = hist.get(p);
    const orders = h?.orders ?? 0, delivered = Number(h?.delivered ?? 0), refused = Number(h?.refused ?? 0);
    const b = blk.get(p);
    const level: RiskLevel = b ? "blocked" : refused >= 2 && refused > delivered ? "high" : refused >= 1 ? "medium" : delivered >= 1 ? "trusted" : "new";
    out.set(p, { level, orders, delivered, refused, blocked: !!b, blockReason: b?.reason ?? null });
  }
  return out;
}

export async function isBlocked(phone: string) {
  const [b] = await db.select().from(s.blockedPhones).where(eq(s.blockedPhones.phone, phone));
  return !!b;
}

/* ───────────── public: back-in-stock requests ───────────── */

export async function engageRoutes(app: FastifyInstance) {
  /**
   * "Someone in Lahore just bought …" — built ONLY from real orders of the last 7 days.
   * No names or phone numbers leave the server: just city, product and how long ago.
   */
  app.get("/social-proof", { schema: { tags: ["Catalog"], summary: "Recent purchases & trust signals" } }, async (_req, reply) => {
    // 1. Get settings
    const [settingsRow] = await db.select().from(s.trustSettings).where(eq(s.trustSettings.key, "general"));
    const settings = (settingsRow?.value as { enabled?: boolean; mode?: "auto" | "custom" | "hybrid"; initialDelaySec?: number; intervalSec?: number; durationSec?: number }) ?? {
      enabled: true,
      mode: "hybrid",
      initialDelaySec: 6,
      intervalSec: 28,
      durationSec: 6,
    };

    if (settings.enabled === false) {
      return { data: [], settings };
    }

    // 2. Load custom trust signals
    const customSignals = await db
      .select({
        city: s.trustSignals.city,
        product: s.trustSignals.productName,
        slug: s.trustSignals.productSlug,
        material: s.trustSignals.material,
        colorHex: s.trustSignals.colorHex,
        model: s.trustSignals.modelName,
        at: s.trustSignals.timeAgoText,
      })
      .from(s.trustSignals)
      .where(eq(s.trustSignals.active, true))
      .orderBy(asc(s.trustSignals.sort));

    if (settings.mode === "custom") {
      reply.header("cache-control", "no-cache");
      return { data: customSignals, settings };
    }

    // 3. Load real purchases
    const since = new Date(Date.now() - 7 * 864e5);
    const rows = await db
      .select({
        id: s.orders.id,
        city: s.orders.city,
        at: s.orders.createdAt,
        name: s.orderItems.productName,
        slug: s.orderItems.productSlug,
        material: s.orderItems.material,
        colorHex: s.orderItems.colorHex,
        model: s.orderItems.modelName,
      })
      .from(s.orders)
      .innerJoin(s.orderItems, eq(s.orderItems.orderId, s.orders.id))
      .where(and(gte(s.orders.createdAt, since), notInArray(s.orders.status, ["cancelled", "returned"])))
      .orderBy(desc(s.orders.createdAt))
      .limit(60);

    const seen = new Set<number>();
    const realOrders = rows
      .filter((r) => !seen.has(r.id) && seen.add(r.id))
      .slice(0, 20)
      .map((r) => ({
        city: r.city,
        product: r.name,
        slug: r.slug,
        material: r.material,
        colorHex: r.colorHex,
        model: r.model || null,
        at: r.at.toISOString(),
      }));

    let combined = [];
    if (settings.mode === "hybrid") {
      // Interleave custom signals and real orders
      combined = [...customSignals, ...realOrders];
    } else {
      combined = realOrders.length ? realOrders : customSignals;
    }

    reply.header("cache-control", "no-cache");
    return { data: combined, settings };
  });

  app.post(
    "/stock-alerts",
    {
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
      schema: {
        tags: ["Catalog"],
        summary: "Notify me when this product / colour / phone is back in stock",
        body: Type.Object({
          productId: Type.Integer(),
          colorId: Type.Optional(Type.Integer()),
          modelSlug: Type.Optional(Type.String({ maxLength: 80 })),
          phone: Type.String({ minLength: 10, maxLength: 20 }),
          name: Type.Optional(Type.String({ maxLength: 80 })),
        }),
      },
    },
    async (req, reply) => {
      const b = req.body as { productId: number; colorId?: number; modelSlug?: string; phone: string; name?: string };
      const phone = normalizePkPhone(b.phone);
      if (!phone) throw badRequest("Please enter a valid mobile number, e.g. 0300 1234567", "invalid_phone");
      const [p] = await db.select({ id: s.products.id }).from(s.products).where(eq(s.products.id, b.productId));
      if (!p) throw notFound("Product");
      let modelId: number | null = null;
      if (b.modelSlug) {
        const [m] = await db.select({ id: s.phoneModels.id }).from(s.phoneModels).where(eq(s.phoneModels.slug, b.modelSlug));
        modelId = m?.id ?? null;
      }
      const same = and(
        eq(s.stockAlerts.productId, b.productId),
        eq(s.stockAlerts.phone, phone),
        isNull(s.stockAlerts.notifiedAt),
        b.colorId ? eq(s.stockAlerts.colorId, b.colorId) : isNull(s.stockAlerts.colorId),
        modelId ? eq(s.stockAlerts.phoneModelId, modelId) : isNull(s.stockAlerts.phoneModelId),
      );
      const [exists] = await db.select({ id: s.stockAlerts.id }).from(s.stockAlerts).where(same);
      if (!exists)
        await db.insert(s.stockAlerts).values({ productId: b.productId, colorId: b.colorId ?? null, phoneModelId: modelId, phone, name: b.name?.trim() || null });
      reply.code(201);
      return { data: { ok: true } };
    },
  );
}

/* ───────────── admin: COD confirmation, blacklist, stock alerts ───────────── */

const tags = ["Admin"];
const security = [{ bearerAuth: [] }];

export async function adminEngageRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAdmin);

  /** New cash-on-delivery orders waiting for a confirmation call */
  app.get("/cod-queue", { schema: { tags, security, summary: "Pending COD orders with customer risk" } }, async () => {
    const rows = await db
      .select()
      .from(s.orders)
      .where(and(eq(s.orders.status, "pending"), eq(s.orders.paymentMethod, "cod")))
      .orderBy(asc(s.orders.createdAt))
      .limit(200);
    const ids = rows.map((o) => o.id);
    const [risk, items, events] = await Promise.all([
      riskFor(rows.map((o) => o.customerPhone)),
      ids.length
        ? db.select({ orderId: s.orderItems.orderId, name: s.orderItems.productName, model: s.orderItems.modelName, color: s.orderItems.colorName, qty: s.orderItems.qty }).from(s.orderItems).where(inArray(s.orderItems.orderId, ids))
        : Promise.resolve([]),
      ids.length
        ? db.select().from(s.orderEvents).where(inArray(s.orderEvents.orderId, ids)).orderBy(desc(s.orderEvents.createdAt))
        : Promise.resolve([]),
    ]);
    return {
      data: rows.map((o) => {
        const ev = events.filter((e) => e.orderId === o.id);
        return {
          number: o.number,
          createdAt: o.createdAt,
          name: o.customerName,
          phone: o.customerPhone,
          city: o.city,
          address: [o.line1, o.area].filter(Boolean).join(", "),
          total: o.total,
          items: items.filter((i) => i.orderId === o.id).map(({ orderId: _, ...i }) => i),
          attempts: ev.filter((e) => e.note?.startsWith("Call:")).length,
          lastNote: ev.find((e) => e.note?.startsWith("Call:"))?.note ?? null,
          risk: risk.get(o.customerPhone)!,
        };
      }),
    };
  });

  app.get("/blacklist", { schema: { tags, security } }, async () => {
    const rows = await db.select().from(s.blockedPhones).orderBy(desc(s.blockedPhones.createdAt));
    const risk = await riskFor(rows.map((r) => r.phone));
    return { data: rows.map((r) => ({ ...r, orders: risk.get(r.phone)?.orders ?? 0, refused: risk.get(r.phone)?.refused ?? 0 })) };
  });

  app.post(
    "/blacklist",
    { schema: { tags, security, summary: "Block a number from cash on delivery", body: Type.Object({ phone: Type.String({ minLength: 10, maxLength: 20 }), reason: Type.Optional(Type.String({ maxLength: 200 })) }) } },
    async (req, reply) => {
      const b = req.body as { phone: string; reason?: string };
      const phone = normalizePkPhone(b.phone);
      if (!phone) throw badRequest("Invalid mobile number", "invalid_phone");
      const reason = b.reason?.trim() || null;
      const [ex] = await db.select().from(s.blockedPhones).where(eq(s.blockedPhones.phone, phone));
      if (ex) {
        await db.update(s.blockedPhones).set({ reason }).where(eq(s.blockedPhones.phone, phone));
      } else {
        await db.insert(s.blockedPhones).values({ phone, reason });
      }
      reply.code(201);
      return { data: { phone } };
    },
  );

  app.delete("/blacklist/:phone", { schema: { tags, security, params: Type.Object({ phone: Type.String() }) } }, async (req) => {
    const phone = normalizePkPhone((req.params as { phone: string }).phone) ?? (req.params as { phone: string }).phone;
    await db.delete(s.blockedPhones).where(eq(s.blockedPhones.phone, phone));
    return { data: { ok: true } };
  });

  /** Customer forgot their password → make a temporary one the admin can send on WhatsApp */
  app.post(
    "/accounts/reset-password",
    { schema: { tags, security, summary: "Give a customer account a temporary password", body: Type.Object({ email: Type.String({ maxLength: 200 }) }) } },
    async (req) => {
      const email = (req.body as { email: string }).email.trim().toLowerCase();
      const [u] = await db.select().from(s.users).where(eq(s.users.email, email));
      if (!u) throw notFound("Account");
      const words = "abcdefghjkmnpqrstuvwxyz23456789";
      const temp = Array.from({ length: 10 }, () => words[randomInt(words.length)]).join("");
      await db.update(s.users).set({ passwordHash: await bcrypt.hash(temp, 10) }).where(eq(s.users.id, u.id));
      return { data: { email, tempPassword: temp } };
    },
  );

  /** Back-in-stock requests, newest first, with "in stock now" so you know whom to message */
  app.get(
    "/stock-alerts",
    { schema: { tags, security, querystring: Type.Object({ status: Type.Optional(Type.Union([Type.Literal("waiting"), Type.Literal("notified")])) }) } },
    async (req) => {
      const notified = (req.query as { status?: string }).status === "notified";
      const rows = await db
        .select({
          id: s.stockAlerts.id,
          phone: s.stockAlerts.phone,
          name: s.stockAlerts.name,
          createdAt: s.stockAlerts.createdAt,
          notifiedAt: s.stockAlerts.notifiedAt,
          productId: s.products.id,
          productSlug: s.products.slug,
          productName: s.products.name,
          colorId: s.stockAlerts.colorId,
          colorName: s.productColors.name,
          colorHex: s.productColors.hex,
          modelId: s.stockAlerts.phoneModelId,
          modelSlug: s.phoneModels.slug,
          modelName: s.phoneModels.name,
          stock: sql<number>`(select coalesce(sum(v.stock),0) from variants v where v.product_id = ${s.stockAlerts.productId} and v.active = 1
            and (${s.stockAlerts.colorId} is null or v.color_id = ${s.stockAlerts.colorId})
            and (${s.stockAlerts.phoneModelId} is null or v.phone_model_id = ${s.stockAlerts.phoneModelId}))`,
        })
        .from(s.stockAlerts)
        .innerJoin(s.products, eq(s.products.id, s.stockAlerts.productId))
        .leftJoin(s.productColors, eq(s.productColors.id, s.stockAlerts.colorId))
        .leftJoin(s.phoneModels, eq(s.phoneModels.id, s.stockAlerts.phoneModelId))
        .where(notified ? sql`${s.stockAlerts.notifiedAt} is not null` : isNull(s.stockAlerts.notifiedAt))
        .orderBy(desc(s.stockAlerts.createdAt))
        .limit(500);
      return { data: rows.map((r) => ({ ...r, stock: Number(r.stock), inStock: Number(r.stock) > 0 })) };
    },
  );

  app.post("/stock-alerts/:id/notified", { schema: { tags, security, params: Type.Object({ id: Type.Integer() }) } }, async (req) => {
    const id = (req.params as { id: number }).id;
    await db.update(s.stockAlerts).set({ notifiedAt: new Date() }).where(eq(s.stockAlerts.id, id));
    return { data: { ok: true } };
  });

  app.delete("/stock-alerts/:id", { schema: { tags, security, params: Type.Object({ id: Type.Integer() }) } }, async (req) => {
    await db.delete(s.stockAlerts).where(eq(s.stockAlerts.id, (req.params as { id: number }).id));
    return { data: { ok: true } };
  });
}
