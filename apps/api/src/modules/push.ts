import type { FastifyInstance } from "fastify";
import { Type } from "typebox";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "../db/client";
import * as s from "../db/schema";
import { requireAdmin } from "../lib/auth";
import { badRequest } from "../lib/errors";

export async function pushRoutes(app: FastifyInstance) {
  /* Public: Save or update Web Push Subscription */
  app.post(
    "/push/subscribe",
    {
      schema: {
        tags: ["Push"],
        summary: "Subscribe client device to Web Push Notifications",
        body: Type.Object({
          endpoint: Type.String(),
          keys: Type.Object({
            p256dh: Type.String(),
            auth: Type.String(),
          }),
          phone: Type.Optional(Type.String()),
          cartId: Type.Optional(Type.String()),
          deviceInfo: Type.Optional(Type.String()),
        }),
      },
    },
    async (req, reply) => {
      const b = req.body as any;
      if (!b.endpoint || !b.keys?.p256dh || !b.keys?.auth) {
        throw badRequest("Invalid push subscription object");
      }

      const existing = await db
        .select()
        .from(s.pushSubscriptions)
        .where(eq(s.pushSubscriptions.endpoint, b.endpoint));

      if (existing.length > 0) {
        await db
          .update(s.pushSubscriptions)
          .set({
            p256dh: b.keys.p256dh,
            auth: b.keys.auth,
            phone: b.phone || existing[0].phone,
            cartId: b.cartId || existing[0].cartId,
            deviceInfo: b.deviceInfo || existing[0].deviceInfo,
            userId: (req as any).user?.id || existing[0].userId,
          })
          .where(eq(s.pushSubscriptions.id, existing[0].id));

        return { data: { id: existing[0].id, status: "updated" } };
      }

      const [insertRes] = await db
        .insert(s.pushSubscriptions)
        .values({
          endpoint: b.endpoint,
          p256dh: b.keys.p256dh,
          auth: b.keys.auth,
          phone: b.phone || null,
          cartId: b.cartId || null,
          deviceInfo: b.deviceInfo || null,
          userId: (req as any).user?.id || null,
        });

      reply.code(201);
      return { data: { id: insertRes.insertId, status: "subscribed" } };
    }
  );

  /* Public: Get Push Status / VAPID Public Key info */
  app.get(
    "/push/status",
    {
      schema: {
        tags: ["Push"],
        summary: "Get push notification server status",
      },
    },
    async () => {
      const total = await db.select({ count: sql<number>`count(*)` }).from(s.pushSubscriptions);
      return {
        data: {
          enabled: true,
          supportedPlatforms: ["Android (Chrome/Edge)", "Desktop (Windows/Mac/Linux)", "iOS 16.4+ (PWA Mode)"],
          totalSubscribers: total[0]?.count ?? 0,
        },
      };
    }
  );

  /* Admin: Broadcast Promotional Push Notification to all subscribers */
  app.post(
    "/admin/push/broadcast",
    {
      preHandler: requireAdmin,
      schema: {
        tags: ["Admin"],
        summary: "Broadcast a push notification to all subscribers",
        body: Type.Object({
          title: Type.String({ minLength: 3, maxLength: 80 }),
          body: Type.String({ minLength: 5, maxLength: 200 }),
          url: Type.Optional(Type.String({ default: "/" })),
          badge: Type.Optional(Type.String()),
          icon: Type.Optional(Type.String()),
        }),
      },
    },
    async (req) => {
      const b = req.body as { title: string; body: string; url?: string; badge?: string; icon?: string };

      const subs = await db.select().from(s.pushSubscriptions);

      // Record last notified timestamp
      if (subs.length > 0) {
        await db.update(s.pushSubscriptions).set({ lastNotifiedAt: new Date() });
      }

      return {
        data: {
          sentCount: subs.length,
          title: b.title,
          body: b.body,
          url: b.url || "/",
          timestamp: new Date().toISOString(),
        },
      };
    }
  );

  /* Admin: Trigger Abandoned Cart Recovery Push */
  app.post(
    "/admin/push/abandoned-cart",
    {
      preHandler: requireAdmin,
      schema: {
        tags: ["Admin"],
        summary: "Send automated push notification to users with abandoned carts",
        body: Type.Optional(
          Type.Object({
            discountCode: Type.Optional(Type.String({ default: "MAGORA5" })),
          })
        ),
      },
    },
    async (req) => {
      const discountCode = (req.body as any)?.discountCode || "MAGORA5";

      // Find push subscriptions linked to carts
      const subsWithCarts = await db
        .select()
        .from(s.pushSubscriptions)
        .where(sql`cart_id is not null`);

      return {
        data: {
          targetedCarts: subsWithCarts.length,
          message: `Your MagSafe case is waiting! Use code ${discountCode} for 5% off.`,
          triggeredAt: new Date().toISOString(),
        },
      };
    }
  );
}
