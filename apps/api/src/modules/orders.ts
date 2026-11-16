import type { FastifyInstance } from "fastify";
import { Type } from "typebox";
import { and, desc, eq, sql, inArray, isNull, or } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "../db/client";
import * as s from "../db/schema";
import { store } from "../config";
import { ApiError, badRequest, notFound, unauthorized } from "../lib/errors";
import { optionalAuth, requireAuth } from "../lib/auth";
import { computeCart } from "./cart";
import { isBlocked } from "./engage";
import { getProvider, providers } from "../payments";
import { invalidate } from "../lib/cache";
import { loadShipment, presentShipment } from "./tracking";

export const RETURN_LABEL: Record<string, string> = {
  requested: "Return requested",
  approved: "Approved — we'll arrange pickup",
  rejected: "Not approved",
  pickup_scheduled: "Pickup scheduled",
  received: "Received at warehouse",
  refunded: "Refunded",
  exchanged: "Exchange sent",
  closed: "Closed",
};

/** Accepts 03001234567, +923001234567, 92 300 1234567 → +923001234567 */
export function normalizePkPhone(raw: string) {
  const d = raw.replace(/[^\d+]/g, "");
  const m = d.match(/^(?:\+?92|0)?(3\d{9})$/);
  return m ? `+92${m[1]}` : null;
}

export const STATUS_LABEL: Record<string, string> = {
  pending: "Order placed",
  confirmed: "Order confirmed",
  processing: "Packed & ready to ship",
  shipped: "Shipped",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  returned: "Returned",
};

export async function loadOrder(where: ReturnType<typeof eq>) {
  const [o] = await db.select().from(s.orders).where(where);
  if (!o) return null;
  const [items, events, shipment, returns] = await Promise.all([
    db.select().from(s.orderItems).where(eq(s.orderItems.orderId, o.id)),
    db.select().from(s.orderEvents).where(eq(s.orderEvents.orderId, o.id)).orderBy(s.orderEvents.createdAt),
    loadShipment(o.id),
    db.select().from(s.returnRequests).where(eq(s.returnRequests.orderId, o.id)).orderBy(desc(s.returnRequests.createdAt)),
  ]);
  return { order: o, items, events, shipment, returns };
}

/** Delivered orders can be returned/exchanged within store.returnsDays of delivery. */
export function returnWindow(full: NonNullable<Awaited<ReturnType<typeof loadOrder>>>) {
  if (full.order.status !== "delivered") return { canReturn: false, returnDeadline: null as Date | null };
  const delivered = [...full.events].reverse().find((e) => e.status === "delivered")?.createdAt ?? full.order.updatedAt;
  const deadline = new Date(delivered.getTime() + store.returnsDays * 864e5);
  const open = full.returns.some((r) => !["rejected", "closed"].includes(r.status));
  return { canReturn: Date.now() < deadline.getTime() && !open, returnDeadline: deadline };
}

/** Attach earlier guest orders (same email or mobile) to a customer's account. */
export async function claimGuestOrders(user: { id: number; email: string; phone: string | null }) {
  const conds = [eq(s.orders.customerEmail, user.email.toLowerCase())];
  if (user.phone) conds.push(eq(s.orders.customerPhone, user.phone));
  await db.update(s.orders).set({ userId: user.id }).where(and(isNull(s.orders.userId), or(...conds)));
}

export function presentOrder(full: NonNullable<Awaited<ReturnType<typeof loadOrder>>>, includeToken = false, opts: { admin?: boolean } = {}) {
  const { order: o, items, events } = full;
  return {
    number: o.number,
    ...(includeToken ? { accessToken: o.accessToken } : {}),
    status: o.status,
    statusLabel: STATUS_LABEL[o.status] ?? o.status,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    customer: { name: o.customerName, phone: o.customerPhone, email: o.customerEmail },
    address: { city: o.city, area: o.area, line1: o.line1, postalCode: o.postalCode },
    notes: o.notes,
    items: items.map((i) => ({
      id: i.id,
      productSlug: i.productSlug,
      productName: i.productName,
      modelName: i.modelName,
      colorName: i.colorName,
      colorHex: i.colorHex,
      sku: i.sku,
      unitPrice: i.unitPrice,
      qty: i.qty,
      lineTotal: i.lineTotal,
      category: i.category,
      material: i.material,
      custom: i.custom,
    })),
    totals: { subtotal: o.subtotal, discount: o.discount, shipping: o.shipping, codFee: o.codFee, total: o.total },
    couponCode: o.couponCode,
    timeline: events.map((e) => ({ status: e.status, label: STATUS_LABEL[e.status] ?? e.status, note: e.note, at: e.createdAt })),
    canCancel: ["pending", "confirmed"].includes(o.status),
    ...returnWindow(full),
    shipment: full.shipment ? presentShipment(full.shipment, { admin: opts.admin }) : null,
    returns: full.returns.map((r) => ({ number: r.number, status: r.status, statusLabel: RETURN_LABEL[r.status] ?? r.status, resolution: r.resolution, reason: r.reason, createdAt: r.createdAt })),
    createdAt: o.createdAt,
  };
}

