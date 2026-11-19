import type { FastifyInstance } from "fastify";
import { Type } from "typebox";
import { and, asc, desc, eq, inArray, isNull, like, or, sql, exists, type SQL } from "drizzle-orm";
import { db } from "../db/client";
import * as s from "../db/schema";
import { cached } from "../lib/cache";
import { notFound } from "../lib/errors";
import { normalize } from "../lib/text";
import { store } from "../config";
import { paymentMethods } from "../payments";
import { getCodSettings, getLeadCaptureSettings, getLoyaltySettings } from "./cart";
import { phoneDetails } from "../lib/phoneDetails";
import type { CameraSpec } from "../lib/types";

const CACHE_HEADER = "public, max-age=60, s-maxage=60, stale-while-revalidate=600";

/* ───────── shared loaders (also used by other modules) ───────── */

export async function loadModels() {
  return cached("catalog:models", async () => {
    const rows = await db
      .select({
        id: s.phoneModels.id,
        slug: s.phoneModels.slug,
        name: s.phoneModels.name,
        year: s.phoneModels.year,
        popular: s.phoneModels.popular,
        isHero: s.phoneModels.isHero,
        model3dUrl: s.phoneModels.model3dUrl,
        searchText: s.phoneModels.searchText,
        heightMm: s.phoneModels.heightMm,
        widthMm: s.phoneModels.widthMm,
        depthMm: s.phoneModels.depthMm,
        cornerRadiusMm: s.phoneModels.cornerRadiusMm,
        camera: s.phoneModels.camera,
        bodyHex: s.phoneModels.bodyHex,
        details: s.phoneModels.details,
        brandId: s.brands.id,
        brandSlug: s.brands.slug,
        brandName: s.brands.name,
      })
      .from(s.phoneModels)
      .innerJoin(s.brands, eq(s.brands.id, s.phoneModels.brandId))
      .where(and(eq(s.phoneModels.active, true), eq(s.brands.active, true)))
      .orderBy(asc(s.brands.sort), asc(s.phoneModels.sort));
    return rows;
  });
}

type ModelRow = Awaited<ReturnType<typeof loadModels>>[number];

/** camera layout family for thumbnails: bar | visor | plateau | floating | circle | circle-left */
export function layoutOf(cam: CameraSpec, widthMm: number): string {
  if (cam.type === "plateau" && cam.w && cam.r && cam.r >= cam.w / 2 - 0.5) {
    const cx = (cam.x ?? 0) + cam.w / 2;
    return Math.abs(cx - widthMm / 2) < 6 ? "circle" : "circle-left";
  }
  // Pixel-style pill "visor" across the back
  if (cam.type === "bar" && cam.h && cam.r && cam.r >= cam.h / 2 - 0.5) return "visor";
  return cam.type;
}

const publicModel = (m: ModelRow) => ({
  id: m.id,
  slug: m.slug,
  name: m.name,
  year: m.year,
  popular: m.popular,
  isHero: m.isHero,
  model3dUrl: m.model3dUrl,
  /** camera layout family — lets apps draw a matching thumbnail without the full spec */
  layout: layoutOf(m.camera as CameraSpec, m.widthMm),
  bodyHex: m.bodyHex,
  brand: { slug: m.brandSlug, name: m.brandName },
});

const modelSpec = (m: ModelRow) => ({
  heightMm: m.heightMm,
  widthMm: m.widthMm,
  depthMm: m.depthMm,
  cornerRadiusMm: m.cornerRadiusMm,
  camera: m.camera,
  bodyHex: m.bodyHex,
  model3dUrl: m.model3dUrl,
  /** buttons & ports for the 3D model (brand defaults + overrides) */
  details: phoneDetails(m.brandSlug, m.name, m.year, m.heightMm, m.details),
});

/** Ranked phone-model search: exact/prefix matches first, then popular, then newest. */
export function searchModels(models: ModelRow[], q: string, brand?: string, limit = 12) {
  const nq = normalize(q);
  const tokens = q.toLowerCase().split(/\s+/).map(normalize).filter(Boolean);
  const scored: { m: ModelRow; score: number }[] = [];
  for (const m of models) {
    if (brand && m.brandSlug !== brand) continue;
    if (!nq) {
      scored.push({ m, score: (m.popular ? 50 : 0) + m.year });
      continue;
    }
    const words = m.searchText.split(" ");
    let score = 0;
    if (words.some((w) => w === nq)) score += 1000;
    else if (words.some((w) => w.startsWith(nq))) score += 500;
    else if (m.searchText.includes(nq)) score += 200;
    else if (tokens.length > 1 && tokens.every((t) => m.searchText.includes(t))) score += 150;
    else continue;
    // prefer shorter names when the query is a prefix ("s25" → S25 before S25 Ultra)
    score -= normalize(m.name).length;
    if (m.popular) score += 20;
    score += (m.year - 2000) / 10;
    scored.push({ m, score });
  }
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.m);
}

