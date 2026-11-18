import type { FastifyInstance } from "fastify";
import { Type } from "typebox";
import { and, inArray, isNull, asc, avg, count, desc, eq, gte, like, lte, ne, or, sql, type SQL } from "drizzle-orm";
import { db } from "../db/client";
import * as s from "../db/schema";
import { requireAdmin } from "../lib/auth";
import { badRequest, notFound } from "../lib/errors";
import { invalidate } from "../lib/cache";
import { revalidateWeb } from "../lib/revalidate";
import { phoneSearchText, slugify } from "../lib/text";
import { ORDER_STATUSES } from "../lib/types";
import { STATUS_LABEL, loadOrder, presentOrder, restock } from "./orders";
import { getCodSettings, getLeadCaptureSettings } from "./cart";
import { adminReturnRoutes } from "./returns";
import { addShipmentEvent, stampsFor, upsertShipment } from "./tracking";
import { SHIPMENT_STATUSES, type ShipmentStatus } from "../lib/types";
import { getCourier, SHIPMENT_LABEL } from "../shipping";
import { riskFor } from "./engage";
import { threatProtection } from "../lib/security";

const tags = ["Admin"];
const security = [{ bearerAuth: [] }];

async function catalogChanged(slug?: string) {
  invalidate("catalog:");
  await revalidateWeb(slug ? ["products", `product:${slug}`] : ["products", "models"]);
}

async function refreshMinPrice(productId: number) {
  await db
    .update(s.products)
    .set({
      minPrice: sql`coalesce((select min(price) from variants where product_id = ${productId} and active = 1), ${s.products.basePrice})`,
      updatedAt: new Date(),
    })
    .where(eq(s.products.id, productId));
}

async function refreshRating(productId: number) {
  const [r] = await db
    .select({ a: avg(s.reviews.rating), c: count() })
    .from(s.reviews)
    .where(and(eq(s.reviews.productId, productId), eq(s.reviews.approved, true)));
  await db
    .update(s.products)
    .set({ ratingAvg: r.a ? Math.round(Number(r.a) * 10) / 10 : 0, ratingCount: r.c })
    .where(eq(s.products.id, productId));
}