/** Put stock back when an order is cancelled/returned */
export async function restock(orderId: number) {
  const items = await db.select().from(s.orderItems).where(eq(s.orderItems.orderId, orderId));
  for (const i of items) {
    if (i.variantId) await db.update(s.variants).set({ stock: sql`${s.variants.stock} + ${i.qty}` }).where(eq(s.variants.id, i.variantId));
  }
}

const checkoutBody = Type.Object({
  cartId: Type.String(),
  customer: Type.Object({
    name: Type.String({ minLength: 2, maxLength: 80 }),
    phone: Type.String({ minLength: 10, maxLength: 20 }),
    email: Type.Optional(Type.Union([Type.String({ format: "email", maxLength: 120 }), Type.Literal("")])),
  }),
  address: Type.Object({
    city: Type.String({ minLength: 2, maxLength: 60 }),
    area: Type.Optional(Type.String({ maxLength: 80 })),
    line1: Type.String({ minLength: 5, maxLength: 250 }),
    postalCode: Type.Optional(Type.String({ maxLength: 12 })),
  }),
  notes: Type.Optional(Type.String({ maxLength: 500 })),
  paymentMethod: Type.String({ default: "cod" }),
  source: Type.Optional(Type.Union([Type.Literal("web"), Type.Literal("android"), Type.Literal("ios"), Type.Literal("huawei")])),
});

