/**
 * Order desk — everything that happens to an order after it is confirmed:
 * pack → print label → hand to courier → delivered / returned, plus the returns report.
 */
import type { FastifyInstance } from "fastify";
import { Type } from "typebox";
import { and, desc, eq, gte, inArray, isNotNull, isNull, like, or, sql, type SQL } from "drizzle-orm";
import { db } from "../db/client";
import * as s from "../db/schema";
import { requireAdmin } from "../lib/auth";
import { badRequest, notFound } from "../lib/errors";
import { invalidate } from "../lib/cache";
import { store } from "../config";
import { couriers, getCourier } from "../shipping";
import { addShipmentEvent, stampsFor, upsertShipment } from "./tracking";
import { restock } from "./orders";

const tags = ["Order desk"];
const security = [{ bearerAuth: [] }];

/** Desk stages → order statuses */
export const STAGES = {
  new: ["pending"],
  to_pack: ["confirmed"],
  packed: ["processing"],
  shipped: ["shipped", "out_for_delivery"],
  delivered: ["delivered"],
  returned: ["returned"],
  cancelled: ["cancelled"],
} as const;
type Stage = keyof typeof STAGES;

const codDue = (o: typeof s.orders.$inferSelect) => (o.paymentMethod === "cod" && o.paymentStatus !== "paid" ? o.total : 0);

async function ordersByNumbers(numbers: string[]) {
  if (!numbers.length) return [];
  return db.select().from(s.orders).where(inArray(s.orders.number, numbers));
}

/** items + shipment for a set of orders, in two queries */
async function extrasFor(ids: number[]) {
  if (!ids.length) return { items: [] as (typeof s.orderItems.$inferSelect)[], ships: [] as (typeof s.shipments.$inferSelect)[] };
  const [items, ships] = await Promise.all([
    db.select().from(s.orderItems).where(inArray(s.orderItems.orderId, ids)),
    db.select().from(s.shipments).where(inArray(s.shipments.orderId, ids)),
  ]);
  return { items, ships };
}

function weightOf(o: typeof s.orders.$inferSelect, items: (typeof s.orderItems.$inferSelect)[]) {
  if (o.weightGrams) return o.weightGrams;
  const pcs = items.reduce((a, i) => a + i.qty, 0);
  return pcs * store.labels.gramsPerItem + store.labels.packagingGrams;
}