async function colorsFor(productIds: number[]) {
  if (!productIds.length) return new Map<number, { id: number; name: string; hex: string; accentHex: string | null; designUrl: string | null }[]>();
  const rows = await db
    .select({ id: s.productColors.id, productId: s.productColors.productId, name: s.productColors.name, hex: s.productColors.hex, accentHex: s.productColors.accentHex, designUrl: s.productColors.designUrl })
    .from(s.productColors)
    .where(inArray(s.productColors.productId, productIds))
    .orderBy(asc(s.productColors.sort));
  const map = new Map<number, { id: number; name: string; hex: string; accentHex: string | null; designUrl: string | null }[]>();
  for (const r of rows) {
    const list = map.get(r.productId) ?? [];
    list.push({ id: r.id, name: r.name, hex: r.hex, accentHex: r.accentHex, designUrl: r.designUrl });
    map.set(r.productId, list);
  }
  return map;
}

const listQuery = Type.Object({
  q: Type.Optional(Type.String({ maxLength: 80 })),
  category: Type.Optional(Type.String({ description: "category or section slug; several comma-separated" })),
  slugs: Type.Optional(Type.String({ maxLength: 1200, description: "comma-separated product slugs (recently viewed)" })),
  model: Type.Optional(Type.String({ description: "phone model slug — only products available for it" })),
  material: Type.Optional(Type.String()),
  featured: Type.Optional(Type.Boolean()),
  sort: Type.Optional(
    Type.Union([Type.Literal("popular"), Type.Literal("newest"), Type.Literal("price_asc"), Type.Literal("price_desc"), Type.Literal("rating")]),
  ),
  page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 60, default: 24 })),
});