export async function adminRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAdmin);
  await app.register(adminReturnRoutes);

  /* ───── dashboard ───── */
  app.get("/stats", { schema: { tags, security, summary: "Dashboard numbers" } }, async () => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const since30 = new Date(Date.now() - 30 * 864e5);
    const live = sql`${s.orders.status} not in ('cancelled','returned')`;
    const [[today], [month], [pending], [products], [lowStock], recent] = await Promise.all([
      db.select({ orders: count(), revenue: sql<number>`coalesce(sum(${s.orders.total}),0)` }).from(s.orders).where(and(gte(s.orders.createdAt, startOfDay), live)),
      db.select({ orders: count(), revenue: sql<number>`coalesce(sum(${s.orders.total}),0)` }).from(s.orders).where(and(gte(s.orders.createdAt, since30), live)),
      db.select({ n: count() }).from(s.orders).where(eq(s.orders.status, "pending")),
      db.select({ n: count() }).from(s.products).where(eq(s.products.active, true)),
      db.select({ n: count() }).from(s.variants).where(and(eq(s.variants.active, true), lte(s.variants.stock, 5))),
      db.select().from(s.orders).orderBy(desc(s.orders.createdAt)).limit(8),
    ]);
    const since14 = new Date(Date.now() - 13 * 864e5);
    since14.setHours(0, 0, 0, 0);
    const [daily, byStatus, top, openReturns, onRoad] = await Promise.all([
      db
        .select({ day: sql<string>`DATE_FORMAT(CONVERT_TZ(${s.orders.createdAt}, '+00:00', '+05:00'), '%Y-%m-%d')`, orders: count(), revenue: sql<number>`coalesce(sum(${s.orders.total}),0)` })
        .from(s.orders)
        .where(and(gte(s.orders.createdAt, since14), live))
        .groupBy(sql`1`),
      db.select({ status: s.orders.status, n: count() }).from(s.orders).groupBy(s.orders.status),
      db
        .select({ name: s.orderItems.productName, qty: sql<number>`sum(${s.orderItems.qty})`, revenue: sql<number>`sum(${s.orderItems.lineTotal})` })
        .from(s.orderItems)
        .innerJoin(s.orders, eq(s.orders.id, s.orderItems.orderId))
        .where(and(gte(s.orders.createdAt, since30), live))
        .groupBy(s.orderItems.productName)
        .orderBy(desc(sql`2`))
        .limit(5),
      db.select({ n: count() }).from(s.returnRequests).where(sql`${s.returnRequests.status} in ('requested','approved','pickup_scheduled','received')`),
      db.select({ n: count() }).from(s.shipments).where(sql`${s.shipments.status} not in ('delivered','returned_to_sender')`),
    ]);
    const series = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(since14.getTime() + i * 864e5 + 5 * 3600e3).toISOString().slice(0, 10);
      const hit = daily.find((x) => x.day === d);
      return { day: d, orders: hit?.orders ?? 0, revenue: hit?.revenue ?? 0 };
    });
    return {
      data: {
        series,
        byStatus: Object.fromEntries(byStatus.map((r) => [r.status, r.n])),
        topProducts: top,
        openReturns: openReturns[0].n,
        deliveriesOnRoad: onRoad[0].n,
        today,
        last30Days: month,
        pendingOrders: pending.n,
        activeProducts: products.n,
        lowStockVariants: lowStock.n,
        toPack: (await db.select({ n: count() }).from(s.orders).where(inArray(s.orders.status, ["confirmed", "processing"])))[0].n,
        codToConfirm: (await db.select({ n: count() }).from(s.orders).where(and(eq(s.orders.status, "pending"), eq(s.orders.paymentMethod, "cod"))))[0].n,
        stockAlertsWaiting: (await db.select({ n: count() }).from(s.stockAlerts).where(sql`${s.stockAlerts.notifiedAt} is null`))[0].n,
        recentOrders: recent.map((o) => ({ number: o.number, customerName: o.customerName, city: o.city, total: o.total, status: o.status, paymentMethod: o.paymentMethod, createdAt: o.createdAt })),
      },
    };
  });

  /* ───── orders ───── */
  app.get(
    "/orders",
    {
      schema: {
        tags,
        security,
        querystring: Type.Object({
          status: Type.Optional(Type.String()),
          q: Type.Optional(Type.String({ description: "order number, name or phone" })),
          page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
          limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 25 })),
        }),
      },
    },
    async (req) => {
      const { status, q, page = 1, limit = 25 } = req.query as { status?: string; q?: string; page?: number; limit?: number };
      const where: SQL[] = [];
      if (status) where.push(eq(s.orders.status, status));
      if (q) {
        const t = `%${q.trim()}%`;
        where.push(or(like(s.orders.number, t), like(s.orders.customerName, t), like(s.orders.customerPhone, t))!);
      }
      const w = where.length ? and(...where) : undefined;
      const [rows, [{ total }]] = await Promise.all([
        db.select().from(s.orders).where(w).orderBy(desc(s.orders.createdAt)).limit(limit).offset((page - 1) * limit),
        db.select({ total: count() }).from(s.orders).where(w),
      ]);
      return {
        data: rows.map((o) => ({
          number: o.number, status: o.status, paymentMethod: o.paymentMethod, paymentStatus: o.paymentStatus,
          customerName: o.customerName, customerPhone: o.customerPhone, city: o.city, total: o.total, source: o.source, createdAt: o.createdAt,
        })),
        meta: { page, limit, total, hasMore: page * limit < total },
      };
    },
  );

  app.get("/orders/:number", { schema: { tags, security, params: Type.Object({ number: Type.String() }) } }, async (req) => {
    const full = await loadOrder(eq(s.orders.number, (req.params as { number: string }).number));
    if (!full) throw notFound("Order");
    const risk = (await riskFor([full.order.customerPhone])).get(full.order.customerPhone);
    return { data: { ...presentOrder(full, false, { admin: true }), source: full.order.source, userId: full.order.userId, risk } };
  });

  app.patch(
    "/orders/:number",
    {
      schema: {
        tags,
        security,
        summary: "Update order status (adds a timeline event; cancel/return restocks)",
        params: Type.Object({ number: Type.String() }),
        body: Type.Object({
          status: Type.Optional(Type.Union(ORDER_STATUSES.map((x) => Type.Literal(x)))),
          paymentStatus: Type.Optional(Type.Union([Type.Literal("unpaid"), Type.Literal("paid"), Type.Literal("refunded")])),
          note: Type.Optional(Type.String({ maxLength: 300 })),
        }),
      },
    },
    async (req) => {
      const { number } = req.params as { number: string };
      const b = req.body as { status?: string; paymentStatus?: string; note?: string };
      const full = await loadOrder(eq(s.orders.number, number));
      if (!full) throw notFound("Order");
      const o = full.order;
      const set: Partial<typeof s.orders.$inferInsert> = { updatedAt: new Date() };
      if (b.paymentStatus) set.paymentStatus = b.paymentStatus;
      if (b.status && b.status !== o.status) {
        if (["cancelled", "returned"].includes(o.status)) throw badRequest("Order is already closed");
        set.status = b.status;
        Object.assign(set, stampsFor(b.status, o));
        if (b.status === "returned") set.returnType = o.returnType ?? "rto";
        if (b.status === "delivered" && o.paymentMethod === "cod") set.paymentStatus = "paid";
        if (["cancelled", "returned"].includes(b.status)) await restock(o.id);
        await db.insert(s.orderEvents).values({ orderId: o.id, status: b.status, note: b.note ?? null });
      } else if (b.note) {
        await db.insert(s.orderEvents).values({ orderId: o.id, status: o.status, note: b.note });
      }
      await db.update(s.orders).set(set).where(eq(s.orders.id, o.id));
      if (b.status) invalidate("catalog:product");
      return { data: presentOrder((await loadOrder(eq(s.orders.id, o.id)))!, false, { admin: true }) };
    },
  );

  /* ───── shipping & live tracking ───── */
  const orderOr404 = async (number: string) => {
    const [o] = await db.select().from(s.orders).where(eq(s.orders.number, number));
    if (!o) throw notFound("Order");
    return o;
  };

  app.put(
    "/orders/:number/shipment",
    {
      schema: {
        tags,
        security,
        summary: "Create / update the shipment (courier, tracking no., rider, ETA)",
        params: Type.Object({ number: Type.String() }),
        body: Type.Object({
          courier: Type.Optional(Type.String()),
          trackingNumber: Type.Optional(Type.Union([Type.String({ maxLength: 60 }), Type.Null()])),
          riderName: Type.Optional(Type.Union([Type.String({ maxLength: 60 }), Type.Null()])),
          riderPhone: Type.Optional(Type.Union([Type.String({ maxLength: 20 }), Type.Null()])),
          etaAt: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        }),
      },
    },
    async (req) => {
      const o = await orderOr404((req.params as { number: string }).number);
      if (["cancelled", "returned"].includes(o.status)) throw badRequest("Order is closed");
      await upsertShipment(o, req.body as Parameters<typeof upsertShipment>[1]);
      return { data: presentOrder((await loadOrder(eq(s.orders.id, o.id)))!, false, { admin: true }) };
    },
  );

  app.post(
    "/orders/:number/shipment/events",
    {
      schema: {
        tags,
        security,
        summary: "Add a tracking update (e.g. arrived at Lahore hub). Moves the order status automatically.",
        params: Type.Object({ number: Type.String() }),
        body: Type.Object({
          status: Type.Union(SHIPMENT_STATUSES.map((x) => Type.Literal(x))),
          location: Type.Optional(Type.String({ maxLength: 120 })),
          note: Type.Optional(Type.String({ maxLength: 300 })),
        }),
      },
    },
    async (req) => {
      const o = await orderOr404((req.params as { number: string }).number);
      const [sh] = await db.select().from(s.shipments).where(eq(s.shipments.orderId, o.id));
      if (!sh) throw badRequest("Create the shipment first");
      const b = req.body as { status: ShipmentStatus; location?: string; note?: string };
      await addShipmentEvent(sh, o, { ...b, source: "admin" });
      return { data: presentOrder((await loadOrder(eq(s.orders.id, o.id)))!, false, { admin: true }) };
    },
  );

  app.post(
    "/orders/:number/shipment/sync",
    { schema: { tags, security, summary: "Pull latest status from the courier API", params: Type.Object({ number: Type.String() }) } },
    async (req) => {
      const o = await orderOr404((req.params as { number: string }).number);
      const [sh] = await db.select().from(s.shipments).where(eq(s.shipments.orderId, o.id));
      if (!sh?.trackingNumber) throw badRequest("No tracking number yet");
      const c = getCourier(sh.courier);
      const events = c?.fetchTracking ? await c.fetchTracking(sh.trackingNumber) : null;
      if (!events) throw badRequest(`${c?.name ?? sh.courier} API is not connected yet — add the API key in .env`);
      const seen = await db.select().from(s.shipmentEvents).where(eq(s.shipmentEvents.shipmentId, sh.id));
      for (const e of events.sort((a, b) => a.at.getTime() - b.at.getTime())) {
        if (seen.some((x) => x.status === e.status && Math.abs(x.at.getTime() - e.at.getTime()) < 60_000)) continue;
        const [cur] = await db.select().from(s.shipments).where(eq(s.shipments.id, sh.id));
        const [ord] = await db.select().from(s.orders).where(eq(s.orders.id, o.id));
        await addShipmentEvent(cur, ord, { ...e, source: "courier" });
      }
      return { data: presentOrder((await loadOrder(eq(s.orders.id, o.id)))!, false, { admin: true }) };
    },
  );

  /** Every delivery that is on the road right now, with rider positions (for the live map) */
  app.get("/deliveries/live", { schema: { tags, security } }, async () => {
    const rows = await db
      .select({
        number: s.orders.number, customerName: s.orders.customerName, city: s.orders.city, total: s.orders.total,
        status: s.shipments.status, riderName: s.shipments.riderName, riderPhone: s.shipments.riderPhone,
        lat: s.shipments.lastLat, lng: s.shipments.lastLng, lastLocationAt: s.shipments.lastLocationAt, courier: s.shipments.courier, etaAt: s.shipments.etaAt,
      })
      .from(s.shipments)
      .innerJoin(s.orders, eq(s.orders.id, s.shipments.orderId))
      .where(sql`${s.shipments.status} not in ('delivered','returned_to_sender')`)
      .orderBy(desc(s.shipments.updatedAt))
      .limit(200);
    return { data: rows.map((r) => ({ ...r, statusLabel: SHIPMENT_LABEL[r.status] })) };
  });

  /* ───── customers (registered + guest, grouped by mobile number) ───── */
  app.get(
    "/customers",
    { schema: { tags, security, querystring: Type.Object({ q: Type.Optional(Type.String()), page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })) }) } },
    async (req) => {
      const { q, page = 1 } = req.query as { q?: string; page?: number };
      const w = q ? or(like(s.orders.customerName, `%${q}%`), like(s.orders.customerPhone, `%${q}%`), like(s.orders.customerEmail, `%${q}%`)) : undefined;
      const rows = await db
        .select({
          phone: s.orders.customerPhone,
          name: sql<string>`max(${s.orders.customerName})`,
          email: sql<string | null>`max(${s.orders.customerEmail})`,
          city: sql<string>`max(${s.orders.city})`,
          userId: sql<number | null>`max(${s.orders.userId})`,
          orders: count(),
          spent: sql<number>`coalesce(sum(case when ${s.orders.status} not in ('cancelled','returned') then ${s.orders.total} else 0 end),0)`,
          cancelled: sql<number>`sum(case when ${s.orders.status} = 'cancelled' then 1 else 0 end)`,
          lastOrderAt: sql<number>`max(${s.orders.createdAt})`,
        })
        .from(s.orders)
        .where(w)
        .groupBy(s.orders.customerPhone)
        .orderBy(desc(sql`max(${s.orders.createdAt})`))
        .limit(50)
        .offset((page - 1) * 50);
      const [{ users }] = await db.select({ users: count() }).from(s.users).where(eq(s.users.role, "customer"));
      return { data: rows.map((r) => ({ ...r, registered: !!r.userId, lastOrderAt: new Date(Number(r.lastOrderAt)) })), meta: { page, registeredAccounts: users } };
    },
  );

  app.get("/customers/:phone", { schema: { tags, security, params: Type.Object({ phone: Type.String() }) } }, async (req) => {
    const phone = decodeURIComponent((req.params as { phone: string }).phone);
    const orders = await db.select().from(s.orders).where(eq(s.orders.customerPhone, phone)).orderBy(desc(s.orders.createdAt)).limit(100);
    if (!orders.length) throw notFound("Customer");
    const user = orders.find((o) => o.userId) ? (await db.select({ id: s.users.id, name: s.users.name, email: s.users.email, createdAt: s.users.createdAt }).from(s.users).where(eq(s.users.id, orders.find((o) => o.userId)!.userId!)))[0] : null;
    return {
      data: {
        phone,
        name: orders[0].customerName,
        email: orders.find((o) => o.customerEmail)?.customerEmail ?? null,
        addresses: [...new Set(orders.map((o) => `${o.line1}, ${o.city}`))].slice(0, 5),
        account: user,
        orders: orders.map((o) => ({ number: o.number, status: o.status, statusLabel: STATUS_LABEL[o.status], total: o.total, createdAt: o.createdAt, paymentMethod: o.paymentMethod })),
      },
    };
  });

  /* ───── CSV export ───── */
  app.get(
    "/orders/export",
    { schema: { tags, security, summary: "Orders as CSV (Excel)", querystring: Type.Object({ from: Type.Optional(Type.String()), to: Type.Optional(Type.String()), status: Type.Optional(Type.String()) }) } },
    async (req, reply) => {
      const { from, to, status } = req.query as { from?: string; to?: string; status?: string };
      const conds: SQL[] = [];
      if (from) conds.push(gte(s.orders.createdAt, new Date(from)));
      if (to) conds.push(lte(s.orders.createdAt, new Date(new Date(to).getTime() + 864e5)));
      if (status) conds.push(eq(s.orders.status, status));
      const rows = await db.select().from(s.orders).where(conds.length ? and(...conds) : undefined).orderBy(desc(s.orders.createdAt)).limit(20000);
      const items = rows.length ? await db.select().from(s.orderItems).where(sql`${s.orderItems.orderId} in (${sql.join(rows.map((r) => sql`${r.id}`), sql`,`)})`) : [];
      const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const head = ["Order", "Date", "Status", "Payment", "Payment status", "Customer", "Phone", "Email", "City", "Address", "Items", "Subtotal", "Discount", "Delivery", "Total", "Coupon", "Source"];
      const lines = rows.map((o) =>
        [
          o.number, o.createdAt.toISOString(), o.status, o.paymentMethod, o.paymentStatus, o.customerName, o.customerPhone, o.customerEmail, o.city,
          `${o.line1}${o.area ? ", " + o.area : ""}`,
          items.filter((i) => i.orderId === o.id).map((i) => `${i.qty}x ${i.productName} (${i.modelName}, ${i.colorName})`).join(" | "),
          o.subtotal, o.discount, o.shipping, o.total, o.couponCode, o.source,
        ].map(esc).join(","),
      );
      reply.header("content-type", "text/csv; charset=utf-8").header("content-disposition", `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"`);
      return "\uFEFF" + [head.map(esc).join(","), ...lines].join("\r\n");
    },
  );

  /* ───── products ───── */
  app.get(
    "/products",
    {
      schema: {
        tags,
        security,
        querystring: Type.Object({
          q: Type.Optional(Type.String()),
          category: Type.Optional(Type.String({ description: "category slug or section (magsafe-cases, skins, screen-protectors, gadgets, earbuds…)" })),
          status: Type.Optional(Type.Union([Type.Literal("live"), Type.Literal("hidden"), Type.Literal("low")])),
          page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
        }),
      },
    },
    async (req) => {
      const { q, page = 1, category, status } = req.query as { q?: string; page?: number; category?: string; status?: string };
      const conds: SQL[] = [];
      if (q) conds.push(like(s.products.name, `%${q}%`));
      if (category) conds.push(sql`${s.products.categoryId} in (select id from categories where slug = ${category} or section = ${category})`);
      if (status === "live") conds.push(eq(s.products.active, true));
      if (status === "hidden") conds.push(eq(s.products.active, false));
      if (status === "low") conds.push(sql`(select coalesce(sum(stock),0) from variants where product_id = ${s.products.id} and active = 1) < 20`);
      const w = conds.length ? and(...conds) : undefined;
      const rows = await db
        .select({
          id: s.products.id, slug: s.products.slug, name: s.products.name, material: s.products.material,
          basePrice: s.products.basePrice, compareAtPrice: s.products.compareAtPrice, minPrice: s.products.minPrice,
          badge: s.products.badge, featured: s.products.featured, active: s.products.active, soldCount: s.products.soldCount,
          category: sql<string>`(select name from categories where id = ${s.products.categoryId})`,
          categorySlug: sql<string>`(select slug from categories where id = ${s.products.categoryId})`,
          section: sql<string>`(select section from categories where id = ${s.products.categoryId})`,
          firstColor: sql<string>`(select hex from product_colors where product_id = ${s.products.id} order by sort limit 1)`,
          firstDesign: sql<string | null>`(select design_url from product_colors where product_id = ${s.products.id} order by sort limit 1)`,
          view: s.products.view,
          images: s.products.images,
          stock: sql<number>`(select coalesce(sum(stock),0) from variants where product_id = ${s.products.id})`,
          variantCount: sql<number>`(select count(*) from variants where product_id = ${s.products.id})`,
        })
        .from(s.products)
        .where(w)
        .orderBy(desc(s.products.featured), asc(s.products.id))
        .limit(50)
        .offset((page - 1) * 50);
      const [{ total }] = await db.select({ total: count() }).from(s.products).where(w);
      return { data: rows, meta: { page, limit: 50, total, hasMore: page * 50 < total } };
    },
  );

  const url = Type.Union([Type.String({ maxLength: 500 }), Type.Null()]);
  const viewSchema = Type.Object({
    mode: Type.Optional(Type.Union([Type.Literal("auto"), Type.Literal("design"), Type.Literal("model"), Type.Literal("photos")])),
    first: Type.Optional(Type.Union([Type.Literal("3d"), Type.Literal("photos")])),
    designUrl: Type.Optional(url),
    designFit: Type.Optional(Type.Union([Type.Literal("cover"), Type.Literal("contain"), Type.Literal("logo")])),
    modelUrl: Type.Optional(url),
    modelBytes: Type.Optional(Type.Integer({ minimum: 0 })),
  });

  const productBody = {
    name: Type.String({ minLength: 3, maxLength: 120 }),
    brand: Type.Optional(Type.String({ maxLength: 80, description: "Product brand / company (e.g. Casetify, dbrand, Ronin, Spigen, Magora)" })),
    subtitle: Type.Optional(Type.String({ maxLength: 160 })),
    description: Type.Optional(Type.String({ maxLength: 4000 })),
    material: Type.String({ minLength: 1, maxLength: 80, description: "3D material style (built-in or custom)" }),
    basePrice: Type.Integer({ minimum: 1 }),
    compareAtPrice: Type.Optional(Type.Union([Type.Integer({ minimum: 1 }), Type.Null()])),
    badge: Type.Optional(Type.Union([Type.String({ maxLength: 30 }), Type.Null()])),
    featured: Type.Optional(Type.Boolean()),
    active: Type.Optional(Type.Boolean()),
    features: Type.Optional(Type.Array(Type.String({ maxLength: 60 }), { maxItems: 8 })),
    images: Type.Optional(Type.Array(Type.String({ maxLength: 500 }), { maxItems: 10, description: "photo URLs from POST /uploads" })),
    view: Type.Optional(viewSchema),
    specs: Type.Optional(Type.Array(Type.Object({ label: Type.String({ maxLength: 40 }), value: Type.String({ maxLength: 200 }) }), { maxItems: 12 })),
  };

  app.post(
    "/products",
    {
      schema: {
        tags,
        security,
        summary: "Create a product — variants are generated for every phone model × colour automatically",
        body: Type.Object({
          ...productBody,
          category: Type.Optional(Type.String({ description: "magsafe-cases | skins | screen-protectors | cables | chargers | earbuds | handsfree | smart-watches | power-banks" })),
          colors: Type.Array(
            Type.Object({
              name: Type.String(),
              hex: Type.String({ pattern: "^#[0-9a-fA-F]{6}$" }),
              accentHex: Type.Optional(Type.String()),
              priceAdd: Type.Optional(Type.Integer({ minimum: 0, description: "extra price for this option (e.g. 2 m cable)" })),
              stock: Type.Optional(Type.Integer({ minimum: 0, description: "starting stock per variant of this option" })),
              designUrl: Type.Optional(url),
            }),
            { minItems: 1, maxItems: 12 },
          ),
          modelSlugs: Type.Optional(Type.Array(Type.String(), { description: "defaults to every model" })),
          stock: Type.Optional(Type.Integer({ minimum: 0, default: 20 })),
        }),
      },
    },
    async (req, reply) => {
      const b = req.body as {
        name: string; brand?: string; subtitle?: string; description?: string; material: string; basePrice: number; compareAtPrice?: number | null;
        badge?: string | null; featured?: boolean; active?: boolean; features?: string[];
        colors: { name: string; hex: string; accentHex?: string; priceAdd?: number; stock?: number; designUrl?: string | null }[]; modelSlugs?: string[]; stock?: number; category?: string;
        images?: string[]; specs?: { label: string; value: string }[]; view?: Record<string, unknown>;
      };
      const [cat] = b.category
        ? await db.select().from(s.categories).where(eq(s.categories.slug, b.category))
        : await db.select().from(s.categories).orderBy(asc(s.categories.id)).limit(1);
      if (!cat) throw badRequest("Unknown category");
      const universal = cat.section === "gadgets";
      const adj = (pa: number) => (cat.slug === "magsafe-cases" ? pa : Math.round(pa / 300) * 100);
      let slug = slugify(b.name);
      const [taken] = await db.select({ id: s.products.id }).from(s.products).where(eq(s.products.slug, slug));
      if (taken) slug = `${slug}-${Date.now().toString(36)}`;
      const models = await db.select().from(s.phoneModels).where(eq(s.phoneModels.active, true));
      const use = b.modelSlugs?.length ? models.filter((m) => b.modelSlugs!.includes(m.slug)) : models;
      if (!universal && !use.length) throw badRequest("No valid phone models selected");

      const product = await db.transaction(async (tx) => {
        const [insertProd] = await tx
          .insert(s.products)
          .values({
            slug, name: b.name, brand: b.brand?.trim() || "Magora", subtitle: b.subtitle ?? "", description: b.description ?? "", categoryId: cat.id, material: b.material,
            basePrice: b.basePrice, compareAtPrice: b.compareAtPrice ?? null, badge: b.badge ?? null, featured: b.featured ?? false,
            active: b.active ?? true, features: b.features ?? [], minPrice: b.basePrice,
            images: b.images ?? [], specs: b.specs ?? [], view: b.view ?? {},
          });
        const [p] = await tx.select().from(s.products).where(eq(s.products.id, insertProd.insertId));
        for (const [i, c] of b.colors.entries()) {
          await tx.insert(s.productColors).values({ productId: p.id, name: c.name, hex: c.hex, accentHex: c.accentHex ?? null, designUrl: c.designUrl ?? null, sort: i });
        }
        const colors = await tx.select().from(s.productColors).where(eq(s.productColors.productId, p.id)).orderBy(s.productColors.sort);
        const add = (i: number) => b.colors[i]?.priceAdd ?? 0;
        const rows = universal
          ? colors.map((c, i) => ({
              productId: p.id, phoneModelId: null, colorId: c.id, sku: `${p.id}-U-${c.id}`,
              price: b.basePrice + add(i), compareAtPrice: b.compareAtPrice ? b.compareAtPrice + add(i) : null, stock: b.colors[i]?.stock ?? b.stock ?? 20,
            }))
          : use.flatMap((m) =>
          colors.map((c, i) => ({
            productId: p.id, phoneModelId: m.id, colorId: c.id, sku: `${p.id}-${m.slug}-${c.id}`.toUpperCase(),
            price: b.basePrice + adj(m.priceAdjust) + add(i), compareAtPrice: b.compareAtPrice ? b.compareAtPrice + adj(m.priceAdjust) + add(i) : null, stock: b.colors[i]?.stock ?? b.stock ?? 20,
          })),
        );
        for (let i = 0; i < rows.length; i += 200) await tx.insert(s.variants).values(rows.slice(i, i + 200));
        return p;
      });
      await refreshMinPrice(product.id);
      await catalogChanged(product.slug);
      reply.code(201);
      return { data: product };
    },
  );

  app.patch(
    "/products/:id",
    { schema: { tags, security, params: Type.Object({ id: Type.Integer() }), body: Type.Partial(Type.Object({ ...productBody, category: Type.String() })) } },
    async (req) => {
      const { id } = req.params as { id: number };
      const { category, ...b } = req.body as Partial<typeof s.products.$inferInsert> & { basePrice?: number; category?: string };
      const [before] = await db.select().from(s.products).where(eq(s.products.id, id));
      if (!before) throw notFound("Product");
      if (category) {
        const [to] = await db.select().from(s.categories).where(eq(s.categories.slug, category));
        const [from] = await db.select().from(s.categories).where(eq(s.categories.id, before.categoryId));
        if (!to) throw badRequest("Unknown category");
        // gadgets have one variant per option, phone products one per phone × option — can't switch between them
        if ((to.section === "gadgets") !== (from?.section === "gadgets")) throw badRequest("A gadget can't be moved to a phone category (or back). Duplicate it into the new category instead.");
        b.categoryId = to.id;
      }
      await db.update(s.products).set({ ...b, updatedAt: new Date() }).where(eq(s.products.id, id));
      const [p] = await db.select().from(s.products).where(eq(s.products.id, id));
      // base price change → shift every variant by the same amount
      if (b.basePrice && b.basePrice !== before.basePrice) {
        const delta = b.basePrice - before.basePrice;
        await db.update(s.variants).set({ price: sql`${s.variants.price} + ${delta}` }).where(eq(s.variants.productId, id));
      }
      await refreshMinPrice(id);
      await catalogChanged(p.slug);
      return { data: p };
    },
  );

  app.get("/products/:id/variants", { schema: { tags, security, params: Type.Object({ id: Type.Integer() }) } }, async (req) => {
    const { id } = req.params as { id: number };
    return {
      data: await db
        .select({
          id: s.variants.id, sku: s.variants.sku, price: s.variants.price, compareAtPrice: s.variants.compareAtPrice, stock: s.variants.stock, active: s.variants.active,
          model: sql<string>`coalesce(${s.phoneModels.name}, 'All phones')`, color: s.productColors.name, colorHex: s.productColors.hex,
        })
        .from(s.variants)
        .leftJoin(s.phoneModels, eq(s.phoneModels.id, s.variants.phoneModelId))
        .innerJoin(s.productColors, eq(s.productColors.id, s.variants.colorId))
        .where(eq(s.variants.productId, id))
        .orderBy(asc(s.phoneModels.sort), asc(s.productColors.sort)),
    };
  });

  /* ───── product editor: full detail, options, phone availability, duplicate ───── */

  async function editorDetail(id: number) {
    const [p] = await db.select().from(s.products).where(eq(s.products.id, id));
    if (!p) throw notFound("Product");
    const [cat] = await db.select().from(s.categories).where(eq(s.categories.id, p.categoryId));
    const colors = await db.select().from(s.productColors).where(eq(s.productColors.productId, id)).orderBy(asc(s.productColors.sort));
    const vs = await db.select().from(s.variants).where(eq(s.variants.productId, id));
    const models = await db
      .select({ id: s.phoneModels.id, slug: s.phoneModels.slug, priceAdjust: s.phoneModels.priceAdjust })
      .from(s.phoneModels);
    const adjOf = new Map(models.map((m) => [m.id, cat?.slug === "magsafe-cases" ? m.priceAdjust : Math.round(m.priceAdjust / 300) * 100]));
    const options = colors.map((c) => {
      const mine = vs.filter((v) => v.colorId === c.id && v.active);
      // extra price of this option = what its variants cost above the base price for the same phone
      const adds = mine.map((v) => v.price - p.basePrice - (v.phoneModelId ? adjOf.get(v.phoneModelId) ?? 0 : 0));
      const priceAdd = adds.length ? Math.max(0, Math.round(adds.reduce((a, x) => a + x, 0) / adds.length)) : 0;
      const total = mine.reduce((a, v) => a + v.stock, 0);
      // stock = typical stock per phone (editing it sets every phone); stockTotal = everything
      return { id: c.id, name: c.name, hex: c.hex, accentHex: c.accentHex, designUrl: c.designUrl, priceAdd, stock: mine.length ? Math.round(total / mine.length) : 0, stockTotal: total, variants: mine.length };
    });
    const modelIds = new Set(vs.filter((v) => v.active && v.phoneModelId).map((v) => v.phoneModelId!));
    const modelSlugs = models.filter((m) => modelIds.has(m.id)).map((m) => m.slug);
    return { ...p, category: cat?.slug, section: cat?.section, options, modelSlugs };
  }

  app.get("/products/:id", { schema: { tags, security, params: Type.Object({ id: Type.Integer() }) } }, async (req) => ({
    data: await editorDetail((req.params as { id: number }).id),
  }));

  /** create the variants of one option for the given phones (or one universal variant) */
  async function variantsFor(productId: number, colorId: number, price: number, compareAt: number | null, stock: number, modelIds: number[] | null, categorySlug: string) {
    const models = modelIds ? await db.select().from(s.phoneModels).where(sql`${s.phoneModels.id} in (${sql.join(modelIds.map((x) => sql`${x}`), sql`, `)})`) : [];
    const adj = (pa: number) => (categorySlug === "magsafe-cases" ? pa : Math.round(pa / 300) * 100);
    const rows = modelIds
      ? models.map((m) => ({
          productId, phoneModelId: m.id, colorId, sku: `${productId}-${m.slug}-${colorId}`.toUpperCase(),
          price: price + adj(m.priceAdjust), compareAtPrice: compareAt ? compareAt + adj(m.priceAdjust) : null, stock,
        }))
      : [{ productId, phoneModelId: null, colorId, sku: `${productId}-U-${colorId}`, price, compareAtPrice: compareAt, stock }];
    for (let i = 0; i < rows.length; i += 200) {
      const chunk = rows.slice(i, i + 200);
      for (const r of chunk) {
        const cond = and(
          eq(s.variants.productId, r.productId),
          r.phoneModelId !== null ? eq(s.variants.phoneModelId, r.phoneModelId) : isNull(s.variants.phoneModelId),
          eq(s.variants.colorId, r.colorId)
        );
        const [ex] = await db.select({ id: s.variants.id }).from(s.variants).where(cond);
        if (!ex) await db.insert(s.variants).values(r);
      }
    }
  }

  app.post(
    "/products/:id/options",
    {
      schema: {
        tags,
        security,
        summary: "Add an option (colour / length / pack) — variants are created for every phone the product is sold for",
        params: Type.Object({ id: Type.Integer() }),
        body: Type.Object({
          name: Type.String({ minLength: 1, maxLength: 60 }),
          hex: Type.String({ pattern: "^#[0-9a-fA-F]{6}$" }),
          accentHex: Type.Optional(Type.Union([Type.String({ pattern: "^#[0-9a-fA-F]{6}$" }), Type.Null()])),
          priceAdd: Type.Optional(Type.Integer({ minimum: 0 })),
          stock: Type.Optional(Type.Integer({ minimum: 0 })),
          designUrl: Type.Optional(url),
        }),
      },
    },
    async (req, reply) => {
      const { id } = req.params as { id: number };
      const b = req.body as { name: string; hex: string; accentHex?: string | null; priceAdd?: number; stock?: number; designUrl?: string | null };
      const d = await editorDetail(id);
      const [insertRes] = await db
        .insert(s.productColors)
        .values({ productId: id, name: b.name, hex: b.hex, accentHex: b.accentHex ?? null, designUrl: b.designUrl ?? null, sort: d.options.length });
      const [c] = await db.select().from(s.productColors).where(eq(s.productColors.id, insertRes.insertId));
      const universal = d.section === "gadgets";
      const modelIds = universal
        ? null
        : (await db.select({ id: s.phoneModels.id }).from(s.phoneModels).where(sql`${s.phoneModels.slug} in (${sql.join((d.modelSlugs.length ? d.modelSlugs : ["-"]).map((x) => sql`${x}`), sql`, `)})`)).map((m) => m.id);
      const add = b.priceAdd ?? 0;
      await variantsFor(id, c.id, d.basePrice + add, d.compareAtPrice ? d.compareAtPrice + add : null, b.stock ?? 20, modelIds, d.category ?? "");
      await refreshMinPrice(id);
      await catalogChanged(d.slug);
      reply.code(201);
      return { data: c };
    },
  );

  app.patch(
    "/options/:id",
    {
      schema: {
        tags,
        security,
        summary: "Edit an option. priceAdd shifts all its variants; stock sets every variant of it.",
        params: Type.Object({ id: Type.Integer() }),
        body: Type.Object({
          name: Type.Optional(Type.String({ minLength: 1, maxLength: 60 })),
          hex: Type.Optional(Type.String({ pattern: "^#[0-9a-fA-F]{6}$" })),
          accentHex: Type.Optional(Type.Union([Type.String({ pattern: "^#[0-9a-fA-F]{6}$" }), Type.Null()])),
          priceAdd: Type.Optional(Type.Integer({ minimum: 0 })),
          stock: Type.Optional(Type.Integer({ minimum: 0 })),
          sort: Type.Optional(Type.Integer()),
          designUrl: Type.Optional(url),
        }),
      },
    },
    async (req) => {
      const { id } = req.params as { id: number };
      const b = req.body as { name?: string; hex?: string; accentHex?: string | null; priceAdd?: number; stock?: number; sort?: number; designUrl?: string | null };
      const [c] = await db.select().from(s.productColors).where(eq(s.productColors.id, id));
      if (!c) throw notFound("Option");
      const set: Partial<typeof s.productColors.$inferInsert> = {};
      if (b.name !== undefined) set.name = b.name;
      if (b.hex !== undefined) set.hex = b.hex;
      if (b.accentHex !== undefined) set.accentHex = b.accentHex;
      if (b.sort !== undefined) set.sort = b.sort;
      if (b.designUrl !== undefined) set.designUrl = b.designUrl;
      if (Object.keys(set).length) await db.update(s.productColors).set(set).where(eq(s.productColors.id, id));
      if (b.priceAdd !== undefined) {
        const cur = (await editorDetail(c.productId)).options.find((o) => o.id === id)?.priceAdd ?? 0;
        const delta = b.priceAdd - cur;
        if (delta)
          await db
            .update(s.variants)
            .set({ price: sql`${s.variants.price} + ${delta}`, compareAtPrice: sql`case when ${s.variants.compareAtPrice} is null then null else ${s.variants.compareAtPrice} + ${delta} end` })
            .where(eq(s.variants.colorId, id));
      }
      if (b.stock !== undefined) await db.update(s.variants).set({ stock: b.stock }).where(eq(s.variants.colorId, id));
      await refreshMinPrice(c.productId);
      const [p] = await db.select({ slug: s.products.slug }).from(s.products).where(eq(s.products.id, c.productId));
      await catalogChanged(p?.slug);
      return { data: { ok: true } };
    },
  );

  app.delete("/options/:id", { schema: { tags, security, summary: "Remove an option (old orders keep their details)", params: Type.Object({ id: Type.Integer() }) } }, async (req) => {
    const { id } = req.params as { id: number };
    const [c] = await db.select().from(s.productColors).where(eq(s.productColors.id, id));
    if (!c) throw notFound("Option");
    const [{ n }] = await db.select({ n: count() }).from(s.productColors).where(eq(s.productColors.productId, c.productId));
    if (n <= 1) throw badRequest("A product needs at least one option");
    await db.delete(s.productColors).where(eq(s.productColors.id, id)); // variants cascade; order items keep a copy
    await refreshMinPrice(c.productId);
    const [p] = await db.select({ slug: s.products.slug }).from(s.products).where(eq(s.products.id, c.productId));
    await catalogChanged(p?.slug);
    return { data: { ok: true } };
  });

  app.put(
    "/products/:id/models",
    {
      schema: {
        tags,
        security,
        summary: "Choose which phones a product is sold for (creates missing variants, hides the rest)",
        params: Type.Object({ id: Type.Integer() }),
        body: Type.Object({ modelSlugs: Type.Array(Type.String(), { minItems: 1 }), stock: Type.Optional(Type.Integer({ minimum: 0 })) }),
      },
    },
    async (req) => {
      const { id } = req.params as { id: number };
      const { modelSlugs, stock } = req.body as { modelSlugs: string[]; stock?: number };
      const d = await editorDetail(id);
      if (d.section === "gadgets") throw badRequest("Gadgets fit every phone");
      const all = await db.select().from(s.phoneModels);
      const want = new Set(all.filter((m) => modelSlugs.includes(m.slug)).map((m) => m.id));
      const vs = await db.select().from(s.variants).where(eq(s.variants.productId, id));
      for (const v of vs) {
        const on = !!v.phoneModelId && want.has(v.phoneModelId);
        if (on !== v.active) await db.update(s.variants).set({ active: on }).where(eq(s.variants.id, v.id));
      }
      const have = new Set(vs.map((v) => `${v.phoneModelId}:${v.colorId}`));
      for (const o of d.options) {
        const missing = [...want].filter((mid) => !have.has(`${mid}:${o.id}`));
        if (missing.length) await variantsFor(id, o.id, d.basePrice + o.priceAdd, d.compareAtPrice ? d.compareAtPrice + o.priceAdd : null, stock ?? 20, missing, d.category ?? "");
      }
      await refreshMinPrice(id);
      await catalogChanged(d.slug);
      return { data: { ok: true, phones: want.size } };
    },
  );

  app.post("/products/:id/duplicate", { schema: { tags, security, summary: "Copy a product (hidden until you switch it on)", params: Type.Object({ id: Type.Integer() }) } }, async (req, reply) => {
    const { id } = req.params as { id: number };
    const [p] = await db.select().from(s.products).where(eq(s.products.id, id));
    if (!p) throw notFound("Product");
    const { id: _old, slug, createdAt, updatedAt, soldCount, ratingAvg, ratingCount, ...rest } = p;
    const copy = await db.transaction(async (tx) => {
      const [insertNp] = await tx.insert(s.products).values({ ...rest, slug: `${slug}-copy-${Date.now().toString(36)}`, name: `${p.name} (copy)`, active: false, featured: false });
      const [np] = await tx.select().from(s.products).where(eq(s.products.id, insertNp.insertId));
      const colors = await tx.select().from(s.productColors).where(eq(s.productColors.productId, id));
      const vs = await tx.select().from(s.variants).where(eq(s.variants.productId, id));
      for (const c of colors) {
        const [insertNc] = await tx.insert(s.productColors).values({ productId: np.id, name: c.name, hex: c.hex, accentHex: c.accentHex, designUrl: c.designUrl, sort: c.sort });
        const [nc] = await tx.select().from(s.productColors).where(eq(s.productColors.id, insertNc.insertId));
        const rows = vs
          .filter((v) => v.colorId === c.id)
          .map((v) => ({ productId: np.id, phoneModelId: v.phoneModelId, colorId: nc.id, sku: v.sku.replace(/^\d+-/, `${np.id}-`).replace(/-\d+$/, `-${nc.id}`), price: v.price, compareAtPrice: v.compareAtPrice, stock: v.stock, active: v.active }));
        for (let i = 0; i < rows.length; i += 200) await tx.insert(s.variants).values(rows.slice(i, i + 200));
      }
      return np;
    });
    await catalogChanged();
    reply.code(201);
    return { data: copy };
  });

  app.patch(
    "/variants/:id",
    {
      schema: {
        tags,
        security,
        params: Type.Object({ id: Type.Integer() }),
        body: Type.Object({
          price: Type.Optional(Type.Integer({ minimum: 1 })),
          compareAtPrice: Type.Optional(Type.Union([Type.Integer(), Type.Null()])),
          stock: Type.Optional(Type.Integer({ minimum: 0 })),
          active: Type.Optional(Type.Boolean()),
        }),
      },
    },
    async (req) => {
      const { id } = req.params as { id: number };
      await db.update(s.variants).set(req.body as object).where(eq(s.variants.id, id));
      const [v] = await db.select().from(s.variants).where(eq(s.variants.id, id));
      if (!v) throw notFound("Variant");
      await refreshMinPrice(v.productId);
      const [p] = await db.select({ slug: s.products.slug }).from(s.products).where(eq(s.products.id, v.productId));
      await catalogChanged(p?.slug);
      return { data: v };
    },
  );

  /* ───── phone models: add a new phone in seconds (no images needed) ───── */
  app.post(
    "/phone-models",
    {
      schema: {
        tags,
        security,
        summary: "Add a phone model. Pass addToAllProducts=true to create variants for every product.",
        body: Type.Object({
          brandSlug: Type.String(),
          name: Type.String(),
          year: Type.Integer(),
          heightMm: Type.Number(),
          widthMm: Type.Number(),
          depthMm: Type.Number(),
          cornerRadiusMm: Type.Number(),
          camera: Type.Any({ description: "CameraSpec JSON — copy a similar phone and adjust" }),
          details: Type.Optional(Type.Any({ description: "PhoneDetails JSON (buttons, ports) — omit to use the brand defaults" })),
          bodyHex: Type.Optional(Type.String()),
          aliases: Type.Optional(Type.String()),
          priceAdjust: Type.Optional(Type.Integer()),
          popular: Type.Optional(Type.Boolean()),
          isHero: Type.Optional(Type.Boolean()),
          model3dUrl: Type.Optional(Type.Union([Type.String(), Type.Null()])),
          addToAllProducts: Type.Optional(Type.Boolean()),
          stock: Type.Optional(Type.Integer({ minimum: 0, default: 20 })),
        }),
      },
    },
    async (req, reply) => {
      const b = req.body as {
        brandSlug: string; name: string; year: number; heightMm: number; widthMm: number; depthMm: number; cornerRadiusMm: number;
        camera: unknown; details?: unknown; bodyHex?: string; aliases?: string; priceAdjust?: number; popular?: boolean;
        isHero?: boolean; model3dUrl?: string | null; addToAllProducts?: boolean; stock?: number;
      };
      const [brand] = await db.select().from(s.brands).where(eq(s.brands.slug, b.brandSlug));
      if (!brand) throw notFound("Brand");
      if (b.isHero) {
        await db.update(s.phoneModels).set({ isHero: false });
      }
      const [insertM] = await db
        .insert(s.phoneModels)
        .values({
          brandId: brand.id, slug: slugify(b.name), name: b.name, year: b.year, aliases: b.aliases ?? "",
          searchText: phoneSearchText(b.name, brand.name, b.aliases ?? ""), heightMm: b.heightMm, widthMm: b.widthMm, depthMm: b.depthMm,
          cornerRadiusMm: b.cornerRadiusMm, camera: b.camera, details: b.details ?? {}, bodyHex: b.bodyHex ?? "#8a8d91", priceAdjust: b.priceAdjust ?? 0,
          popular: b.popular ?? false, isHero: b.isHero ?? false, model3dUrl: b.model3dUrl ?? null, sort: -b.year,
        });
      const [m] = await db.select().from(s.phoneModels).where(eq(s.phoneModels.id, insertM.insertId));
      if (b.addToAllProducts) {
        // gadgets are universal — only phone-fitted products get variants for the new model
        const prods = (
          await db.select({ p: s.products }).from(s.products).innerJoin(s.categories, eq(s.categories.id, s.products.categoryId)).where(ne(s.categories.section, "gadgets"))
        ).map((r) => r.p);
        for (const p of prods) {
          const colors = await db.select().from(s.productColors).where(eq(s.productColors.productId, p.id));
          if (colors.length)
            await db.insert(s.variants).values(
              colors.map((c) => ({
                productId: p.id, phoneModelId: m.id, colorId: c.id, sku: `${p.id}-${m.slug}-${c.id}`.toUpperCase(),
                price: p.basePrice + m.priceAdjust, compareAtPrice: p.compareAtPrice ? p.compareAtPrice + m.priceAdjust : null, stock: b.stock ?? 20,
              })),
            );
        }
      }
      await catalogChanged();
      reply.code(201);
      return { data: m };
    },
  );

  app.get("/phone-models", { schema: { tags, security } }, async () => ({
    data: await db
      .select({
        id: s.phoneModels.id, slug: s.phoneModels.slug, name: s.phoneModels.name, year: s.phoneModels.year, brand: s.brands.name,
        aliases: s.phoneModels.aliases, priceAdjust: s.phoneModels.priceAdjust, popular: s.phoneModels.popular,
        isHero: s.phoneModels.isHero, model3dUrl: s.phoneModels.model3dUrl, active: s.phoneModels.active,
        heightMm: s.phoneModels.heightMm, widthMm: s.phoneModels.widthMm, depthMm: s.phoneModels.depthMm,
        cornerRadiusMm: s.phoneModels.cornerRadiusMm, camera: s.phoneModels.camera, bodyHex: s.phoneModels.bodyHex,
      })
      .from(s.phoneModels)
      .innerJoin(s.brands, eq(s.brands.id, s.phoneModels.brandId))
      .orderBy(desc(s.phoneModels.isHero), asc(s.brands.sort), asc(s.phoneModels.sort)),
  }));

  app.patch(
    "/phone-models/:id",
    {
      schema: {
        tags,
        security,
        params: Type.Object({ id: Type.Integer() }),
        body: Type.Object({
          name: Type.Optional(Type.String()),
          year: Type.Optional(Type.Integer()),
          heightMm: Type.Optional(Type.Number()),
          widthMm: Type.Optional(Type.Number()),
          depthMm: Type.Optional(Type.Number()),
          cornerRadiusMm: Type.Optional(Type.Number()),
          active: Type.Optional(Type.Boolean()),
          popular: Type.Optional(Type.Boolean()),
          isHero: Type.Optional(Type.Boolean()),
          model3dUrl: Type.Optional(Type.Union([Type.String(), Type.Null()])),
          priceAdjust: Type.Optional(Type.Integer()),
          aliases: Type.Optional(Type.String({ maxLength: 200 })),
          camera: Type.Optional(Type.Any({ description: "fine-tune the 3D camera layout" })),
          details: Type.Optional(Type.Any({ description: "fine-tune buttons & ports (PhoneDetails)" })),
          bodyHex: Type.Optional(Type.String({ pattern: "^#[0-9a-fA-F]{6}$" })),
        }),
      },
    },
    async (req) => {
      const { id } = req.params as { id: number };
      const b = req.body as {
        name?: string; year?: number; heightMm?: number; widthMm?: number; depthMm?: number; cornerRadiusMm?: number;
        active?: boolean; popular?: boolean; isHero?: boolean; model3dUrl?: string | null;
        priceAdjust?: number; aliases?: string; camera?: unknown; details?: unknown; bodyHex?: string;
      };
      const [m] = await db.select().from(s.phoneModels).innerJoin(s.brands, eq(s.brands.id, s.phoneModels.brandId)).where(eq(s.phoneModels.id, id));
      if (!m) throw notFound("Phone model");
      if (b.isHero) {
        await db.update(s.phoneModels).set({ isHero: false }).where(ne(s.phoneModels.id, id));
      }
      const set: Partial<typeof s.phoneModels.$inferInsert> = { ...b };
      if (b.name !== undefined) set.slug = slugify(b.name);
      if (b.aliases !== undefined || b.name !== undefined) {
        set.searchText = phoneSearchText(b.name ?? m.phone_models.name, m.brands.name, b.aliases ?? m.phone_models.aliases);
      }
      await db.update(s.phoneModels).set(set).where(eq(s.phoneModels.id, id));
      const [row] = await db.select().from(s.phoneModels).where(eq(s.phoneModels.id, id));
      await catalogChanged();
      return { data: row };
    },
  );

  /* 1-click set flagship hero model for the whole storefront */
  app.post(
    "/phone-models/:id/set-hero",
    { schema: { tags, security, params: Type.Object({ id: Type.Integer() }) } },
    async (req) => {
      const { id } = req.params as { id: number };
      const [m] = await db.select().from(s.phoneModels).where(eq(s.phoneModels.id, id));
      if (!m) throw notFound("Phone model");
      await db.update(s.phoneModels).set({ isHero: false });
      await db.update(s.phoneModels).set({ isHero: true }).where(eq(s.phoneModels.id, id));
      const [updated] = await db.select().from(s.phoneModels).where(eq(s.phoneModels.id, id));
      await catalogChanged();
      return { data: updated };
    },
  );

  /* delete a phone model and its associated variants */
  app.delete(
    "/phone-models/:id",
    { schema: { tags, security, params: Type.Object({ id: Type.Integer() }) } },
    async (req) => {
      const { id } = req.params as { id: number };
      const [deleted] = await db.select().from(s.phoneModels).where(eq(s.phoneModels.id, id));
      if (!deleted) throw notFound("Phone model");
      await db.delete(s.variants).where(eq(s.variants.phoneModelId, id));
      await db.delete(s.phoneModels).where(eq(s.phoneModels.id, id));
      await catalogChanged();
      return { data: { ok: true, deleted } };
    },
  );

  app.patch(
    "/coupons/:code",
    { schema: { tags, security, params: Type.Object({ code: Type.String() }), body: Type.Object({ active: Type.Optional(Type.Boolean()), usageLimit: Type.Optional(Type.Union([Type.Integer(), Type.Null()])) }) } },
    async (req) => {
      const { code } = req.params as { code: string };
      await db.update(s.coupons).set(req.body as object).where(eq(s.coupons.code, code));
      const [c] = await db.select().from(s.coupons).where(eq(s.coupons.code, code));
      if (!c) throw notFound("Coupon");
      return { data: c };
    },
  );

  /* ───── reviews moderation ───── */
  app.get(
    "/reviews",
    { schema: { tags, security, querystring: Type.Object({ approved: Type.Optional(Type.Boolean()) }) } },
    async (req) => {
      const { approved } = req.query as { approved?: boolean };
      return {
        data: await db
          .select({
            id: s.reviews.id, product: s.products.name, productSlug: s.products.slug, name: s.reviews.name, rating: s.reviews.rating, title: s.reviews.title, body: s.reviews.body,
            approved: s.reviews.approved, verified: s.reviews.verified, photos: s.reviews.photos, adminReply: s.reviews.adminReply, orderNumber: s.orders.number, createdAt: s.reviews.createdAt,
          })
          .from(s.reviews)
          .innerJoin(s.products, eq(s.products.id, s.reviews.productId))
          .leftJoin(s.orders, eq(s.orders.id, s.reviews.orderId))
          .where(approved === undefined ? undefined : eq(s.reviews.approved, approved))
          .orderBy(desc(s.reviews.createdAt))
          .limit(100),
      };
    },
  );

  app.patch(
    "/reviews/:id",
    {
      schema: {
        tags, security, params: Type.Object({ id: Type.Integer() }),
        body: Type.Object({ approved: Type.Optional(Type.Boolean()), adminReply: Type.Optional(Type.Union([Type.String({ maxLength: 800 }), Type.Null()])) }),
      },
    },
    async (req) => {
      const { id } = req.params as { id: number };
      const b = req.body as { approved?: boolean; adminReply?: string | null };
      const set: Partial<typeof s.reviews.$inferInsert> = {};
      if (b.approved !== undefined) set.approved = b.approved;
      if (b.adminReply !== undefined) set.adminReply = b.adminReply?.trim() || null;
      if (!Object.keys(set).length) throw badRequest("Nothing to change");
      await db.update(s.reviews).set(set).where(eq(s.reviews.id, id));
      const [r] = await db.select().from(s.reviews).where(eq(s.reviews.id, id));
      if (!r) throw notFound("Review");
      await refreshRating(r.productId);
      await catalogChanged();
      return { data: r };
    },
  );

  app.delete("/reviews/:id", { schema: { tags, security, params: Type.Object({ id: Type.Integer() }) } }, async (req) => {
    const { id } = req.params as { id: number };
    const [r] = await db.select().from(s.reviews).where(eq(s.reviews.id, id));
    if (r) {
      await db.delete(s.reviews).where(eq(s.reviews.id, id));
      await refreshRating(r.productId);
    }
    return { data: { ok: true } };
  });

  /* ───── coupons ───── */
  app.get("/coupons", { schema: { tags, security } }, async () => ({ data: await db.select().from(s.coupons) }));

  app.post(
    "/coupons",
    {
      schema: {
        tags,
        security,
        body: Type.Object({
          code: Type.String({ minLength: 3, maxLength: 30 }),
          type: Type.Union([Type.Literal("percent"), Type.Literal("fixed"), Type.Literal("free_shipping")]),
          value: Type.Integer({ minimum: 0 }),
          minSubtotal: Type.Optional(Type.Integer({ minimum: 0 })),
          maxDiscount: Type.Optional(Type.Integer({ minimum: 0 })),
          usageLimit: Type.Optional(Type.Integer({ minimum: 1 })),
          expiresAt: Type.Optional(Type.String({ format: "date-time" })),
          active: Type.Optional(Type.Boolean()),
        }),
      },
    },
    async (req, reply) => {
      const b = req.body as { code: string; expiresAt?: string } & Omit<typeof s.coupons.$inferInsert, "code" | "expiresAt">;
      const upperCode = b.code.toUpperCase();
      const values = { ...b, code: upperCode, expiresAt: b.expiresAt ? new Date(b.expiresAt) : null };
      const [existing] = await db.select().from(s.coupons).where(eq(s.coupons.code, upperCode));
      if (existing) {
        await db.update(s.coupons).set(values).where(eq(s.coupons.code, upperCode));
      } else {
        await db.insert(s.coupons).values(values);
      }
      const [c] = await db.select().from(s.coupons).where(eq(s.coupons.code, upperCode));
      reply.code(201);
      return { data: c };
    },
  );

  /* ───── blue team cyber security monitoring ───── */
  app.get("/security/stats", { schema: { tags, security, summary: "Blue Team Security Stats & Blocked Attacks" } }, async () => {
    return { data: threatProtection.getStats() };
  });

  app.post(
    "/security/unban",
    {
      schema: {
        tags,
        security,
        summary: "Unban an IP address",
        body: Type.Object({ ip: Type.String() }),
      },
    },
    async (req) => {
      const { ip } = req.body as { ip: string };
      threatProtection.unbanIp(ip);
      return { data: { ok: true, ip } };
    },
  );

  /* ───── product delete ───── */
  app.delete("/products/:id", { schema: { tags, security, params: Type.Object({ id: Type.Integer() }) } }, async (req) => {
    const { id } = req.params as { id: number };
    const [p] = await db.select().from(s.products).where(eq(s.products.id, id));
    if (!p) throw notFound("Product");
    await db.delete(s.variants).where(eq(s.variants.productId, id));
    await db.delete(s.productColors).where(eq(s.productColors.productId, id));
    await db.delete(s.products).where(eq(s.products.id, id));
    await catalogChanged(p.slug);
    return { data: { ok: true, deleted: p } };
  });

  /* ───── product brands / companies (Casetify, dbrand, Ronin, Spigen, etc.) ───── */
  app.get("/product-brands", { schema: { tags, security } }, async () => {
    return { data: await db.select().from(s.productBrands).orderBy(asc(s.productBrands.sort), asc(s.productBrands.name)) };
  });

  app.post(
    "/product-brands",
    {
      schema: {
        tags,
        security,
        body: Type.Object({
          name: Type.String({ minLength: 2, maxLength: 80 }),
          slug: Type.Optional(Type.String({ maxLength: 80 })),
          description: Type.Optional(Type.String({ maxLength: 500 })),
          website: Type.Optional(Type.String()),
          sort: Type.Optional(Type.Integer()),
          active: Type.Optional(Type.Boolean()),
        }),
      },
    },
    async (req, reply) => {
      const b = req.body as { name: string; slug?: string; description?: string; website?: string; sort?: number; active?: boolean };
      const slug = b.slug ? slugify(b.slug) : slugify(b.name);
      const [insertBrand] = await db
        .insert(s.productBrands)
        .values({
          name: b.name,
          slug,
          description: b.description ?? "",
          website: b.website ?? null,
          sort: b.sort ?? 0,
          active: b.active ?? true,
        });
      const [brand] = await db.select().from(s.productBrands).where(eq(s.productBrands.id, insertBrand.insertId));
      reply.code(201);
      return { data: brand };
    },
  );

  app.patch(
    "/product-brands/:id",
    {
      schema: {
        tags,
        security,
        params: Type.Object({ id: Type.Integer() }),
        body: Type.Object({
          name: Type.Optional(Type.String()),
          description: Type.Optional(Type.String()),
          website: Type.Optional(Type.Union([Type.String(), Type.Null()])),
          sort: Type.Optional(Type.Integer()),
          active: Type.Optional(Type.Boolean()),
        }),
      },
    },
    async (req) => {
      const { id } = req.params as { id: number };
      await db.update(s.productBrands).set(req.body as any).where(eq(s.productBrands.id, id));
      const [brand] = await db.select().from(s.productBrands).where(eq(s.productBrands.id, id));
      if (!brand) throw notFound("Brand");
      return { data: brand };
    },
  );

  app.delete("/product-brands/:id", { schema: { tags, security, params: Type.Object({ id: Type.Integer() }) } }, async (req) => {
    const { id } = req.params as { id: number };
    const [brand] = await db.select().from(s.productBrands).where(eq(s.productBrands.id, id));
    if (!brand) throw notFound("Brand");
    await db.delete(s.productBrands).where(eq(s.productBrands.id, id));
    return { data: { ok: true, deleted: brand } };
  });

  /* ───── categories management ───── */
  app.get("/categories", { schema: { tags, security } }, async () => {
    return { data: await db.select().from(s.categories).orderBy(asc(s.categories.sort), asc(s.categories.id)) };
  });

  app.post(
    "/categories",
    {
      schema: {
        tags,
        security,
        body: Type.Object({
          name: Type.String({ minLength: 2, maxLength: 80 }),
          slug: Type.Optional(Type.String({ maxLength: 80 })),
          description: Type.Optional(Type.String({ maxLength: 500 })),
          section: Type.String({ description: "magsafe-cases | skins | screen-protectors | gadgets" }),
          sort: Type.Optional(Type.Integer()),
        }),
      },
    },
    async (req, reply) => {
      const b = req.body as { name: string; slug?: string; description?: string; section: string; sort?: number };
      const slug = b.slug ? slugify(b.slug) : slugify(b.name);
      const [insertCat] = await db
        .insert(s.categories)
        .values({
          name: b.name,
          slug,
          description: b.description ?? "",
          section: b.section,
          sort: b.sort ?? 0,
        });
      const [cat] = await db.select().from(s.categories).where(eq(s.categories.id, insertCat.insertId));
      await catalogChanged();
      reply.code(201);
      return { data: cat };
    },
  );

  app.patch(
    "/categories/:id",
    {
      schema: {
        tags,
        security,
        params: Type.Object({ id: Type.Integer() }),
        body: Type.Object({
          name: Type.Optional(Type.String()),
          description: Type.Optional(Type.String()),
          section: Type.Optional(Type.String()),
          sort: Type.Optional(Type.Integer()),
        }),
      },
    },
    async (req) => {
      const { id } = req.params as { id: number };
      await db.update(s.categories).set(req.body as any).where(eq(s.categories.id, id));
      const [cat] = await db.select().from(s.categories).where(eq(s.categories.id, id));
      if (!cat) throw notFound("Category");
      await catalogChanged();
      return { data: cat };
    },
  );

  app.delete("/categories/:id", { schema: { tags, security, params: Type.Object({ id: Type.Integer() }) } }, async (req) => {
    const { id } = req.params as { id: number };
    const [cat] = await db.select().from(s.categories).where(eq(s.categories.id, id));
    if (!cat) throw notFound("Category");
    await db.delete(s.categories).where(eq(s.categories.id, id));
    await catalogChanged();
    return { data: { ok: true, deleted: cat } };
  });

  /* ───── custom styles & materials ───── */
  app.get("/custom-styles", { schema: { tags, security } }, async () => {
    return { data: await db.select().from(s.customStyles).orderBy(asc(s.customStyles.sort), asc(s.customStyles.id)) };
  });

  app.post(
    "/custom-styles",
    {
      schema: {
        tags,
        security,
        body: Type.Object({
          name: Type.String({ minLength: 2, maxLength: 80 }),
          slug: Type.Optional(Type.String({ maxLength: 80 })),
          section: Type.String(),
          hint: Type.Optional(Type.String({ maxLength: 200 })),
          color: Type.Optional(Type.String()),
          accent: Type.Optional(Type.Union([Type.String(), Type.Null()])),
          sort: Type.Optional(Type.Integer()),
          active: Type.Optional(Type.Boolean()),
        }),
      },
    },
    async (req, reply) => {
      const b = req.body as { name: string; slug?: string; section: string; hint?: string; color?: string; accent?: string; sort?: number; active?: boolean };
      const slug = b.slug ? slugify(b.slug) : slugify(b.name);
      const [insertStyle] = await db
        .insert(s.customStyles)
        .values({
          name: b.name,
          slug,
          section: b.section,
          hint: b.hint ?? "",
          color: b.color ?? "#1f2024",
          accent: b.accent ?? null,
          sort: b.sort ?? 0,
          active: b.active ?? true,
        });
      const [style] = await db.select().from(s.customStyles).where(eq(s.customStyles.id, insertStyle.insertId));
      await catalogChanged();
      reply.code(201);
      return { data: style };
    },
  );

  app.patch(
    "/custom-styles/:id",
    {
      schema: {
        tags,
        security,
        params: Type.Object({ id: Type.Integer() }),
        body: Type.Object({
          name: Type.Optional(Type.String()),
          hint: Type.Optional(Type.String()),
          color: Type.Optional(Type.String()),
          accent: Type.Optional(Type.Union([Type.String(), Type.Null()])),
          sort: Type.Optional(Type.Integer()),
          active: Type.Optional(Type.Boolean()),
        }),
      },
    },
    async (req) => {
      const { id } = req.params as { id: number };
      await db.update(s.customStyles).set(req.body as any).where(eq(s.customStyles.id, id));
      const [style] = await db.select().from(s.customStyles).where(eq(s.customStyles.id, id));
      if (!style) throw notFound("Style");
      await catalogChanged();
      return { data: style };
    },
  );

  app.delete("/custom-styles/:id", { schema: { tags, security, params: Type.Object({ id: Type.Integer() }) } }, async (req) => {
    const { id } = req.params as { id: number };
    const [style] = await db.select().from(s.customStyles).where(eq(s.customStyles.id, id));
    if (!style) throw notFound("Style");
    await db.delete(s.customStyles).where(eq(s.customStyles.id, id));
    await catalogChanged();
    return { data: { ok: true, deleted: style } };
  });

  /* ───── trust signals & social proof popups ───── */
  app.get("/trust-signals", { schema: { tags, security } }, async () => {
    return { data: await db.select().from(s.trustSignals).orderBy(asc(s.trustSignals.sort), desc(s.trustSignals.id)) };
  });

  app.post(
    "/trust-signals",
    {
      schema: {
        tags,
        security,
        body: Type.Object({
          city: Type.String(),
          productName: Type.String(),
          productSlug: Type.String(),
          material: Type.Optional(Type.String()),
          colorHex: Type.Optional(Type.String()),
          modelName: Type.Optional(Type.Union([Type.String(), Type.Null()])),
          timeAgoText: Type.Optional(Type.String()),
          sort: Type.Optional(Type.Integer()),
          active: Type.Optional(Type.Boolean()),
        }),
      },
    },
    async (req, reply) => {
      const b = req.body as any;
      const [insertSig] = await db.insert(s.trustSignals).values(b);
      const [signal] = await db.select().from(s.trustSignals).where(eq(s.trustSignals.id, insertSig.insertId));
      invalidate("social-proof");
      reply.code(201);
      return { data: signal };
    },
  );

  app.patch(
    "/trust-signals/:id",
    {
      schema: {
        tags,
        security,
        params: Type.Object({ id: Type.Integer() }),
        body: Type.Object({
          city: Type.Optional(Type.String()),
          productName: Type.Optional(Type.String()),
          productSlug: Type.Optional(Type.String()),
          material: Type.Optional(Type.String()),
          colorHex: Type.Optional(Type.String()),
          modelName: Type.Optional(Type.Union([Type.String(), Type.Null()])),
          timeAgoText: Type.Optional(Type.String()),
          sort: Type.Optional(Type.Integer()),
          active: Type.Optional(Type.Boolean()),
        }),
      },
    },
    async (req) => {
      const { id } = req.params as { id: number };
      await db.update(s.trustSignals).set(req.body as any).where(eq(s.trustSignals.id, id));
      const [signal] = await db.select().from(s.trustSignals).where(eq(s.trustSignals.id, id));
      if (!signal) throw notFound("Trust signal");
      invalidate("social-proof");
      return { data: signal };
    },
  );

  app.delete("/trust-signals/:id", { schema: { tags, security, params: Type.Object({ id: Type.Integer() }) } }, async (req) => {
    const { id } = req.params as { id: number };
    const [signal] = await db.select().from(s.trustSignals).where(eq(s.trustSignals.id, id));
    if (!signal) throw notFound("Trust signal");
    await db.delete(s.trustSignals).where(eq(s.trustSignals.id, id));
    invalidate("social-proof");
    return { data: { ok: true, deleted: signal } };
  });

  app.get("/trust-settings", { schema: { tags, security } }, async () => {
    const [row] = await db.select().from(s.trustSettings).where(eq(s.trustSettings.key, "general"));
    const val = (row?.value as any) ?? { enabled: true, mode: "hybrid", initialDelaySec: 6, intervalSec: 28, durationSec: 6 };
    return { data: val };
  });

  app.post(
    "/trust-settings",
    {
      schema: {
        tags,
        security,
        body: Type.Object({
          enabled: Type.Boolean(),
          mode: Type.Union([Type.Literal("auto"), Type.Literal("custom"), Type.Literal("hybrid")]),
          initialDelaySec: Type.Integer({ minimum: 1, maximum: 120 }),
          intervalSec: Type.Integer({ minimum: 5, maximum: 300 }),
          durationSec: Type.Integer({ minimum: 2, maximum: 30 }),
        }),
      },
    },
    async (req) => {
      const val = req.body;
      const [existingSetting] = await db.select().from(s.trustSettings).where(eq(s.trustSettings.key, "general"));
      if (existingSetting) {
        await db.update(s.trustSettings).set({ value: val }).where(eq(s.trustSettings.id, existingSetting.id));
      } else {
        await db.insert(s.trustSettings).values({ key: "general", value: val });
      }
      invalidate("social-proof");
      return { data: val };
    },
  );

  /* COD settings (tiered handling fee) */
  app.get("/cod-settings", { schema: { tags, security } }, async () => {
    const settings = await getCodSettings();
    return { data: settings };
  });

  app.post(
    "/cod-settings",
    {
      schema: {
        tags,
        security,
        body: Type.Object({
          enabled: Type.Boolean(),
          threshold: Type.Integer({ minimum: 0 }),
          feeBelow: Type.Integer({ minimum: 0 }),
          feeAbove: Type.Integer({ minimum: 0 }),
        }),
      },
    },
    async (req) => {
      const { enabled, threshold, feeBelow, feeAbove } = req.body as {
        enabled: boolean;
        threshold: number;
        feeBelow: number;
        feeAbove: number;
      };
      const [existing] = await db.select().from(s.codSettings).where(eq(s.codSettings.id, 1));
      if (existing) {
        await db
          .update(s.codSettings)
          .set({ enabled, threshold, feeBelow, feeAbove })
          .where(eq(s.codSettings.id, 1));
      } else {
        await db
          .insert(s.codSettings)
          .values({ id: 1, enabled, threshold, feeBelow, feeAbove });
      }
      invalidate("store");
      return { data: { id: 1, enabled, threshold, feeBelow, feeAbove } };
    },
  );

  /* Lead capture popup & floating pill settings */
  app.get("/lead-capture-settings", { schema: { tags, security } }, async () => {
    const settings = await getLeadCaptureSettings();
    return { data: settings };
  });

  app.post(
    "/lead-capture-settings",
    {
      schema: {
        tags,
        security,
        body: Type.Object({
          enabled: Type.Boolean(),
          showFloatingPill: Type.Boolean(),
          badgeText: Type.String(),
          heading: Type.String(),
          subheading: Type.String(),
          couponCode: Type.String(),
          discountAmount: Type.Integer({ minimum: 0 }),
          delaySeconds: Type.Integer({ minimum: 0 }),
        }),
      },
    },
    async (req) => {
      const body = req.body as {
        enabled: boolean;
        showFloatingPill: boolean;
        badgeText: string;
        heading: string;
        subheading: string;
        couponCode: string;
        discountAmount: number;
        delaySeconds: number;
      };
      await getLeadCaptureSettings();
      const [existing] = await db.select().from(s.leadCaptureSettings).where(eq(s.leadCaptureSettings.id, 1));
      if (existing) {
        await db
          .update(s.leadCaptureSettings)
          .set(body)
          .where(eq(s.leadCaptureSettings.id, 1));
      } else {
        await db
          .insert(s.leadCaptureSettings)
          .values({ id: 1, ...body });
      }
      invalidate("store");
      invalidate("lead_capture");
      return { data: { id: 1, ...body } };
    },
  );
}
