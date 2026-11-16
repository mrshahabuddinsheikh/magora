/**
 * "Rate your order" — the link we WhatsApp to customers after delivery.
 * Only people who really received the order can review through it → "Verified buyer".
 */
import type { FastifyInstance } from "fastify";
import { Type } from "typebox";
import { and, eq, inArray } from "drizzle-orm";
import { timingSafeEqual } from "node:crypto";
import { db } from "../db/client";
import * as s from "../db/schema";
import { badRequest, notFound } from "../lib/errors";
import { invalidate } from "../lib/cache";
import { config } from "../config";

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

async function orderFor(number: string, token: string) {
  const [o] = await db.select().from(s.orders).where(eq(s.orders.number, number.toUpperCase()));
  if (!o || !token || !same(o.accessToken, token)) throw notFound("Order");
  if (o.status !== "delivered") throw badRequest("You can review once your order is delivered.", "not_delivered");
  return o;
}

/** "Ali Raza" → "Ali R." — how names show on reviews by default */
const shortName = (n: string) => {
  const [a, b] = n.trim().split(/\s+/);
  return b ? `${a} ${b[0].toUpperCase()}.` : a;
};

const reviewPhotoOk = (u: string) => u.startsWith(`${config.publicApiUrl}/uploads/`);

export async function reviewInviteRoutes(app: FastifyInstance) {
  app.get(
    "/review-invite/:number",
    {
      schema: {
        tags: ["Reviews"],
        summary: "Products in a delivered order that the customer can rate",
        params: Type.Object({ number: Type.String({ maxLength: 20 }) }),
        querystring: Type.Object({ t: Type.String({ maxLength: 80 }) }),
      },
    },
    async (req) => {
      const o = await orderFor((req.params as { number: string }).number, (req.query as { t: string }).t);
      const items = await db.select().from(s.orderItems).where(eq(s.orderItems.orderId, o.id));
      const done = await db.select({ productId: s.reviews.productId, rating: s.reviews.rating }).from(s.reviews).where(eq(s.reviews.orderId, o.id));
      const seen = new Set<number>();
      return {
        data: {
          number: o.number,
          name: shortName(o.customerName),
          thanksCoupon: process.env.REVIEW_THANKS_COUPON || null,
          items: items
            .filter((i) => i.productId && !seen.has(i.productId) && seen.add(i.productId))
            .map((i) => ({
              productId: i.productId!,
              slug: i.productSlug,
              name: i.productName,
              model: i.modelName,
              color: i.colorName,
              colorHex: i.colorHex,
              material: i.material,
              reviewed: done.find((d) => d.productId === i.productId)?.rating ?? null,
            })),
        },
      };
    },
  );

  app.post(
    "/review-invite/:number",
    {
      config: { rateLimit: { max: 10, timeWindow: "10 minutes" } },
      schema: {
        tags: ["Reviews"],
        summary: "Save the customer's ratings (shown after the store approves them)",
        params: Type.Object({ number: Type.String({ maxLength: 20 }) }),
        querystring: Type.Object({ t: Type.String({ maxLength: 80 }) }),
        body: Type.Object({
          name: Type.String({ minLength: 2, maxLength: 60 }),
          reviews: Type.Array(
            Type.Object({
              productId: Type.Integer(),
              rating: Type.Integer({ minimum: 1, maximum: 5 }),
              title: Type.Optional(Type.String({ maxLength: 100 })),
              body: Type.String({ minLength: 3, maxLength: 1500 }),
              photos: Type.Optional(Type.Array(Type.String({ maxLength: 300 }), { maxItems: 3 })),
            }),
            { minItems: 1, maxItems: 20 },
          ),
        }),
      },
    },
    async (req, reply) => {
      const o = await orderFor((req.params as { number: string }).number, (req.query as { t: string }).t);
      const b = req.body as { name: string; reviews: { productId: number; rating: number; title?: string; body: string; photos?: string[] }[] };
      const items = await db.select({ productId: s.orderItems.productId }).from(s.orderItems).where(eq(s.orderItems.orderId, o.id));
      const allowed = new Set(items.map((i) => i.productId));
      const already = await db
        .select({ productId: s.reviews.productId })
        .from(s.reviews)
        .where(and(eq(s.reviews.orderId, o.id), inArray(s.reviews.productId, b.reviews.map((r) => r.productId))));
      let saved = 0;
      for (const r of b.reviews) {
        if (!allowed.has(r.productId) || already.some((a) => a.productId === r.productId)) continue;
        await db.insert(s.reviews).values({
          productId: r.productId,
          userId: o.userId,
          orderId: o.id,
          name: b.name.trim(),
          rating: r.rating,
          title: r.title?.trim() || null,
          body: r.body.trim(),
          photos: (r.photos ?? []).filter(reviewPhotoOk),
          verified: true,
          approved: false,
        });
        saved++;
      }
      if (!saved) throw badRequest("These products are already reviewed — thank you!", "already_reviewed");
      invalidate("catalog:product");
      reply.code(201);
      return { data: { saved, thanksCoupon: process.env.REVIEW_THANKS_COUPON || null } };
    },
  );
}
