import type { FastifyInstance } from "fastify";
import { Type } from "typebox";
import { eq, desc, asc, sql } from "drizzle-orm";
import { db } from "../db/client";
import * as s from "../db/schema";
import { requireAdmin } from "../lib/auth";
import { notFound, badRequest } from "../lib/errors";
import { nanoid } from "nanoid";

const reelBody = Type.Object({
  title: Type.String({ minLength: 2, maxLength: 200 }),
  caption: Type.Optional(Type.String({ maxLength: 1000 })),
  videoUrl: Type.String({ minLength: 5 }),
  thumbnailUrl: Type.Optional(Type.String()),
  productId: Type.Optional(Type.Integer()),
  productName: Type.Optional(Type.String()),
  productPrice: Type.Optional(Type.Integer()),
  productCompareAtPrice: Type.Optional(Type.Integer()),
  productSlug: Type.Optional(Type.String()),
  productImage: Type.Optional(Type.String()),
  phoneModel: Type.Optional(Type.String()),
  likesCount: Type.Optional(Type.Integer({ minimum: 0 })),
  commentsCount: Type.Optional(Type.Integer({ minimum: 0 })),
  sharesCount: Type.Optional(Type.Integer({ minimum: 0 })),
  active: Type.Optional(Type.Boolean()),
  sort: Type.Optional(Type.Integer()),
});

