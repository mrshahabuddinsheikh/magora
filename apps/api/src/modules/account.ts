import type { FastifyInstance } from "fastify";
import { Type } from "typebox";
import { and, desc, eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "../db/client";
import * as s from "../db/schema";
import { ApiError, badRequest, notFound, unauthorized } from "../lib/errors";
import { optionalAuth, requireAuth, type JwtUser } from "../lib/auth";
import { claimGuestOrders, normalizePkPhone } from "./orders";
import { invalidate } from "../lib/cache";

const sec = [{ bearerAuth: [] }];

export async function accountRoutes(app: FastifyInstance) {
  const sign = (u: { id: number; role: string; name: string; email: string }) =>
    app.jwt.sign({ id: u.id, role: u.role as JwtUser["role"], name: u.name, email: u.email }, { expiresIn: "30d" });
  const publicUser = (u: typeof s.users.$inferSelect) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role });

  /* ───── auth ───── */
  app.post(
    "/auth/register",
    {
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
      schema: {
        tags: ["Auth"],
        summary: "Create account → returns JWT (send as Authorization: Bearer <token>)",
        body: Type.Object({
          name: Type.String({ minLength: 2, maxLength: 80 }),
          email: Type.String({ format: "email", maxLength: 120 }),
          phone: Type.Optional(Type.String({ maxLength: 20 })),
          password: Type.String({ minLength: 8, maxLength: 100 }),
        }),
      },
    },
    async (req, reply) => {
      const b = req.body as { name: string; email: string; phone?: string; password: string };
      const email = b.email.trim().toLowerCase();
      const phone = b.phone ? normalizePkPhone(b.phone) : null;
      if (b.phone && !phone) throw badRequest("Invalid mobile number", "invalid_phone");
      const [exists] = await db.select({ id: s.users.id }).from(s.users).where(eq(s.users.email, email));
      if (exists) throw new ApiError(409, "email_taken", "An account with this email already exists");
      const [insertRes] = await db
        .insert(s.users)
        .values({ name: b.name.trim(), email, phone, passwordHash: await bcrypt.hash(b.password, 10) });
      const [u] = await db.select().from(s.users).where(eq(s.users.id, insertRes.insertId));
      await claimGuestOrders(u); // earlier guest orders with this email / mobile show up in the account
      reply.code(201);
      return { data: { token: sign(u), user: publicUser(u) } };
    },
  );

  app.post(
    "/auth/login",
    {
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
      schema: { tags: ["Auth"], summary: "Log in → returns JWT", body: Type.Object({ email: Type.String(), password: Type.String() }) },
    },
    async (req) => {
      const { email, password } = req.body as { email: string; password: string };
      const [u] = await db.select().from(s.users).where(eq(s.users.email, email.trim().toLowerCase()));
      if (!u || !(await bcrypt.compare(password, u.passwordHash))) throw unauthorized("Email or password is incorrect");
      await claimGuestOrders(u);
      return { data: { token: sign(u), user: publicUser(u) } };
    },
  );

  app.get("/me", { preHandler: requireAuth, schema: { tags: ["Account"], security: sec } }, async (req) => {
    const [u] = await db.select().from(s.users).where(eq(s.users.id, req.user.id));
    if (!u) throw unauthorized();
    return { data: publicUser(u) };
  });

  app.patch(
    "/me",
    {
      preHandler: requireAuth,
      schema: {
        tags: ["Account"],
        security: sec,
        body: Type.Object({
          name: Type.Optional(Type.String({ minLength: 2, maxLength: 80 })),
          phone: Type.Optional(Type.String({ maxLength: 20 })),
          password: Type.Optional(Type.String({ minLength: 8, maxLength: 100 })),
        }),
      },
    },
    async (req) => {
      const b = req.body as { name?: string; phone?: string; password?: string };
      const set: Partial<typeof s.users.$inferInsert> = { updatedAt: new Date() };
      if (b.name) set.name = b.name.trim();
      if (b.phone) {
        const p = normalizePkPhone(b.phone);
        if (!p) throw badRequest("Invalid mobile number", "invalid_phone");
        set.phone = p;
      }
      if (b.password) set.passwordHash = await bcrypt.hash(b.password, 10);
      await db.update(s.users).set(set).where(eq(s.users.id, req.user.id));
      const [u] = await db.select().from(s.users).where(eq(s.users.id, req.user.id));
      return { data: publicUser(u) };
    },
  );

  app.get("/me/summary", { preHandler: requireAuth, schema: { tags: ["Account"], security: sec, summary: "Numbers for the account dashboard" } }, async (req) => {
    const [me] = await db.select().from(s.users).where(eq(s.users.id, req.user.id));
    if (me) await claimGuestOrders(me);
    const [o] = await db
      .select({
        orders: sql<number>`count(*)`,
        spent: sql<number>`coalesce(sum(case when ${s.orders.status} not in ('cancelled','returned') then ${s.orders.total} else 0 end),0)`,
        active: sql<number>`coalesce(sum(case when ${s.orders.status} in ('pending','confirmed','processing','shipped','out_for_delivery') then 1 else 0 end),0)`,
      })
      .from(s.orders)
      .where(eq(s.orders.userId, req.user.id));
    const [r] = await db
      .select({ n: sql<number>`count(*)` })
      .from(s.returnRequests)
      .innerJoin(s.orders, eq(s.orders.id, s.returnRequests.orderId))
      .where(and(eq(s.orders.userId, req.user.id), sql`${s.returnRequests.status} not in ('closed','rejected','refunded','exchanged')`));
    const [w] = await db.select({ n: sql<number>`count(*)` }).from(s.wishlist).where(eq(s.wishlist.userId, req.user.id));
    return { data: { orders: o.orders, totalSpent: o.spent, activeOrders: o.active, openReturns: r.n, wishlist: w.n, memberSince: me?.createdAt } };
  });

  /* ───── saved addresses ───── */
  const addressBody = Type.Object({
    label: Type.Optional(Type.String({ maxLength: 30 })),
    name: Type.String({ minLength: 2, maxLength: 80 }),
    phone: Type.String({ maxLength: 20 }),
    city: Type.String({ minLength: 2, maxLength: 60 }),
    area: Type.Optional(Type.String({ maxLength: 80 })),
    line1: Type.String({ minLength: 5, maxLength: 250 }),
    postalCode: Type.Optional(Type.String({ maxLength: 12 })),
    isDefault: Type.Optional(Type.Boolean()),
  });

  app.get("/me/addresses", { preHandler: requireAuth, schema: { tags: ["Account"], security: sec } }, async (req) => ({
    data: await db.select().from(s.addresses).where(eq(s.addresses.userId, req.user.id)).orderBy(desc(s.addresses.isDefault)),
  }));

  app.post("/me/addresses", { preHandler: requireAuth, schema: { tags: ["Account"], security: sec, body: addressBody } }, async (req, reply) => {
    const b = req.body as typeof s.addresses.$inferInsert;
    const phone = normalizePkPhone(b.phone);
    if (!phone) throw badRequest("Invalid mobile number", "invalid_phone");
    if (b.isDefault) await db.update(s.addresses).set({ isDefault: false }).where(eq(s.addresses.userId, req.user.id));
    const [insertRes] = await db.insert(s.addresses).values({ ...b, phone, userId: req.user.id });
    const [a] = await db.select().from(s.addresses).where(eq(s.addresses.id, insertRes.insertId));
    reply.code(201);
    return { data: a };
  });

  app.delete(
    "/me/addresses/:id",
    { preHandler: requireAuth, schema: { tags: ["Account"], security: sec, params: Type.Object({ id: Type.Integer() }) } },
    async (req) => {
      const { id } = req.params as { id: number };
      await db.delete(s.addresses).where(and(eq(s.addresses.id, id), eq(s.addresses.userId, req.user.id)));
      return { data: { ok: true } };
    },
  );

  /* ───── wishlist ───── */
  app.get("/me/wishlist", { preHandler: requireAuth, schema: { tags: ["Account"], security: sec } }, async (req) => ({
    data: await db
      .select({ id: s.products.id, slug: s.products.slug, name: s.products.name, price: s.products.minPrice, material: s.products.material })
      .from(s.wishlist)
      .innerJoin(s.products, eq(s.products.id, s.wishlist.productId))
      .where(eq(s.wishlist.userId, req.user.id))
      .orderBy(desc(s.wishlist.createdAt)),
  }));

  app.put(
    "/me/wishlist/:productId",
    { preHandler: requireAuth, schema: { tags: ["Account"], security: sec, params: Type.Object({ productId: Type.Integer() }) } },
    async (req) => {
      const { productId } = req.params as { productId: number };
      const [existing] = await db.select().from(s.wishlist).where(and(eq(s.wishlist.userId, req.user.id), eq(s.wishlist.productId, productId)));
      if (!existing) await db.insert(s.wishlist).values({ userId: req.user.id, productId });
      return { data: { ok: true } };
    },
  );

  app.delete(
    "/me/wishlist/:productId",
    { preHandler: requireAuth, schema: { tags: ["Account"], security: sec, params: Type.Object({ productId: Type.Integer() }) } },
    async (req) => {
      const { productId } = req.params as { productId: number };
      await db.delete(s.wishlist).where(and(eq(s.wishlist.userId, req.user.id), eq(s.wishlist.productId, productId)));
      return { data: { ok: true } };
    },
  );

  /* ───── reviews (moderated: visible after admin approval) ───── */
  app.get(
    "/products/:slug/reviews",
    {
      schema: {
        tags: ["Reviews"],
        params: Type.Object({ slug: Type.String() }),
        querystring: Type.Object({ page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })) }),
      },
    },
    async (req, reply) => {
      const { slug } = req.params as { slug: string };
      const page = (req.query as { page?: number }).page ?? 1;
      const [p] = await db.select({ id: s.products.id, ratingAvg: s.products.ratingAvg, ratingCount: s.products.ratingCount }).from(s.products).where(eq(s.products.slug, slug));
      if (!p) throw notFound("Product");
      const rows = await db
        .select({ id: s.reviews.id, name: s.reviews.name, rating: s.reviews.rating, title: s.reviews.title, body: s.reviews.body, verified: s.reviews.verified, photos: s.reviews.photos, adminReply: s.reviews.adminReply, createdAt: s.reviews.createdAt })
        .from(s.reviews)
        .where(and(eq(s.reviews.productId, p.id), eq(s.reviews.approved, true)))
        .orderBy(desc(s.reviews.createdAt))
        .limit(10)
        .offset((page - 1) * 10);
      // how many 5★, 4★ … (for the bars next to the average)
      const dist = await db
        .select({ rating: s.reviews.rating, n: sql<number>`count(*)` })
        .from(s.reviews)
        .where(and(eq(s.reviews.productId, p.id), eq(s.reviews.approved, true)))
        .groupBy(s.reviews.rating);
      const breakdown = [5, 4, 3, 2, 1].map((st) => ({ stars: st, n: Number(dist.find((d) => d.rating === st)?.n ?? 0) }));
      const withPhotos = page === 1 ? await db.select({ photos: s.reviews.photos }).from(s.reviews).where(and(eq(s.reviews.productId, p.id), eq(s.reviews.approved, true))).limit(200) : [];
      reply.header("cache-control", "public, max-age=60");
      return {
        data: rows,
        meta: {
          page, ratingAvg: p.ratingAvg, ratingCount: p.ratingCount, hasMore: rows.length === 10, breakdown,
          photos: withPhotos.flatMap((r) => r.photos ?? []).slice(0, 12),
        },
      };
    },
  );

  app.post(
    "/products/:slug/reviews",
    {
      preHandler: optionalAuth,
      config: { rateLimit: { max: 5, timeWindow: "10 minutes" } },
      schema: {
        tags: ["Reviews"],
        summary: "Submit a review (published after approval)",
        params: Type.Object({ slug: Type.String() }),
        body: Type.Object({
          name: Type.String({ minLength: 2, maxLength: 60 }),
          rating: Type.Integer({ minimum: 1, maximum: 5 }),
          title: Type.Optional(Type.String({ maxLength: 100 })),
          body: Type.String({ minLength: 5, maxLength: 1500 }),
        }),
      },
    },
    async (req, reply) => {
      const { slug } = req.params as { slug: string };
      const b = req.body as { name: string; rating: number; title?: string; body: string };
      const [p] = await db.select({ id: s.products.id }).from(s.products).where(eq(s.products.slug, slug));
      if (!p) throw notFound("Product");
      // verified buyer = logged-in user who has a delivered order with this product
      let verified = false;
      if (req.user) {
        const [hit] = await db
          .select({ one: sql`1` })
          .from(s.orderItems)
          .innerJoin(s.orders, eq(s.orders.id, s.orderItems.orderId))
          .where(and(eq(s.orders.userId, req.user.id), eq(s.orderItems.productId, p.id), eq(s.orders.status, "delivered")))
          .limit(1);
        verified = !!hit;
      }
      await db.insert(s.reviews).values({ productId: p.id, userId: req.user?.id ?? null, name: b.name.trim(), rating: b.rating, title: b.title, body: b.body.trim(), verified });
      invalidate("catalog:product");
      reply.code(201);
      return { data: { ok: true, message: "Thanks! Your review will appear after a quick check." } };
    },
  );
}