export async function deskRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAdmin);

  /* ───────────── list ───────────── */
  app.get(
    "/desk",
    {
      schema: {
        tags,
        security,
        summary: "Orders for one stage of the desk, with counts for every stage",
        querystring: Type.Object({
          stage: Type.Optional(Type.String()),
          q: Type.Optional(Type.String({ maxLength: 80 })),
          courier: Type.Optional(Type.String()),
          city: Type.Optional(Type.String()),
          printed: Type.Optional(Type.Union([Type.Literal("yes"), Type.Literal("no")])),
          limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 300, default: 150 })),
        }),
      },
    },
    async (req) => {
      const qs = req.query as { stage?: Stage; q?: string; courier?: string; city?: string; printed?: string; limit?: number };
      const stage: Stage = qs.stage && qs.stage in STAGES ? qs.stage : "to_pack";
      const where: SQL[] = [inArray(s.orders.status, [...STAGES[stage]])];
      if (qs.q) {
        const t = `%${qs.q.trim()}%`;
        const byTracking = db.select({ id: s.shipments.orderId }).from(s.shipments).where(like(s.shipments.trackingNumber, t));
        where.push(or(like(s.orders.number, t), like(s.orders.customerName, t), like(s.orders.customerPhone, t), inArray(s.orders.id, byTracking))!);
      }
      if (qs.city) where.push(eq(s.orders.city, qs.city));
      if (qs.printed === "yes") where.push(isNotNull(s.orders.labelPrintedAt));
      if (qs.printed === "no") where.push(isNull(s.orders.labelPrintedAt));
      if (qs.courier) where.push(inArray(s.orders.id, db.select({ id: s.shipments.orderId }).from(s.shipments).where(eq(s.shipments.courier, qs.courier))));

      const recent = ["delivered", "returned", "cancelled"].includes(stage);
      const [rows, counts] = await Promise.all([
        db
          .select()
          .from(s.orders)
          .where(and(...where))
          .orderBy(recent ? desc(s.orders.updatedAt) : s.orders.createdAt)
          .limit(qs.limit ?? 150),
        db.select({ status: s.orders.status, n: sql<number>`count(*)` }).from(s.orders).groupBy(s.orders.status),
      ]);
      const { items, ships } = await extrasFor(rows.map((o) => o.id));
      const revs = stage === "delivered" && rows.length
        ? await db.select({ orderId: s.reviews.orderId }).from(s.reviews).where(inArray(s.reviews.orderId, rows.map((o) => o.id)))
        : [];
      const per = Object.fromEntries(counts.map((c) => [c.status, Number(c.n)]));
      const stageCounts = Object.fromEntries(Object.entries(STAGES).map(([k, v]) => [k, v.reduce((a, st) => a + (per[st] ?? 0), 0)]));
      return {
        data: rows.map((o) => {
          const its = items.filter((i) => i.orderId === o.id);
          const sh = ships.find((x) => x.orderId === o.id);
          return {
            number: o.number,
            status: o.status,
            createdAt: o.createdAt,
            name: o.customerName,
            phone: o.customerPhone,
            city: o.city,
            address: [o.line1, o.area].filter(Boolean).join(", "),
            notes: o.notes,
            total: o.total,
            codDue: codDue(o),
            paymentMethod: o.paymentMethod,
            openParcel: o.openParcel,
            pieces: its.reduce((a, i) => a + i.qty, 0),
            weightGrams: weightOf(o, its),
            items: its.map((i) => ({ name: i.productName, model: i.modelName, color: i.colorName, qty: i.qty, sku: i.sku })),
            labelPrintedAt: o.labelPrintedAt,
            packedAt: o.packedAt,
            shippedAt: o.shippedAt,
            deliveredAt: o.deliveredAt,
            returnedAt: o.returnedAt,
            returnType: o.returnType,
            returnReason: o.returnReason,
            returnCost: o.returnCost,
            reviewRequestedAt: o.reviewRequestedAt,
            reviewToken: o.status === "delivered" ? o.accessToken : null,
            reviewsGiven: revs.filter((r) => r.orderId === o.id).length,
            courier: sh?.courier ?? null,
            courierName: sh ? (getCourier(sh.courier)?.name ?? sh.courier) : null,
            trackingNumber: sh?.trackingNumber ?? null,
            shipmentStatus: sh?.status ?? null,
          };
        }),
        meta: { stage, counts: stageCounts },
      };
    },
  );

  /** Everything the order desk screen needs to know about the store */
  app.get("/desk/options", { schema: { tags, security } }, async () => {
    const cities = await db.select({ city: s.orders.city, n: sql<number>`count(*)` }).from(s.orders).groupBy(s.orders.city).orderBy(desc(sql`count(*)`));
    return {
      data: {
        couriers: couriers.map((c) => ({ id: c.id, name: c.name })),
        cities: cities.map((c) => c.city),
        returnReasons: store.returnReasons,
        openParcelDefault: store.labels.openParcelDefault,
      },
    };
  });

  /* ───────────── bulk actions ───────────── */
  app.post(
    "/desk/bulk",
    {
      schema: {
        tags,
        security,
        summary: "Do one thing to many orders: pack, ship, deliver, cancel, mark labels printed, open-parcel on/off, set courier",
        body: Type.Object({
          numbers: Type.Array(Type.String(), { minItems: 1, maxItems: 300 }),
          action: Type.Union(["pack", "ship", "deliver", "cancel", "printed", "open_parcel", "courier", "weight", "review_asked"].map((x) => Type.Literal(x))),
          courier: Type.Optional(Type.String()),
          openParcel: Type.Optional(Type.Boolean()),
          weightGrams: Type.Optional(Type.Integer({ minimum: 1, maximum: 50000 })),
          note: Type.Optional(Type.String({ maxLength: 300 })),
        }),
      },
    },
    async (req) => {
      const b = req.body as { numbers: string[]; action: string; courier?: string; openParcel?: boolean; weightGrams?: number; note?: string };
      if (b.courier && !getCourier(b.courier)) throw badRequest("Unknown courier");
      const list = await ordersByNumbers(b.numbers);
      const done: string[] = [];
      const skipped: { number: string; why: string }[] = [];
      const closed = (o: typeof s.orders.$inferSelect) => ["cancelled", "returned", "delivered"].includes(o.status);

      for (const o of list) {
        try {
          switch (b.action) {
            case "review_asked":
              await db.update(s.orders).set({ reviewRequestedAt: new Date() }).where(eq(s.orders.id, o.id));
              break;
            case "printed":
              await db.update(s.orders).set({ labelPrintedAt: new Date() }).where(eq(s.orders.id, o.id));
              break;
            case "open_parcel":
              await db.update(s.orders).set({ openParcel: !!b.openParcel, updatedAt: new Date() }).where(eq(s.orders.id, o.id));
              break;
            case "weight":
              await db.update(s.orders).set({ weightGrams: b.weightGrams ?? null, updatedAt: new Date() }).where(eq(s.orders.id, o.id));
              break;
            case "courier":
              if (closed(o)) throw new Error("order is closed");
              await upsertShipment(o, { courier: b.courier ?? "own" });
              break;
            case "pack": {
              if (!["pending", "confirmed"].includes(o.status)) throw new Error(`already ${o.status}`);
              await db.update(s.orders).set({ status: "processing", updatedAt: new Date(), ...stampsFor("processing", o) }).where(eq(s.orders.id, o.id));
              await db.insert(s.orderEvents).values({ orderId: o.id, status: "processing", note: b.note ?? "Packed & ready to ship" });
              break;
            }
            case "ship": {
              if (!["confirmed", "processing"].includes(o.status)) throw new Error(`can't ship — order is ${o.status}`);
              const sh = (await upsertShipment(o, b.courier ? { courier: b.courier } : {})).shipment;
              const [fresh] = await db.select().from(s.orders).where(eq(s.orders.id, o.id));
              await addShipmentEvent(sh, fresh, { status: "picked_up", location: "Warehouse", note: b.note ?? `Handed to ${getCourier(sh.courier)?.name ?? sh.courier}`, source: "admin" });
              break;
            }
            case "deliver": {
              if (!["shipped", "out_for_delivery", "processing"].includes(o.status)) throw new Error(`can't deliver — order is ${o.status}`);
              const [sh] = await db.select().from(s.shipments).where(eq(s.shipments.orderId, o.id));
              if (sh) await addShipmentEvent(sh, o, { status: "delivered", location: o.city, note: b.note ?? null, source: "admin" });
              else {
                await db.update(s.orders).set({ status: "delivered", updatedAt: new Date(), ...stampsFor("delivered", o), ...(o.paymentMethod === "cod" ? { paymentStatus: "paid" } : {}) }).where(eq(s.orders.id, o.id));
                await db.insert(s.orderEvents).values({ orderId: o.id, status: "delivered", note: b.note ?? null });
              }
              break;
            }
            case "cancel": {
              if (closed(o)) throw new Error(`already ${o.status}`);
              await db.update(s.orders).set({ status: "cancelled", updatedAt: new Date() }).where(eq(s.orders.id, o.id));
              await db.insert(s.orderEvents).values({ orderId: o.id, status: "cancelled", note: b.note ?? "Cancelled from order desk" });
              await restock(o.id);
              break;
            }
          }
          done.push(o.number);
        } catch (e) {
          skipped.push({ number: o.number, why: (e as Error).message });
        }
      }
      for (const n of b.numbers) if (!list.some((o) => o.number === n)) skipped.push({ number: n, why: "not found" });
      if (["cancel"].includes(b.action)) invalidate("catalog:product");
      return { data: { done, skipped } };
    },
  );

  /** Type / paste the courier's tracking numbers for many orders at once */
  app.put(
    "/desk/tracking",
    {
      schema: {
        tags,
        security,
        body: Type.Object({
          courier: Type.String(),
          items: Type.Array(Type.Object({ number: Type.String(), trackingNumber: Type.String({ maxLength: 60 }) }), { minItems: 1, maxItems: 300 }),
        }),
      },
    },
    async (req) => {
      const b = req.body as { courier: string; items: { number: string; trackingNumber: string }[] };
      if (!getCourier(b.courier)) throw badRequest("Unknown courier");
      const list = await ordersByNumbers(b.items.map((i) => i.number));
      for (const it of b.items) {
        const o = list.find((x) => x.number === it.number);
        if (o) await upsertShipment(o, { courier: b.courier, trackingNumber: it.trackingNumber.trim() || null });
      }
      return { data: { ok: true, updated: list.length } };
    },
  );

  /** Barcode scanner / quick search: order number OR courier tracking number */
  app.get("/desk/scan/:code", { schema: { tags, security, params: Type.Object({ code: Type.String({ maxLength: 80 }) }) } }, async (req) => {
    const code = (req.params as { code: string }).code.trim().replace(/^#/, "");
    let [o] = await db.select().from(s.orders).where(eq(s.orders.number, code.toUpperCase()));
    if (!o) {
      const [sh] = await db.select().from(s.shipments).where(eq(s.shipments.trackingNumber, code));
      if (sh) [o] = await db.select().from(s.orders).where(eq(s.orders.id, sh.orderId));
    }
    if (!o) throw notFound("Order");
    return { data: { number: o.number, status: o.status } };
  });

  /* ───────────── returns ───────────── */
  app.post(
    "/desk/return",
    {
      schema: {
        tags,
        security,
        summary: "Parcel came back: mark returned with the reason (stock goes back), optionally block the number",
        body: Type.Object({
          numbers: Type.Array(Type.String(), { minItems: 1, maxItems: 300 }),
          type: Type.Union([Type.Literal("rto"), Type.Literal("customer")]),
          reason: Type.String({ minLength: 2, maxLength: 120 }),
          cost: Type.Optional(Type.Integer({ minimum: 0, maximum: 100000 })),
          restock: Type.Optional(Type.Boolean({ default: true })),
          block: Type.Optional(Type.Boolean()),
          note: Type.Optional(Type.String({ maxLength: 300 })),
        }),
      },
    },
    async (req) => {
      const b = req.body as { numbers: string[]; type: "rto" | "customer"; reason: string; cost?: number; restock?: boolean; block?: boolean; note?: string };
      const list = await ordersByNumbers(b.numbers);
      const done: string[] = [];
      const skipped: { number: string; why: string }[] = [];
      for (const o of list) {
        if (["returned", "cancelled", "pending"].includes(o.status)) {
          skipped.push({ number: o.number, why: `order is ${o.status}` });
          continue;
        }
        await db
          .update(s.orders)
          .set({
            status: "returned",
            returnType: b.type,
            returnReason: b.reason,
            returnCost: b.cost ?? 0,
            returnedAt: new Date(),
            paymentStatus: o.paymentMethod === "cod" ? "unpaid" : o.paymentStatus,
            updatedAt: new Date(),
          })
          .where(eq(s.orders.id, o.id));
        await db.insert(s.orderEvents).values({ orderId: o.id, status: "returned", note: [b.type === "rto" ? "Returned by courier" : "Returned by customer", b.reason, b.note].filter(Boolean).join(" · ") });
        const [sh] = await db.select().from(s.shipments).where(eq(s.shipments.orderId, o.id));
        if (sh && sh.status !== "returned_to_sender") {
          await db.update(s.shipments).set({ status: "returned_to_sender", updatedAt: new Date() }).where(eq(s.shipments.id, sh.id));
          await db.insert(s.shipmentEvents).values({ shipmentId: sh.id, status: "returned_to_sender", location: "Warehouse", note: b.reason, source: "admin" });
        }
        if (b.restock !== false) await restock(o.id);
        if (b.block)
          await db
            .insert(s.blockedPhones)
            .values({ phone: o.customerPhone, reason: `Returned #${o.number}: ${b.reason}` })
            .onConflictDoNothing();
        done.push(o.number);
      }
      invalidate("catalog:product");
      return { data: { done, skipped } };
    },
  );

  /* ───────────── printing ───────────── */
  app.get(
    "/desk/labels",
    { schema: { tags, security, summary: "Everything printed on parcel labels", querystring: Type.Object({ numbers: Type.String({ maxLength: 6000 }) }) } },
    async (req) => {
      const numbers = (req.query as { numbers: string }).numbers.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 300);
      const list = await ordersByNumbers(numbers);
      const { items, ships } = await extrasFor(list.map((o) => o.id));
      const order = new Map(numbers.map((n, i) => [n, i]));
      return {
        data: {
          from: { name: store.name, phone: store.supportPhone, address: store.pickupAddress },
          contents: store.labels.contents,
          labels: list
            .sort((a, b) => (order.get(a.number) ?? 0) - (order.get(b.number) ?? 0))
            .map((o) => {
              const its = items.filter((i) => i.orderId === o.id);
              const sh = ships.find((x) => x.orderId === o.id);
              return {
                number: o.number,
                date: o.createdAt,
                name: o.customerName,
                phone: o.customerPhone,
                address: [o.line1, o.area].filter(Boolean).join(", "),
                city: o.city,
                postalCode: o.postalCode,
                notes: o.notes,
                codDue: codDue(o),
                total: o.total,
                paymentMethod: o.paymentMethod,
                openParcel: o.openParcel,
                pieces: its.reduce((a, i) => a + i.qty, 0),
                weightGrams: weightOf(o, its),
                courier: sh ? (getCourier(sh.courier)?.name ?? sh.courier) : null,
                trackingNumber: sh?.trackingNumber ?? null,
                // for the packing list only (never printed on the outside label)
                items: its.map((i) => ({ name: i.productName, model: i.modelName, color: i.colorName, qty: i.qty, sku: i.sku })),
              };
            }),
        },
      };
    },
  );

  /* ───────────── returns report ───────────── */
  app.get(
    "/reports/returns",
    {
      schema: {
        tags,
        security,
        summary: "Who / where / which courier / which product gets returned most",
        querystring: Type.Object({ days: Type.Optional(Type.Integer({ minimum: 0, maximum: 3650, default: 90 })) }),
      },
    },
    async (req) => {
      const days = (req.query as { days?: number }).days ?? 90;
      const since = days ? new Date(Date.now() - days * 864e5) : new Date(0);
      // orders that left the warehouse in the period = the fair base for a return %
      const sent = await db
        .select()
        .from(s.orders)
        .where(and(gte(s.orders.createdAt, since), inArray(s.orders.status, ["shipped", "out_for_delivery", "delivered", "returned"])));
      const ids = sent.map((o) => o.id);
      const { items, ships } = await extrasFor(ids);
      const customerReturns = ids.length
        ? await db
            .select()
            .from(s.returnRequests)
            .where(and(inArray(s.returnRequests.orderId, ids), inArray(s.returnRequests.status, ["approved", "pickup_scheduled", "received", "refunded", "exchanged", "closed"])))
        : [];

      type Row = { key: string; label: string; sent: number; returned: number; delivered: number; lost: number; extra?: string };
      const group = (keyOf: (o: (typeof sent)[number]) => { key: string; label: string; extra?: string }[]) => {
        const m = new Map<string, Row>();
        for (const o of sent) {
          const isRet = o.status === "returned" || customerReturns.some((r) => r.orderId === o.id);
          for (const k of keyOf(o)) {
            const r = m.get(k.key) ?? { key: k.key, label: k.label, sent: 0, returned: 0, delivered: 0, lost: 0, extra: k.extra };
            r.sent++;
            if (isRet) {
              r.returned++;
              r.lost += o.returnCost + o.shipping;
            }
            if (o.status === "delivered") r.delivered++;
            m.set(k.key, r);
          }
        }
        return [...m.values()]
          .map((r) => ({ ...r, rate: r.sent ? Math.round((r.returned / r.sent) * 1000) / 10 : 0 }))
          .sort((a, b) => b.returned - a.returned || b.rate - a.rate)
          .slice(0, 50);
      };

      const courierOf = (o: (typeof sent)[number]) => {
        const sh = ships.find((x) => x.orderId === o.id);
        const id = sh?.courier ?? "none";
        return [{ key: id, label: sh ? (getCourier(id)?.name ?? id) : "No courier set" }];
      };

      const returned = sent.filter((o) => o.status === "returned" || customerReturns.some((r) => r.orderId === o.id));
      const reasons = new Map<string, number>();
      for (const o of returned) {
        const r = o.returnReason ?? customerReturns.find((x) => x.orderId === o.id)?.reason ?? "Not recorded";
        reasons.set(r, (reasons.get(r) ?? 0) + 1);
      }

      return {
        data: {
          days,
          totals: {
            sent: sent.length,
            delivered: sent.filter((o) => o.status === "delivered").length,
            inTransit: sent.filter((o) => ["shipped", "out_for_delivery"].includes(o.status)).length,
            returned: returned.length,
            rto: sent.filter((o) => o.status === "returned" && o.returnType !== "customer").length,
            customer: returned.length - sent.filter((o) => o.status === "returned" && o.returnType !== "customer").length,
            rate: sent.length ? Math.round((returned.length / sent.length) * 1000) / 10 : 0,
            lost: returned.reduce((a, o) => a + o.returnCost + o.shipping, 0),
            valueReturned: returned.reduce((a, o) => a + o.total, 0),
          },
          byReason: [...reasons.entries()].map(([reason, n]) => ({ reason, n })).sort((a, b) => b.n - a.n),
          byCity: group((o) => [{ key: o.city, label: o.city }]),
          byCourier: group(courierOf),
          byCourierCity: group((o) => courierOf(o).map((c) => ({ key: `${c.key}|${o.city}`, label: `${c.label} · ${o.city}` }))).filter((r) => r.returned > 0),
          byCustomer: group((o) => [{ key: o.customerPhone, label: o.customerName, extra: o.customerPhone }]).filter((r) => r.returned > 0),
          byProduct: group((o) => {
            const seen = new Set<string>();
            return items
              .filter((i) => i.orderId === o.id)
              .filter((i) => (seen.has(i.productSlug) ? false : (seen.add(i.productSlug), true)))
              .map((i) => ({ key: i.productSlug, label: i.productName }));
          }),
          byModel: group((o) => {
            const seen = new Set<string>();
            return items
              .filter((i) => i.orderId === o.id && i.modelName)
              .filter((i) => (seen.has(i.modelName) ? false : (seen.add(i.modelName), true)))
              .map((i) => ({ key: i.modelName, label: i.modelName }));
          }).filter((r) => r.returned > 0),
          recent: returned
            .sort((a, b) => (b.returnedAt?.getTime() ?? 0) - (a.returnedAt?.getTime() ?? 0))
            .slice(0, 30)
            .map((o) => ({
              number: o.number,
              name: o.customerName,
              phone: o.customerPhone,
              city: o.city,
              total: o.total,
              type: o.returnType ?? "customer",
              reason: o.returnReason ?? customerReturns.find((x) => x.orderId === o.id)?.reason ?? null,
              courier: courierOf(o)[0].label,
              returnedAt: o.returnedAt ?? o.updatedAt,
            })),
        },
      };
    },
  );
}