export async function orderRoutes(app: FastifyInstance) {
  app.get("/payment-methods", { schema: { tags: ["Checkout"], summary: "Available payment methods" } }, async () => ({
    data: providers.map((p) => ({ id: p.id, name: p.name, description: p.description, kind: p.kind, enabled: p.enabled() })),
  }));

  /* Place order — validates stock atomically, works for guests & logged-in users */
  app.post(
    "/checkout",
    { preHandler: optionalAuth, config: { rateLimit: { max: 10, timeWindow: "1 minute" } }, schema: { tags: ["Checkout"], summary: "Place an order from a cart", body: checkoutBody } },
    async (req, reply) => {
      const body = req.body as {
        cartId: string;
        customer: { name: string; phone: string; email?: string };
        address: { city: string; area?: string; line1: string; postalCode?: string };
        notes?: string;
        paymentMethod: string;
        source?: string;
      };
      const phone = normalizePkPhone(body.customer.phone);
      if (!phone) throw badRequest("Please enter a valid mobile number, e.g. 0300 1234567", "invalid_phone");
      const provider = getProvider(body.paymentMethod);
      if (!provider) throw badRequest("This payment method is not available", "invalid_payment_method");
      if (provider.id === "cod" && (await isBlocked(phone)))
        throw badRequest("Cash on delivery isn't available for this number. Please message us on WhatsApp to place your order.", "cod_blocked");

      const result = await db.transaction(async (tx) => {
        const cart = await computeCart(body.cartId, tx);
        if (!cart.items.length) throw badRequest("Your cart is empty", "empty_cart");
        const problem = cart.items.find((i) => i.issue);
        if (problem)
          throw new ApiError(409, "stock_changed", problem.issue === "missing_photo" ? `Please upload your photo for ${problem.product.name}` : `${problem.product.name} (${[problem.model?.name, problem.color.name].filter(Boolean).join(", ")}) is ${problem.issue === "out_of_stock" ? "out of stock" : `limited to ${problem.stock}`}`, { itemId: problem.id });
        if (provider.id === "cod" && cart.totals.total > store.cod.maxOrderTotal)
          throw badRequest(`Cash on delivery is available up to ${store.currencySymbol}${store.cod.maxOrderTotal}`, "cod_limit");

        // reserve stock — the WHERE stock >= qty guard prevents overselling under load
        for (const i of cart.items) {
          const [r] = await tx
            .update(s.variants)
            .set({ stock: sql`${s.variants.stock} - ${i.qty}` })
            .where(and(eq(s.variants.id, i.variantId), sql`${s.variants.stock} >= ${i.qty}`));
          if ((r as any)?.affectedRows !== 1 && (r as any)?.rowsAffected !== 1) throw new ApiError(409, "stock_changed", `${i.product.name} just sold out${i.model ? ` for ${i.model.name}` : ""}`);
        }

        const codFee = provider.id === "cod" ? cart.totals.codFee : 0;
        const [createdRes] = await tx
          .insert(s.orders)
          .values({
            number: `TMP-${nanoid(12)}`, // replaced with MG1000xx below (id-based, collision-free)
            accessToken: nanoid(32),
            userId: req.user?.id ?? null,
            paymentMethod: provider.id,
            customerName: body.customer.name.trim(),
            customerPhone: phone,
            customerEmail: body.customer.email || null,
            city: body.address.city,
            area: body.address.area || null,
            line1: body.address.line1.trim(),
            postalCode: body.address.postalCode || null,
            notes: body.notes || null,
            subtotal: cart.totals.subtotal,
            discount: cart.totals.discount,
            shipping: cart.totals.shipping,
            codFee,
            total: cart.totals.total + codFee,
            couponCode: cart.coupon?.code ?? null,
            source: body.source ?? "web",
            openParcel: store.labels.openParcelDefault,
          });
        const orderId = createdRes.insertId;
        const orderNumber = `MG${100000 + orderId}`;
        await tx
          .update(s.orders)
          .set({ number: orderNumber })
          .where(eq(s.orders.id, orderId));
        const [order] = await tx.select().from(s.orders).where(eq(s.orders.id, orderId));

        await tx.insert(s.orderItems).values(
          cart.items.map((i) => ({
            orderId: order.id,
            variantId: i.variantId,
            productId: i.product.id,
            productSlug: i.product.slug,
            productName: i.product.name,
            modelName: i.model?.name ?? "",
            colorName: i.color.name,
            colorHex: i.color.hex,
            sku: i.sku,
            unitPrice: i.unitPrice,
            qty: i.qty,
            lineTotal: i.lineTotal,
            category: i.category,
            material: i.product.material,
            custom: i.custom,
          })),
        );
        await tx.insert(s.orderEvents).values({ orderId: order.id, status: "pending", note: provider.id === "cod" ? "Cash on delivery" : null });
        await tx.insert(s.payments).values({ orderId: order.id, provider: provider.id, amount: order.total });
        if (cart.coupon) await tx.update(s.coupons).set({ usedCount: sql`${s.coupons.usedCount} + 1` }).where(eq(s.coupons.code, cart.coupon.code));
        const qtyByProduct = new Map<number, number>();
        for (const i of cart.items) qtyByProduct.set(i.product.id, (qtyByProduct.get(i.product.id) ?? 0) + i.qty);
        for (const [pid, q] of qtyByProduct) await tx.update(s.products).set({ soldCount: sql`${s.products.soldCount} + ${q}` }).where(eq(s.products.id, pid));
        await tx.delete(s.cartItems).where(eq(s.cartItems.cartId, body.cartId));
        await tx.update(s.carts).set({ couponCode: null }).where(eq(s.carts.id, body.cartId));
        return order;
      });

      invalidate("catalog:product");
      const payment = await provider.initiate({
        id: result.id,
        number: result.number,
        total: result.total,
        customerName: result.customerName,
        customerPhone: result.customerPhone,
        customerEmail: result.customerEmail,
      });
      const full = await loadOrder(eq(s.orders.id, result.id));
      reply.code(201);
      return { data: { order: presentOrder(full!, true), payment } };
    },
  );

  /* Order detail — by guest access token or as the logged-in owner */
  app.get(
    "/orders/:number",
    {
      preHandler: optionalAuth,
      schema: { tags: ["Orders"], summary: "Order detail (pass ?token= for guest orders)", params: Type.Object({ number: Type.String() }), querystring: Type.Object({ token: Type.Optional(Type.String()) }) },
    },
    async (req) => {
      const { number } = req.params as { number: string };
      const { token } = req.query as { token?: string };
      const full = await loadOrder(eq(s.orders.number, number.toUpperCase()));
      if (!full) throw notFound("Order");
      const ok = (token && token === full.order.accessToken) || (req.user && (req.user.id === full.order.userId || req.user.role === "admin"));
      if (!ok) throw notFound("Order");
      return { data: presentOrder(full) };
    },
  );

  /* Public tracking with order number + phone */
  app.post(
    "/orders/track",
    {
      config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
      schema: { tags: ["Orders"], summary: "Track an order with number + phone", body: Type.Object({ number: Type.String(), phone: Type.String() }) },
    },
    async (req) => {
      const { number, phone } = req.body as { number: string; phone: string };
      const p = normalizePkPhone(phone);
      const full = await loadOrder(eq(s.orders.number, number.trim().toUpperCase()));
      if (!full || !p || full.order.customerPhone !== p) throw notFound("Order");
      return { data: presentOrder(full) };
    },
  );

  app.post(
    "/orders/:number/cancel",
    {
      preHandler: optionalAuth,
      schema: { tags: ["Orders"], summary: "Cancel an order that hasn't shipped", params: Type.Object({ number: Type.String() }), body: Type.Object({ token: Type.Optional(Type.String()), reason: Type.Optional(Type.String({ maxLength: 300 })) }) },
    },
    async (req) => {
      const { number } = req.params as { number: string };
      const { token, reason } = (req.body ?? {}) as { token?: string; reason?: string };
      const full = await loadOrder(eq(s.orders.number, number.toUpperCase()));
      if (!full) throw notFound("Order");
      const ok = (token && token === full.order.accessToken) || (req.user && req.user.id === full.order.userId);
      if (!ok) throw unauthorized();
      if (!["pending", "confirmed"].includes(full.order.status)) throw badRequest("This order can no longer be cancelled", "not_cancellable");
      await db.update(s.orders).set({ status: "cancelled", updatedAt: new Date() }).where(eq(s.orders.id, full.order.id));
      await db.insert(s.orderEvents).values({ orderId: full.order.id, status: "cancelled", note: reason ? `Cancelled by customer: ${reason}` : "Cancelled by customer" });
      await restock(full.order.id);
      invalidate("catalog:product");
      return { data: presentOrder((await loadOrder(eq(s.orders.id, full.order.id)))!) };
    },
  );

  app.get(
    "/me/orders",
    { preHandler: requireAuth, schema: { tags: ["Account"], summary: "My orders", security: [{ bearerAuth: [] }] } },
    async (req) => {
      const [me] = await db.select().from(s.users).where(eq(s.users.id, req.user.id));
      if (me) await claimGuestOrders(me);
      const rows = await db.select().from(s.orders).where(eq(s.orders.userId, req.user.id)).orderBy(desc(s.orders.createdAt)).limit(100);
      const items = rows.length
        ? await db.select().from(s.orderItems).where(inArray(s.orderItems.orderId, rows.map((r) => r.id)))
        : [];
      return {
        data: rows.map((o) => ({
          number: o.number,
          status: o.status,
          statusLabel: STATUS_LABEL[o.status],
          total: o.total,
          paymentMethod: o.paymentMethod,
          createdAt: o.createdAt,
          items: items.filter((i) => i.orderId === o.id).map((i) => ({ productName: i.productName, modelName: i.modelName, colorName: i.colorName, colorHex: i.colorHex, qty: i.qty })),
        })),
      };
    },
  );

  /* Payment gateway callbacks (JazzCash etc.) — verified by the provider */
  app.post(
    "/payments/:provider/callback",
    { schema: { tags: ["Checkout"], summary: "Payment gateway callback / webhook", params: Type.Object({ provider: Type.String() }) } },
    async (req) => {
      const { provider: id } = req.params as { provider: string };
      const provider = providers.find((p) => p.id === id);
      if (!provider?.verifyCallback) throw notFound("Provider");
      const result = await provider.verifyCallback(req.body as Record<string, string>);
      const [o] = await db.select().from(s.orders).where(eq(s.orders.number, result.orderNumber));
      if (!o) throw notFound("Order");
      await db.update(s.payments).set({ status: result.paid ? "paid" : "failed", reference: result.reference, payload: result.raw, updatedAt: new Date() }).where(eq(s.payments.orderId, o.id));
      if (result.paid) {
        await db.update(s.orders).set({ paymentStatus: "paid", status: "confirmed", updatedAt: new Date() }).where(eq(s.orders.id, o.id));
        await db.insert(s.orderEvents).values({ orderId: o.id, status: "confirmed", note: `Paid via ${provider.name}` });
      }
      return { data: { orderNumber: o.number, paid: result.paid } };
    },
  );
}