export async function reelRoutes(app: FastifyInstance) {
  /* Public: List active shoppable reels */
  app.get(
    "/reels",
    {
      schema: {
        tags: ["Reels"],
        summary: "List all active TikTok / Instagram style shoppable reels",
      },
    },
    async () => {
      const rows = await db
        .select()
        .from(s.shoppableReels)
        .where(eq(s.shoppableReels.active, true))
        .orderBy(asc(s.shoppableReels.sort), desc(s.shoppableReels.id));

      return { data: rows };
    },
  );

  /* Public: Get single reel by ID */
  app.get(
    "/reels/:id",
    {
      schema: {
        tags: ["Reels"],
        params: Type.Object({ id: Type.Integer() }),
      },
    },
    async (req) => {
      const { id } = req.params as { id: number };
      const [row] = await db.select().from(s.shoppableReels).where(eq(s.shoppableReels.id, id));
      if (!row) throw notFound("Reel");
      // Increment views count in background
      db.update(s.shoppableReels)
        .set({ viewsCount: sql`${s.shoppableReels.viewsCount} + 1` })
        .where(eq(s.shoppableReels.id, id))
        .catch(() => {});

      return { data: row };
    },
  );

  /* Public: Like a reel in real-time */
  app.post(
    "/reels/:id/like",
    {
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
      schema: {
        tags: ["Reels"],
        summary: "Like a reel (increments like counter)",
        params: Type.Object({ id: Type.Integer() }),
      },
    },
    async (req) => {
      const { id } = req.params as { id: number };
      await db
        .update(s.shoppableReels)
        .set({
          likesCount: sql`${s.shoppableReels.likesCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(s.shoppableReels.id, id));
      const [row] = await db.select().from(s.shoppableReels).where(eq(s.shoppableReels.id, id));

      if (!row) throw notFound("Reel");
      return { data: { id: row.id, likesCount: row.likesCount } };
    },
  );

  /* Public: Add a comment / review to a reel */
  app.post(
    "/reels/:id/comments",
    {
      config: { rateLimit: { max: 10, timeWindow: "5 minutes" } },
      schema: {
        tags: ["Reels"],
        summary: "Post a comment or review on a shoppable reel",
        params: Type.Object({ id: Type.Integer() }),
        body: Type.Object({
          author: Type.String({ minLength: 2, maxLength: 60 }),
          city: Type.Optional(Type.String({ maxLength: 60 })),
          rating: Type.Optional(Type.Integer({ minimum: 1, maximum: 5 })),
          text: Type.String({ minLength: 3, maxLength: 400 }),
        }),
      },
    },
    async (req) => {
      const { id } = req.params as { id: number };
      const { author, city, rating, text } = req.body as {
        author: string;
        city?: string;
        rating?: number;
        text: string;
      };

      const [row] = await db.select().from(s.shoppableReels).where(eq(s.shoppableReels.id, id));
      if (!row) throw notFound("Reel");

      const newComment: s.ReelComment = {
        id: nanoid(8),
        author: author.trim(),
        city: city?.trim() || "Pakistan",
        rating: rating ?? 5,
        text: text.trim(),
        likes: 1,
        timeAgo: "Just now",
        verifiedBuyer: true,
      };

      const comments = Array.isArray(row.comments) ? [...row.comments, newComment] : [newComment];

      await db
        .update(s.shoppableReels)
        .set({
          comments,
          commentsCount: comments.length,
          updatedAt: new Date(),
        })
        .where(eq(s.shoppableReels.id, id));
      const [updated] = await db.select().from(s.shoppableReels).where(eq(s.shoppableReels.id, id));

      return { data: updated };
    },
  );

  /* Admin: List all reels */
  app.get(
    "/admin/reels",
    {
      preHandler: requireAdmin,
      schema: {
        tags: ["Admin Reels"],
        security: [{ bearerAuth: [] }],
      },
    },
    async () => {
      const rows = await db
        .select()
        .from(s.shoppableReels)
        .orderBy(asc(s.shoppableReels.sort), desc(s.shoppableReels.id));
      return { data: rows };
    },
  );

  /* Admin: Create new shoppable reel */
  app.post(
    "/admin/reels",
    {
      preHandler: requireAdmin,
      schema: {
        tags: ["Admin Reels"],
        body: reelBody,
        security: [{ bearerAuth: [] }],
      },
    },
    async (req, reply) => {
      const b = req.body as {
        title: string;
        caption?: string;
        videoUrl: string;
        thumbnailUrl?: string;
        productId?: number;
        productName?: string;
        productPrice?: number;
        productCompareAtPrice?: number;
        productSlug?: string;
        productImage?: string;
        phoneModel?: string;
        likesCount?: number;
        commentsCount?: number;
        sharesCount?: number;
        active?: boolean;
        sort?: number;
      };

      if (!b.title || !b.videoUrl) throw badRequest("Title and Video URL are required");

      const [createdRes] = await db
        .insert(s.shoppableReels)
        .values({
          title: b.title.trim(),
          caption: b.caption?.trim() || null,
          videoUrl: b.videoUrl.trim(),
          thumbnailUrl: b.thumbnailUrl?.trim() || null,
          productId: b.productId ?? null,
          productName: b.productName?.trim() || null,
          productPrice: b.productPrice ?? null,
          productCompareAtPrice: b.productCompareAtPrice ?? null,
          productSlug: b.productSlug?.trim() || null,
          productImage: b.productImage?.trim() || null,
          phoneModel: b.phoneModel?.trim() || null,
          likesCount: b.likesCount ?? 15000,
          commentsCount: b.commentsCount ?? 45,
          sharesCount: b.sharesCount ?? 1200,
          active: b.active ?? true,
          sort: b.sort ?? 0,
        });
      const [created] = await db.select().from(s.shoppableReels).where(eq(s.shoppableReels.id, createdRes.insertId));

      reply.code(201);
      return { data: created };
    },
  );

  /* Admin: Update reel */
  app.put(
    "/admin/reels/:id",
    {
      preHandler: requireAdmin,
      schema: {
        tags: ["Admin Reels"],
        params: Type.Object({ id: Type.Integer() }),
        body: reelBody,
        security: [{ bearerAuth: [] }],
      },
    },
    async (req) => {
      const { id } = req.params as { id: number };
      const b = req.body as Partial<{
        title: string;
        caption: string;
        videoUrl: string;
        thumbnailUrl: string;
        productId: number;
        productName: string;
        productPrice: number;
        productCompareAtPrice: number;
        productSlug: string;
        productImage: string;
        phoneModel: string;
        likesCount: number;
        commentsCount: number;
        sharesCount: number;
        active: boolean;
        sort: number;
      }>;

      await db
        .update(s.shoppableReels)
        .set({
          ...b,
          updatedAt: new Date(),
        })
        .where(eq(s.shoppableReels.id, id));
      const [updated] = await db.select().from(s.shoppableReels).where(eq(s.shoppableReels.id, id));

      if (!updated) throw notFound("Reel");
      return { data: updated };
    },
  );

  /* Admin: Delete reel */
  app.delete(
    "/admin/reels/:id",
    {
      preHandler: requireAdmin,
      schema: {
        tags: ["Admin Reels"],
        params: Type.Object({ id: Type.Integer() }),
        security: [{ bearerAuth: [] }],
      },
    },
    async (req) => {
      const { id } = req.params as { id: number };
      const [existing] = await db.select().from(s.shoppableReels).where(eq(s.shoppableReels.id, id));
      if (!existing) throw notFound("Reel");
      await db.delete(s.shoppableReels).where(eq(s.shoppableReels.id, id));
      return { data: { success: true, id } };
    },
  );
}