export async function catalogRoutes(app: FastifyInstance) {
  /* store settings for apps */
  app.get("/store", { schema: { tags: ["Store"], summary: "Store settings: currency, shipping, cities, payment methods" } }, async (_req, reply) => {
    reply.header("cache-control", CACHE_HEADER);
    const [codSettings, leadCapture, loyalty] = await Promise.all([getCodSettings(), getLeadCaptureSettings(), getLoyaltySettings()]);
    const methods = paymentMethods().map((m) => {
      if (m.id === "cod") {
        return {
          ...m,
          enabled: codSettings.enabled,
        };
      }
      if (m.id === "card") {
        return {
          ...m,
          name: codSettings.cardTitle || "Debit / Credit Card",
          description: "Visa, Mastercard, UnionPay, PayPak.",
          enabled: codSettings.cardEnabled ?? true,
        };
      }
      if (m.id === "jazzcash") {
        return {
          ...m,
          name: codSettings.jazzcashTitle || "JazzCash",
          description: "Pay with your JazzCash account or app.",
          enabled: codSettings.jazzcashEnabled ?? true,
        };
      }
      if (m.id === "easypaisa") {
        return {
          ...m,
          name: codSettings.easypaisaTitle || "Easypaisa",
          description: "Pay with your Easypaisa account or app.",
          enabled: codSettings.easypaisaEnabled ?? true,
        };
      }
      if (m.id === "bank") {
        return {
          ...m,
          name: codSettings.bankTitle ? `Bank: ${codSettings.bankTitle}` : "Direct Bank Transfer",
          description: "Transfer via online banking or Raast.",
          enabled: codSettings.bankEnabled ?? true,
        };
      }
      if (m.id === "payoneer") {
        return {
          ...m,
          name: codSettings.payoneerTitle || m.name,
          enabled: codSettings.payoneerEnabled,
        };
      }
      return m;
    });

    return {
      data: {
        ...store,
        cod: {
          ...store.cod,
          enabled: codSettings.enabled,
          threshold: codSettings.threshold,
          feeBelow: codSettings.feeBelow,
          feeAbove: codSettings.feeAbove,
          cityRestriction: codSettings.cityRestriction,
          allowedCities: codSettings.allowedCities,
          nonCodNotice: codSettings.nonCodNotice,
        },
        card: {
          enabled: codSettings.cardEnabled ?? true,
          title: codSettings.cardTitle || "Debit / Credit Card",
          instructions: codSettings.cardInstructions || "Pay securely with any Visa, Mastercard, UnionPay or PayPak debit/credit card.",
        },
        jazzcashDetails: {
          enabled: codSettings.jazzcashEnabled ?? true,
          title: codSettings.jazzcashTitle || "JazzCash",
          accountTitle: codSettings.jazzcashAccountTitle || "",
          accountNumber: codSettings.jazzcashAccountNumber || "",
          instructions: codSettings.jazzcashInstructions || "Send payment to our JazzCash account and enter your TID / sender mobile below.",
        },
        easypaisaDetails: {
          enabled: codSettings.easypaisaEnabled ?? true,
          title: codSettings.easypaisaTitle || "Easypaisa",
          accountTitle: codSettings.easypaisaAccountTitle || "",
          accountNumber: codSettings.easypaisaAccountNumber || "",
          instructions: codSettings.easypaisaInstructions || "Send payment to our Easypaisa account and enter your TID / sender mobile below.",
        },
        bankDetails: {
          enabled: codSettings.bankEnabled ?? true,
          bankTitle: codSettings.bankTitle || "",
          accountTitle: codSettings.bankTitle || "",
          accountNumber: codSettings.bankAccount || "",
          iban: codSettings.bankIban || "",
          instructions: codSettings.bankInstructions || "Transfer the total amount via online banking / Raast and share your receipt on WhatsApp.",
        },
        payoneer: {
          enabled: codSettings.payoneerEnabled,
          title: codSettings.payoneerTitle,
          email: codSettings.payoneerEmail,
          link: codSettings.payoneerLink,
          instructions: codSettings.payoneerInstructions,
          bankTitle: codSettings.bankTitle,
          bankAccount: codSettings.bankAccount,
          bankIban: codSettings.bankIban,
        },
        safepay: {
          enabled: codSettings.safepayEnabled,
          apiKey: codSettings.safepayApiKey,
          env: codSettings.safepayEnv,
        },
        jazzcash: {
          enabled: codSettings.jazzcashEnabled,
          merchantId: codSettings.jazzcashMerchantId,
          env: codSettings.jazzcashEnv,
        },
        leadCapture,
        loyalty,
        paymentMethods: methods,
      },
    };
  });

  /* public lead capture settings */
  app.get("/lead-capture-settings", { schema: { tags: ["Store"], summary: "Public lead capture popup settings" } }, async (_req, reply) => {
    reply.header("cache-control", CACHE_HEADER);
    const leadCapture = await getLeadCaptureSettings();
    return { data: leadCapture };
  });

  /* public loyalty / magora coins settings */
  app.get("/loyalty-settings", { schema: { tags: ["Store"], summary: "Public Magora Coins & Loyalty settings" } }, async (_req, reply) => {
    reply.header("cache-control", CACHE_HEADER);
    const loyalty = await getLoyaltySettings();
    return { data: loyalty };
  });

  /* brands with their models — powers the brand → model picker */
  app.get("/brands", { schema: { tags: ["Catalog"], summary: "Brands with their phone models" } }, async (_req, reply) => {
    reply.header("cache-control", CACHE_HEADER);
    const models = await loadModels();
    const byBrand = new Map<string, { slug: string; name: string; models: ReturnType<typeof publicModel>[] }>();
    for (const m of models) {
      const b = byBrand.get(m.brandSlug) ?? { slug: m.brandSlug, name: m.brandName, models: [] };
      b.models.push(publicModel(m));
      byBrand.set(m.brandSlug, b);
    }
    return { data: [...byBrand.values()] };
  });

  /* model search with suggestions: "s25u", "16 pro max", "SM-S938B" */
  app.get(
    "/phone-models",
    {
      schema: {
        tags: ["Catalog"],
        summary: "Search phone models (typo-tolerant, supports model numbers)",
        querystring: Type.Object({
          q: Type.Optional(Type.String({ maxLength: 40 })),
          brand: Type.Optional(Type.String()),
          limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50, default: 12 })),
        }),
      },
    },
    async (req, reply) => {
      const { q = "", brand, limit = 12 } = req.query as { q?: string; brand?: string; limit?: number };
      reply.header("cache-control", CACHE_HEADER);
      const models = await loadModels();
      return { data: searchModels(models, q, brand, limit).map(publicModel) };
    },
  );

  app.get(
    "/phone-models/:slug",
    { schema: { tags: ["Catalog"], summary: "Phone model with physical spec (for 3D preview)", params: Type.Object({ slug: Type.String() }) } },
    async (req, reply) => {
      const { slug } = req.params as { slug: string };
      const m = (await loadModels()).find((x) => x.slug === slug);
      if (!m) throw notFound("Phone model");
      reply.header("cache-control", CACHE_HEADER);
      return { data: { ...publicModel(m), spec: modelSpec(m) } };
    },
  );

  app.get("/categories", { schema: { tags: ["Catalog"] } }, async (_req, reply) => {
    reply.header("cache-control", CACHE_HEADER);
    const data = await cached("catalog:categories", () => db.select().from(s.categories).orderBy(asc(s.categories.sort)));
    return { data };
  });

  /* paginated product listing */
  app.get("/products", { schema: { tags: ["Catalog"], summary: "List products (filter, sort, paginate)", querystring: listQuery } }, async (req, reply) => {
    const q = req.query as {
      q?: string; category?: string; slugs?: string; model?: string; material?: string; featured?: boolean;
      sort?: string; page?: number; limit?: number;
    };
    const page = q.page ?? 1;
    const limit = q.limit ?? 24;
    const key = `catalog:products:${JSON.stringify(q)}`;
    reply.header("cache-control", CACHE_HEADER);

    return cached(key, async () => {
      const where: SQL[] = [eq(s.products.active, true)];
      if (q.q) where.push(like(s.products.name, `%${q.q.replace(/[%_]/g, "")}%`));
      if (q.material) where.push(eq(s.products.material, q.material));
      if (q.slugs) where.push(inArray(s.products.slug, q.slugs.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 40)));
      if (q.featured) where.push(eq(s.products.featured, true));
      if (q.category) {
        // a category slug ("earbuds") or a whole section ("gadgets", "skins")
        const want = q.category.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 10);
        const cats = await db
          .select({ id: s.categories.id })
          .from(s.categories)
          .where(or(inArray(s.categories.slug, want), inArray(s.categories.section, want)));
        if (!cats.length) return { data: [], meta: { page, limit, total: 0, hasMore: false } };
        where.push(inArray(s.products.categoryId, cats.map((c) => c.id)));
      }
      if (q.model) {
        const m = (await loadModels()).find((x) => x.slug === q.model);
        if (!m) return { data: [], meta: { page, limit, total: 0, hasMore: false } };
        where.push(
          exists(
            db
              .select({ one: sql`1` })
              .from(s.variants)
              // universal products (gadgets) fit every phone
              .where(and(eq(s.variants.productId, s.products.id), or(eq(s.variants.phoneModelId, m.id), isNull(s.variants.phoneModelId)), eq(s.variants.active, true))),
          ),
        );
      }
      const order =
        q.sort === "price_asc" ? [asc(s.products.minPrice)]
        : q.sort === "price_desc" ? [desc(s.products.minPrice)]
        : q.sort === "newest" ? [desc(s.products.createdAt)]
        : q.sort === "rating" ? [desc(s.products.ratingAvg), desc(s.products.ratingCount)]
        : [desc(s.products.featured), desc(s.products.soldCount), asc(s.products.id)];

      const [rows, [{ total }]] = await Promise.all([
        db
          .select({
            id: s.products.id,
            slug: s.products.slug,
            name: s.products.name,
            brand: s.products.brand,
            subtitle: s.products.subtitle,
            material: s.products.material,
            badge: s.products.badge,
            price: s.products.minPrice,
            compareAtPrice: s.products.compareAtPrice,
            ratingAvg: s.products.ratingAvg,
            ratingCount: s.products.ratingCount,
            category: s.categories.slug,
            section: s.categories.section,
            images: s.products.images,
            view: s.products.view,
          })
          .from(s.products)
          .innerJoin(s.categories, eq(s.categories.id, s.products.categoryId))
          .where(and(...where))
          .orderBy(...order)
          .limit(limit)
          .offset((page - 1) * limit),
        db.select({ total: sql<number>`count(*)` }).from(s.products).where(and(...where)),
      ]);
      const colors = await colorsFor(rows.map((r) => r.id));
      return {
        data: rows.map((r) => ({ ...r, colors: colors.get(r.id) ?? [] })),
        meta: { page, limit, total, hasMore: page * limit < total },
      };
    });
  });

  /* full product: colours, every compatible model (with 3D spec) and variant matrix */
  app.get(
    "/products/:slug",
    { schema: { tags: ["Catalog"], summary: "Product detail with models, colours, variants", params: Type.Object({ slug: Type.String() }) } },
    async (req, reply) => {
      const { slug } = req.params as { slug: string };
      reply.header("cache-control", CACHE_HEADER);
      return cached(`catalog:product:${slug}`, async () => {
        const [p] = await db.select().from(s.products).where(and(eq(s.products.slug, slug), eq(s.products.active, true)));
        if (!p) throw notFound("Product");
        const [colors, variantRows, models] = await Promise.all([
          db
            .select({ id: s.productColors.id, name: s.productColors.name, hex: s.productColors.hex, accentHex: s.productColors.accentHex, designUrl: s.productColors.designUrl })
            .from(s.productColors)
            .where(eq(s.productColors.productId, p.id))
            .orderBy(asc(s.productColors.sort)),
          db
            .select({
              id: s.variants.id,
              modelId: s.variants.phoneModelId,
              colorId: s.variants.colorId,
              sku: s.variants.sku,
              price: s.variants.price,
              compareAtPrice: s.variants.compareAtPrice,
              stock: s.variants.stock,
            })
            .from(s.variants)
            .where(and(eq(s.variants.productId, p.id), eq(s.variants.active, true))),
          loadModels(),
        ]);
        const modelIds = new Set(variantRows.map((v) => v.modelId));
        const compatible = models
          .filter((m) => modelIds.has(m.id))
          .map((m) => {
            const vs = variantRows.filter((v) => v.modelId === m.id);
            return {
              ...publicModel(m),
              price: Math.min(...vs.map((v) => v.price)),
              inStock: vs.some((v) => v.stock > 0),
              spec: modelSpec(m),
            };
          });
        const { categoryId, active, createdAt, updatedAt, ...rest } = p;
        const [cat] = await db.select({ slug: s.categories.slug, name: s.categories.name, section: s.categories.section }).from(s.categories).where(eq(s.categories.id, categoryId));
        return {
          data: {
            ...rest,
            category: cat,
            colors,
            models: compatible,
            variants: variantRows.map((v) => ({ ...v, stock: Math.min(v.stock, 99), inStock: v.stock > 0 })),
          },
        };
      });
    },
  );

  /* header search: products + phone models in one call */
  app.get(
    "/search",
    { schema: { tags: ["Catalog"], summary: "Instant search", querystring: Type.Object({ q: Type.String({ minLength: 1, maxLength: 60 }) }) } },
    async (req, reply) => {
      const { q } = req.query as { q: string };
      reply.header("cache-control", CACHE_HEADER);
      return cached(`catalog:search:${q.toLowerCase()}`, async () => {
        const models = searchModels(await loadModels(), q, undefined, 6).map(publicModel);
        const words = q.split(/\s+/).filter((w) => w.length > 1).slice(0, 4);
        const products = words.length
          ? await db
              .select({ id: s.products.id, slug: s.products.slug, name: s.products.name, price: s.products.minPrice, material: s.products.material, category: s.categories.name, section: s.categories.section })
              .from(s.products)
              .innerJoin(s.categories, eq(s.categories.id, s.products.categoryId))
              .where(and(eq(s.products.active, true), ...words.map((w) => {
                const pat = `%${w.replace(/[%_]/g, "")}%`;
                // name, category ("earbuds", "power banks") or tagline
                return or(like(s.products.name, pat), like(s.categories.name, pat), like(s.products.subtitle, pat))!;
              })))
              .orderBy(desc(s.products.soldCount))
              .limit(6)
          : [];
        return { data: { models, products } };
      }, 30_000);
    },
  );

  /* active accessory brands / companies (Casetify, dbrand, Ronin, Spigen, Magora, etc.) */
  app.get("/product-brands", { schema: { tags: ["Catalog"], summary: "Active product brands & companies" } }, async () => {
    const rows = await db
      .select({ id: s.productBrands.id, slug: s.productBrands.slug, name: s.productBrands.name, description: s.productBrands.description, website: s.productBrands.website })
      .from(s.productBrands)
      .where(eq(s.productBrands.active, true))
      .orderBy(asc(s.productBrands.sort), asc(s.productBrands.name));
    return { data: rows };
  });

  /* active custom styles / materials */
  app.get("/custom-styles", { schema: { tags: ["Catalog"], summary: "Custom styles & materials" } }, async () => {
    const rows = await db
      .select()
      .from(s.customStyles)
      .where(eq(s.customStyles.active, true))
      .orderBy(asc(s.customStyles.sort));
    return { data: rows };
  });
}
