import type { FastifyInstance } from "fastify";
import { Type } from "typebox";
import { count, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { db } from "../db/client";
import * as s from "../db/schema";
import { badRequest, notFound, unauthorized } from "../lib/errors";
import { optionalAuth, requireAuth } from "../lib/auth";
import { RETURN_STATUSES } from "../lib/types";
import { invalidate } from "../lib/cache";
import { RETURN_LABEL, loadOrder, normalizePkPhone, returnWindow } from "./orders";

export const RETURN_REASONS = [
  "Ordered the wrong phone model",
  "Doesn't fit properly",
  "Colour looks different",
  "Damaged or defective",
  "Magnets are weak",
  "Received the wrong item",
  "Changed my mind",
  "Other",
];

async function loadReturn(where: SQL) {
  const [r] = await db.select().from(s.returnRequests).where(where);
  if (!r) return null;
  const [order] = await db.select().from(s.orders).where(eq(s.orders.id, r.orderId));
  const [events, items] = await Promise.all([
    db.select().from(s.returnEvents).where(eq(s.returnEvents.returnId, r.id)).orderBy(s.returnEvents.createdAt),
    db.select().from(s.orderItems).where(eq(s.orderItems.orderId, r.orderId)),
  ]);
  return { r, order, events, items };
}

function presentReturn(full: NonNullable<Awaited<ReturnType<typeof loadReturn>>>, admin = false) {
  const { r, order, events, items } = full;
  return {
    number: r.number,
    orderNumber: order.number,
    status: r.status,
    statusLabel: RETURN_LABEL[r.status] ?? r.status,
    resolution: r.resolution,
    reason: r.reason,
    details: r.details,
    exchangeNote: r.exchangeNote,
    refundAmount: r.refundAmount,
    refundMethod: r.refundMethod,
    adminNote: r.adminNote,
    items: r.items.map((ri) => {
      const it = items.find((i) => i.id === ri.orderItemId);
      return { orderItemId: ri.orderItemId, qty: ri.qty, productName: it?.productName, modelName: it?.modelName, colorName: it?.colorName, colorHex: it?.colorHex, unitPrice: it?.unitPrice };
    }),
    timeline: events.map((e) => ({ status: e.status, label: RETURN_LABEL[e.status] ?? e.status, note: e.note, at: e.createdAt })),
    customer: admin ? { name: order.customerName, phone: order.customerPhone, city: order.city, address: order.line1 } : undefined,
    createdAt: r.createdAt,
  };
}

export async function returnRoutes(app: FastifyInstance) {
  app.get("/returns/reasons", { schema: { tags: ["Returns"] } }, async () => ({ data: RETURN_REASONS }));

  /* customer: request a return / exchange for a delivered order */
  app.post(
    "/orders/:number/returns",
    {
      preHandler: optionalAuth,
      config: { rateLimit: { max: 10, timeWindow: "10 minutes" } },
      schema: {
        tags: ["Returns"],
        summary: "Request a return or exchange (delivered orders, within the return window)",
        params: Type.Object({ number: Type.String() }),
        body: Type.Object({
          token: Type.Optional(Type.String()),
          phone: Type.Optional(Type.String({ description: "alternative to token: the mobile number used on the order" })),
          customerPhone: Type.Optional(Type.String()),
          resolution: Type.Union([Type.Literal("refund"), Type.Literal("exchange")]),
          reason: Type.String({ minLength: 3, maxLength: 100 }),
          details: Type.Optional(Type.String({ maxLength: 1000 })),
          exchangeNote: Type.Optional(Type.String({ maxLength: 200 })),
          refundMethod: Type.Optional(Type.String({ maxLength: 120 })),
          items: Type.Array(Type.Object({ orderItemId: Type.Integer(), qty: Type.Integer({ minimum: 1 }) }), { minItems: 1 }),
        }),
      },
    },
    async (req, reply) => {
      const { number } = req.params as { number: string };
      const b = req.body as {
        token?: string; phone?: string; customerPhone?: string; resolution: string; reason: string; details?: string; exchangeNote?: string; refundMethod?: string;
        items: { orderItemId: number; qty: number }[];
      };
      const full = await loadOrder(eq(s.orders.number, number.toUpperCase()));
      if (!full) throw notFound("Order");
      const clientPhone = b.phone || b.customerPhone;
      const ok =
        (b.token && b.token === full.order.accessToken) ||
        (req.user && req.user.id === full.order.userId) ||
        (clientPhone && normalizePkPhone(clientPhone) === full.order.customerPhone);
      if (!ok) throw unauthorized();
      const w = returnWindow(full);
      if (!w.canReturn) throw badRequest(full.order.status !== "delivered" ? "Returns open once the order is delivered" : "The return window for this order has closed or a return is already open", "not_returnable");
      let refund = 0;
      for (const it of b.items) {
        const oi = full.items.find((i) => i.id === it.orderItemId);
        if (!oi || it.qty > oi.qty) throw badRequest("Invalid item selection");
        refund += oi.unitPrice * it.qty;
      }
      const [insertRes] = await db
        .insert(s.returnRequests)
        .values({
          number: `TMP-${Date.now()}`,
          orderId: full.order.id,
          userId: req.user?.id ?? full.order.userId,
          resolution: b.resolution,
          reason: b.reason,
          details: b.details ?? null,
          exchangeNote: b.exchangeNote ?? null,
          refundMethod: b.refundMethod ?? null,
          items: b.items,
          refundAmount: b.resolution === "refund" ? refund : 0,
        });
      const returnId = insertRes.insertId;
      const num = `RT${10000 + returnId}`;
      await db.update(s.returnRequests).set({ number: num }).where(eq(s.returnRequests.id, returnId));
      await db.insert(s.returnEvents).values({ returnId, status: "requested", note: b.reason });
      reply.code(201);
      return { data: presentReturn((await loadReturn(eq(s.returnRequests.id, returnId)))!) };
    },
  );

  app.get("/me/returns", { preHandler: requireAuth, schema: { tags: ["Returns"], security: [{ bearerAuth: [] }] } }, async (req) => {
    const myOrders = db.select({ id: s.orders.id }).from(s.orders).where(eq(s.orders.userId, req.user.id));
    const rows = await db.select({ id: s.returnRequests.id }).from(s.returnRequests).where(inArray(s.returnRequests.orderId, myOrders)).orderBy(desc(s.returnRequests.createdAt));
    const out = [];
    for (const r of rows) out.push(presentReturn((await loadReturn(eq(s.returnRequests.id, r.id)))!));
    return { data: out };
  });

  app.get(
    "/returns/:number",
    {
      preHandler: optionalAuth,
      schema: {
        tags: ["Returns"],
        params: Type.Object({ number: Type.String() }),
        querystring: Type.Object({
          token: Type.Optional(Type.String()),
          phone: Type.Optional(Type.String()),
        }),
      },
    },
    async (req) => {
      const full = await loadReturn(eq(s.returnRequests.number, (req.params as { number: string }).number.toUpperCase()));
      if (!full) throw notFound("Return");
      const isAdmin = req.user?.role === "admin";
      return { data: presentReturn(full, isAdmin) };
    },
  );
}

/** Registered inside the admin plugin (admin-only hook applies). */
export async function adminReturnRoutes(app: FastifyInstance) {
  const tags = ["Admin"];
  const security = [{ bearerAuth: [] }];

  app.get(
    "/returns",
    { schema: { tags, security, querystring: Type.Object({ status: Type.Optional(Type.String()), page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })) }) } },
    async (req) => {
      const { status, page = 1 } = req.query as { status?: string; page?: number };
      const w = status ? eq(s.returnRequests.status, status) : undefined;
      const rows = await db
        .select({
          number: s.returnRequests.number, status: s.returnRequests.status, resolution: s.returnRequests.resolution, reason: s.returnRequests.reason,
          refundAmount: s.returnRequests.refundAmount, createdAt: s.returnRequests.createdAt,
          orderNumber: s.orders.number, customerName: s.orders.customerName, customerPhone: s.orders.customerPhone, city: s.orders.city,
        })
        .from(s.returnRequests)
        .innerJoin(s.orders, eq(s.orders.id, s.returnRequests.orderId))
        .where(w)
        .orderBy(desc(s.returnRequests.createdAt))
        .limit(50)
        .offset((page - 1) * 50);
      const [{ total }] = await db.select({ total: count() }).from(s.returnRequests).where(w);
      return { data: rows.map((r) => ({ ...r, statusLabel: RETURN_LABEL[r.status] })), meta: { page, total, hasMore: page * 50 < total } };
    },
  );

  app.get("/returns/:number", { schema: { tags, security, params: Type.Object({ number: Type.String() }) } }, async (req) => {
    const full = await loadReturn(eq(s.returnRequests.number, (req.params as { number: string }).number));
    if (!full) throw notFound("Return");
    return { data: presentReturn(full, true) };
  });

  app.patch(
    "/returns/:number",
    {
      schema: {
        tags,
        security,
        summary: "Move a return along. 'received' restocks the items; 'refunded' marks the order refunded.",
        params: Type.Object({ number: Type.String() }),
        body: Type.Object({
          status: Type.Optional(Type.Union(RETURN_STATUSES.map((x) => Type.Literal(x)))),
          note: Type.Optional(Type.String({ maxLength: 300 })),
          adminNote: Type.Optional(Type.String({ maxLength: 500 })),
          refundAmount: Type.Optional(Type.Integer({ minimum: 0 })),
        }),
      },
    },
    async (req) => {
      const full = await loadReturn(eq(s.returnRequests.number, (req.params as { number: string }).number));
      if (!full) throw notFound("Return");
      const b = req.body as { status?: string; note?: string; adminNote?: string; refundAmount?: number };
      const set: Partial<typeof s.returnRequests.$inferInsert> = { updatedAt: new Date() };
      if (b.adminNote !== undefined) set.adminNote = b.adminNote;
      if (b.refundAmount !== undefined) set.refundAmount = b.refundAmount;
      if (b.status && b.status !== full.r.status) {
        set.status = b.status;
        await db.insert(s.returnEvents).values({ returnId: full.r.id, status: b.status, note: b.note ?? null });
        if (b.status === "received") {
          for (const ri of full.r.items) {
            const oi = full.items.find((i) => i.id === ri.orderItemId);
            if (oi?.variantId) await db.update(s.variants).set({ stock: sql`${s.variants.stock} + ${ri.qty}` }).where(eq(s.variants.id, oi.variantId));
          }
          invalidate("catalog:product");
        }
        if (b.status === "refunded") {
          const allQty = full.items.reduce((a, i) => a + i.qty, 0);
          const retQty = full.r.items.reduce((a, i) => a + i.qty, 0);
          await db.update(s.orders).set({ paymentStatus: "refunded", ...(retQty >= allQty ? { status: "returned" } : {}), updatedAt: new Date() }).where(eq(s.orders.id, full.order.id));
          await db.insert(s.orderEvents).values({ orderId: full.order.id, status: retQty >= allQty ? "returned" : full.order.status, note: `Refund ${full.r.number}: Rs.${b.refundAmount ?? full.r.refundAmount}` });
        }
      }
      await db.update(s.returnRequests).set(set).where(eq(s.returnRequests.id, full.r.id));
      return { data: presentReturn((await loadReturn(eq(s.returnRequests.id, full.r.id)))!, true) };
    },
  );

  app.get("/returns-summary", { schema: { tags, security } }, async () => {
    const rows = await db.select({ status: s.returnRequests.status, n: count() }).from(s.returnRequests).groupBy(s.returnRequests.status);
    return { data: Object.fromEntries(rows.map((r) => [r.status, r.n])) };
  });
}

