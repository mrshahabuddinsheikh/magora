import type { FastifyInstance } from "fastify";
import { Type } from "typebox";
import { desc, eq, like, or, sql } from "drizzle-orm";
import { db } from "../db/client";
import * as s from "../db/schema";
import { requireAdmin } from "../lib/auth";
import { badRequest, notFound } from "../lib/errors";
import { normalizePkPhone } from "./orders";

export async function leadsRoutes(app: FastifyInstance) {
  /* Public: capture or update customer lead / phone number */
  app.post(
    "/leads",
    {
      config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
      schema: {
        tags: ["Leads"],
        summary: "Capture customer phone number with behavioral insights",
        body: Type.Object({
          phone: Type.String({ minLength: 10, maxLength: 20 }),
          name: Type.Optional(Type.String({ maxLength: 100 })),
          email: Type.Optional(Type.String({ maxLength: 120 })),
          city: Type.Optional(Type.String({ maxLength: 80 })),
          source: Type.Optional(Type.String({ maxLength: 40 })), // lead_popup, cart_abandoned, etc.
          preferredModel: Type.Optional(Type.String({ maxLength: 80 })),
          interests: Type.Optional(Type.String({ maxLength: 200 })),
          cartValue: Type.Optional(Type.Integer({ minimum: 0 })),
          cartItemsSummary: Type.Optional(Type.String({ maxLength: 300 })),
          lastVisitedPage: Type.Optional(Type.String({ maxLength: 200 })),
          whatsappCommunityOptIn: Type.Optional(Type.Boolean()),
          notes: Type.Optional(Type.String({ maxLength: 500 })),
        }),
      },
    },
    async (req, reply) => {
      const b = req.body as any;
      const phone = normalizePkPhone(b.phone);
      if (!phone) {
        throw badRequest("Please enter a valid mobile number (e.g. 0300 1234567)", "invalid_phone");
      }

      // Check if lead already exists
      const [existing] = await db
        .select()
        .from(s.customerLeads)
        .where(eq(s.customerLeads.phone, phone));

      if (existing) {
        // Update with fresh intent / cart data
        await db
          .update(s.customerLeads)
          .set({
            name: b.name?.trim() || existing.name,
            email: b.email?.trim() || existing.email,
            city: b.city?.trim() || existing.city,
            preferredModel: b.preferredModel?.trim() || existing.preferredModel,
            interests: b.interests?.trim() || existing.interests,
            cartValue: b.cartValue !== undefined ? b.cartValue : existing.cartValue,
            cartItemsSummary: b.cartItemsSummary?.trim() || existing.cartItemsSummary,
            lastVisitedPage: b.lastVisitedPage?.trim() || existing.lastVisitedPage,
            visitCount: existing.visitCount + 1,
            whatsappCommunityOptIn: b.whatsappCommunityOptIn !== undefined ? b.whatsappCommunityOptIn : existing.whatsappCommunityOptIn,
            updatedAt: new Date(),
          })
          .where(eq(s.customerLeads.id, existing.id));

        return { data: { id: existing.id, phone, status: "updated" } };
      }

      // Insert new lead
      const [insertRes] = await db
        .insert(s.customerLeads)
        .values({
          phone,
          name: b.name?.trim() || null,
          email: b.email?.trim() || null,
          city: b.city?.trim() || null,
          source: b.source?.trim() || "lead_popup",
          preferredModel: b.preferredModel?.trim() || null,
          interests: b.interests?.trim() || null,
          cartValue: b.cartValue || 0,
          cartItemsSummary: b.cartItemsSummary?.trim() || null,
          lastVisitedPage: b.lastVisitedPage?.trim() || null,
          whatsappCommunityOptIn: b.whatsappCommunityOptIn !== false,
          notes: b.notes?.trim() || null,
        });

      reply.code(201);
      return { data: { id: insertRes.insertId, phone, status: "created" } };
    }
  );

  /* Admin: List leads with search, source filter, and metrics */
  app.get(
    "/admin/leads",
    {
      preHandler: requireAdmin,
      schema: {
        tags: ["Admin"],
        summary: "Get captured customer leads with behavioral data",
        querystring: Type.Object({
          q: Type.Optional(Type.String()),
          source: Type.Optional(Type.String()),
        }),
      },
    },
    async (req) => {
      const { q, source } = req.query as { q?: string; source?: string };

      let query = db.select().from(s.customerLeads);
      const conds = [];

      if (q && q.trim()) {
        const term = `%${q.trim()}%`;
        conds.push(
          or(
            like(s.customerLeads.phone, term),
            like(s.customerLeads.name, term),
            like(s.customerLeads.city, term),
            like(s.customerLeads.preferredModel, term)
          )
        );
      }

      if (source && source.trim()) {
        conds.push(eq(s.customerLeads.source, source.trim()));
      }

      if (conds.length > 0) {
        query = query.where(conds.length === 1 ? conds[0] : (or(...conds) as any)) as any;
      }

      const rows = await query.orderBy(desc(s.customerLeads.updatedAt));

      const stats = {
        totalLeads: rows.length,
        whatsappCommunityReady: rows.filter((r) => r.whatsappCommunityOptIn).length,
        cartAbandoned: rows.filter((r) => r.source === "cart_abandoned").length,
        totalPotentialValue: rows.reduce((sum, r) => sum + (r.cartValue || 0), 0),
      };

      return { data: rows, meta: stats };
    }
  );

  /* Admin: Export all customer leads directly as an Excel-ready CSV */
  app.get(
    "/admin/leads/export.csv",
    {
      preHandler: requireAdmin,
      schema: {
        tags: ["Admin"],
        summary: "Export customer leads and phone numbers as CSV (Excel formatted)",
      },
    },
    async (req, reply) => {
      const rows = await db
        .select()
        .from(s.customerLeads)
        .orderBy(desc(s.customerLeads.createdAt));

      // Build CSV with UTF-8 BOM so Excel opens Urdu/special chars properly
      const BOM = "\uFEFF";
      const headers = [
        "Customer Name",
        "Phone / WhatsApp",
        "WhatsApp Direct Link",
        "City",
        "Lead Source",
        "Preferred Phone Model",
        "Cart Value (PKR)",
        "Cart Items / Interests",
        "WhatsApp Community Opt-in",
        "Converted to Order",
        "Captured Date",
      ];

      const csvLines = [headers.join(",")];

      for (const r of rows) {
        const cleanPhone = r.phone.replace(/\D/g, "");
        const waNumber = cleanPhone.startsWith("0") ? `92${cleanPhone.slice(1)}` : cleanPhone;
        const waLink = `https://wa.me/${waNumber}`;

        const row = [
          `"${(r.name || "Customer").replace(/"/g, '""')}"`,
          `"${r.phone}"`,
          `"${waLink}"`,
          `"${(r.city || "Pakistan").replace(/"/g, '""')}"`,
          `"${r.source}"`,
          `"${(r.preferredModel || "—").replace(/"/g, '""')}"`,
          r.cartValue || 0,
          `"${(r.cartItemsSummary || r.interests || "—").replace(/"/g, '""')}"`,
          r.whatsappCommunityOptIn ? "YES" : "NO",
          r.convertedOrder ? "YES" : "NO",
          `"${new Date(r.createdAt).toLocaleDateString()}"`,
        ];
        csvLines.push(row.join(","));
      }

      const csvContent = BOM + csvLines.join("\r\n");

      reply
        .header("Content-Type", "text/csv; charset=utf-8")
        .header("Content-Disposition", `attachment; filename="magora_customers_whatsapp_${Date.now()}.csv"`)
        .send(csvContent);
    }
  );

  /* Admin: Delete lead */
  app.delete(
    "/admin/leads/:id",
    {
      preHandler: requireAdmin,
      schema: {
        tags: ["Admin"],
        params: Type.Object({ id: Type.Integer() }),
      },
    },
    async (req) => {
      const { id } = req.params as { id: number };
      await db.delete(s.customerLeads).where(eq(s.customerLeads.id, id));
      return { ok: true };
    }
  );
}
