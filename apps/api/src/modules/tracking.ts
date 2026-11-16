import type { FastifyInstance } from "fastify";
import { Type } from "typebox";
import { and, desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "../db/client";
import * as s from "../db/schema";
import { badRequest, forbidden, notFound } from "../lib/errors";
import { SHIPMENT_STATUSES, type ShipmentStatus } from "../lib/types";
import { ORDER_STATUS_FOR, SHIPMENT_LABEL, couriers, defaultEta, getCourier } from "../shipping";
import { restock } from "./orders";

type Shipment = typeof s.shipments.$inferSelect;
type Order = typeof s.orders.$inferSelect;

const ORDER_LABEL: Record<string, string> = {
  processing: "Packed & ready to ship",
  shipped: "Shipped",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  returned: "Returned",
};

export async function loadShipment(orderId: number) {
  const [sh] = await db.select().from(s.shipments).where(eq(s.shipments.orderId, orderId));
  if (!sh) return null;
  const events = await db.select().from(s.shipmentEvents).where(eq(s.shipmentEvents.shipmentId, sh.id)).orderBy(desc(s.shipmentEvents.at));
  return { shipment: sh, events };
}

/** Public view of a shipment. Live rider position is only shared while out for delivery. */
export function presentShipment(full: NonNullable<Awaited<ReturnType<typeof loadShipment>>>, opts: { admin?: boolean } = {}) {
  const { shipment: sh, events } = full;
  const courier = getCourier(sh.courier);
  const live = sh.status === "out_for_delivery" && sh.lastLat != null && sh.lastLng != null;
  return {
    courier: sh.courier,
    courierName: courier?.name ?? sh.courier,
    trackingNumber: sh.trackingNumber,
    trackingUrl: sh.trackingNumber && courier?.trackingUrl ? courier.trackingUrl(sh.trackingNumber) : null,
    status: sh.status,
    statusLabel: SHIPMENT_LABEL[sh.status] ?? sh.status,
    eta: sh.etaAt,
    currentLocation: sh.currentLocation,
    rider:
      sh.riderName || live || opts.admin
        ? {
            name: sh.riderName,
            phone: sh.status === "out_for_delivery" || opts.admin ? sh.riderPhone : null,
            lat: live || opts.admin ? sh.lastLat : null,
            lng: live || opts.admin ? sh.lastLng : null,
            updatedAt: sh.lastLocationAt,
            live,
          }
        : null,
    events: events.map((e) => ({ status: e.status, label: SHIPMENT_LABEL[e.status] ?? e.status, location: e.location, note: e.note, at: e.at, source: e.source })),
    ...(opts.admin ? { riderToken: sh.riderToken, updatedAt: sh.updatedAt } : {}),
  };
}

/** Records a shipment update and moves the order status along with it. */
export async function addShipmentEvent(
  sh: Shipment,
  order: Order,
  e: { status: ShipmentStatus; location?: string | null; note?: string | null; lat?: number | null; lng?: number | null; source: "admin" | "courier" | "rider"; at?: Date },
) {
  await db.insert(s.shipmentEvents).values({
    shipmentId: sh.id,
    status: e.status,
    location: e.location ?? null,
    note: e.note ?? null,
    lat: e.lat ?? null,
    lng: e.lng ?? null,
    source: e.source,
    at: e.at ?? new Date(),
  });
  const shipSet: Partial<typeof s.shipments.$inferInsert> = { status: e.status, updatedAt: new Date() };
  if (e.location) shipSet.currentLocation = e.location;
  if (e.lat != null && e.lng != null) {
    shipSet.lastLat = e.lat;
    shipSet.lastLng = e.lng;
    shipSet.lastLocationAt = new Date();
  }
  if (e.status === "out_for_delivery" && (!sh.etaAt || sh.etaAt.getTime() > Date.now() + 8 * 3600e3)) {
    const today = new Date();
    today.setHours(21, 0, 0, 0);
    shipSet.etaAt = today; // same day once with the rider
  }
  await db.update(s.shipments).set(shipSet).where(eq(s.shipments.id, sh.id));

  const nextOrder = ORDER_STATUS_FOR[e.status];
  if (nextOrder && nextOrder !== order.status && !["cancelled", "returned"].includes(order.status)) {
    const set: Partial<typeof s.orders.$inferInsert> = { status: nextOrder, updatedAt: new Date(), ...stampsFor(nextOrder, order) };
    if (nextOrder === "delivered" && order.paymentMethod === "cod") set.paymentStatus = "paid";
    if (nextOrder === "returned") {
      set.returnType = order.returnType ?? "rto";
      set.returnReason = order.returnReason ?? e.note ?? "Returned by courier";
    }
    await db.update(s.orders).set(set).where(eq(s.orders.id, order.id));
    await db.insert(s.orderEvents).values({
      orderId: order.id,
      status: nextOrder,
      note: [ORDER_LABEL[nextOrder] !== SHIPMENT_LABEL[e.status] ? SHIPMENT_LABEL[e.status] : null, e.location, e.note].filter(Boolean).join(" · ") || null,
    });
    if (nextOrder === "returned") await restock(order.id);
  }
}

/** Remember WHEN an order reached each stage (used by the order desk and the returns report) */
export function stampsFor(status: string, order: { packedAt?: Date | null; shippedAt?: Date | null; deliveredAt?: Date | null; returnedAt?: Date | null }) {
  const now = new Date();
  const set: Partial<typeof s.orders.$inferInsert> = {};
  if (status === "processing" && !order.packedAt) set.packedAt = now;
  if (["shipped", "out_for_delivery"].includes(status) && !order.shippedAt) set.shippedAt = now;
  if (status === "delivered") set.deliveredAt = now;
  if (status === "returned" && !order.returnedAt) set.returnedAt = now;
  return set;
}

export async function upsertShipment(
  order: Order,
  b: { courier?: string; trackingNumber?: string | null; riderName?: string | null; riderPhone?: string | null; etaAt?: string | null },
) {
  const existing = await loadShipment(order.id);
  if (b.courier && !getCourier(b.courier)) throw badRequest("Unknown courier");
  const values = {
    ...(b.courier ? { courier: b.courier } : {}),
    ...(b.trackingNumber !== undefined ? { trackingNumber: b.trackingNumber || null } : {}),
    ...(b.riderName !== undefined ? { riderName: b.riderName || null } : {}),
    ...(b.riderPhone !== undefined ? { riderPhone: b.riderPhone || null } : {}),
    ...(b.etaAt !== undefined ? { etaAt: b.etaAt ? new Date(b.etaAt) : null } : {}),
    updatedAt: new Date(),
  };
  if (existing) {
    await db.update(s.shipments).set(values).where(eq(s.shipments.id, existing.shipment.id));
  } else {
    const [sh] = await db
      .insert(s.shipments)
      .values({ orderId: order.id, riderToken: nanoid(28), etaAt: defaultEta(order.city), ...values })
      .returning();
    await addShipmentEvent(sh, order, { status: "booked", location: "Warehouse", source: "admin", note: getCourier(sh.courier)?.name });
  }
  return (await loadShipment(order.id))!;
}

export async function trackingRoutes(app: FastifyInstance) {
  app.get("/couriers", { schema: { tags: ["Shipping"], summary: "Supported couriers" } }, async () => ({
    data: couriers.map((c) => ({ id: c.id, name: c.name, apiConnected: !!c.fetchTracking })),
  }));

  /* ── Rider page (secret link) ── */
  const riderParams = Type.Object({ token: Type.String({ minLength: 20, maxLength: 40 }) });
  const byToken = async (token: string) => {
    const [sh] = await db.select().from(s.shipments).where(eq(s.shipments.riderToken, token));
    if (!sh) throw notFound("Delivery");
    const [order] = await db.select().from(s.orders).where(eq(s.orders.id, sh.orderId));
    return { sh, order };
  };

  app.get("/rider/:token", { schema: { tags: ["Rider"], summary: "Delivery details for the rider's phone", params: riderParams } }, async (req) => {
    const { sh, order } = await byToken((req.params as { token: string }).token);
    const items = await db.select().from(s.orderItems).where(eq(s.orderItems.orderId, order.id));
    return {
      data: {
        orderNumber: order.number,
        status: sh.status,
        statusLabel: SHIPMENT_LABEL[sh.status],
        riderName: sh.riderName,
        customer: { name: order.customerName, phone: order.customerPhone },
        address: { line1: order.line1, area: order.area, city: order.city, notes: order.notes },
        collect: order.paymentMethod === "cod" && order.paymentStatus !== "paid" ? order.total : 0,
        items: items.map((i) => ({ name: i.productName, model: i.modelName, color: i.colorName, qty: i.qty })),
        lastLocationAt: sh.lastLocationAt,
      },
    };
  });

  app.post(
    "/rider/:token/location",
    {
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
      schema: { tags: ["Rider"], summary: "Rider phone pushes GPS position", params: riderParams, body: Type.Object({ lat: Type.Number({ minimum: -90, maximum: 90 }), lng: Type.Number({ minimum: -180, maximum: 180 }), accuracy: Type.Optional(Type.Number()) }) },
    },
    async (req) => {
      const { sh } = await byToken((req.params as { token: string }).token);
      if (["delivered", "returned_to_sender"].includes(sh.status)) throw forbidden("This delivery is finished");
      const { lat, lng } = req.body as { lat: number; lng: number };
      await db.update(s.shipments).set({ lastLat: lat, lastLng: lng, lastLocationAt: new Date() }).where(eq(s.shipments.id, sh.id));
      return { data: { ok: true } };
    },
  );

  app.post(
    "/rider/:token/status",
    {
      schema: {
        tags: ["Rider"],
        summary: "Rider marks out for delivery / delivered / failed attempt",
        params: riderParams,
        body: Type.Object({
          status: Type.Union([Type.Literal("out_for_delivery"), Type.Literal("delivered"), Type.Literal("failed_attempt")]),
          note: Type.Optional(Type.String({ maxLength: 200 })),
          lat: Type.Optional(Type.Number()),
          lng: Type.Optional(Type.Number()),
        }),
      },
    },
    async (req) => {
      const { sh, order } = await byToken((req.params as { token: string }).token);
      const b = req.body as { status: ShipmentStatus; note?: string; lat?: number; lng?: number };
      if (sh.status === "delivered") throw badRequest("Already delivered");
      await addShipmentEvent(sh, order, { status: b.status, note: b.note, lat: b.lat, lng: b.lng, source: "rider", location: order.city });
      return { data: { ok: true, status: b.status } };
    },
  );

  /* ── Courier webhooks ── */
  app.post(
    "/shipping/:courier/webhook",
    {
      schema: {
        tags: ["Shipping"],
        summary: "Courier pushes a status update. Header x-webhook-secret must match the courier's secret in .env",
        params: Type.Object({ courier: Type.String() }),
        body: Type.Object({ trackingNumber: Type.String(), status: Type.String(), location: Type.Optional(Type.String()), note: Type.Optional(Type.String()), at: Type.Optional(Type.String()) }),
      },
    },
    async (req) => {
      const { courier: id } = req.params as { courier: string };
      const c = getCourier(id);
      const secret = c?.webhookSecret?.();
      if (!c || !secret || req.headers["x-webhook-secret"] !== secret) throw forbidden("Webhook not configured");
      const b = req.body as { trackingNumber: string; status: string; location?: string; note?: string; at?: string };
      const status = (SHIPMENT_STATUSES as readonly string[]).includes(b.status) ? (b.status as ShipmentStatus) : c.mapStatus?.(b.status);
      if (!status) throw badRequest(`Unknown status "${b.status}"`);
      const [sh] = await db.select().from(s.shipments).where(and(eq(s.shipments.courier, id), eq(s.shipments.trackingNumber, b.trackingNumber)));
      if (!sh) throw notFound("Shipment");
      const [order] = await db.select().from(s.orders).where(eq(s.orders.id, sh.orderId));
      await addShipmentEvent(sh, order, { status, location: b.location, note: b.note ?? b.status, source: "courier", at: b.at ? new Date(b.at) : undefined });
      return { data: { ok: true } };
    },
  );
}
