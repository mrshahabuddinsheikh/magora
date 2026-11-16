import type { FastifyInstance } from "fastify";
import { Type } from "typebox";
import { and, eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "../db/client";
import type { ItemCustom } from "../db/schema";
import * as s from "../db/schema";
import { config, store } from "../config";
import { badRequest, notFound } from "../lib/errors";
import { optionalAuth } from "../lib/auth";

type Tx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface CartLine {
  id: number;
  variantId: number;
  qty: number;
  unitPrice: number;
  compareAtPrice: number | null;
  lineTotal: number;
  stock: number;
  sku: string;
  product: { id: number; slug: string; name: string; material: string; image?: string | null; design?: string | null };
  model: { id: number; slug: string; name: string } | null;
  color: { id: number; name: string; hex: string };
  category: string;
  custom: ItemCustom | null;
  /** price of options (e.g. skin sides) included in unitPrice */
  extraPrice: number;
  issue?: "out_of_stock" | "insufficient_stock" | "missing_photo";
}

export const customKey = (c: ItemCustom | null | undefined) =>
  c ? JSON.stringify({ coverage: c.coverage ?? null, imageUrl: c.imageUrl ?? null, note: c.note ?? null }) : "";

/** Price of the options chosen for an item */
export const extraFor = (category: string, c: ItemCustom | null | undefined) =>
  category === "skins" && c?.coverage === "back_sides" ? store.skinSidesPrice : 0;

export async function couponDiscount(code: string | null, subtotal: number, tx: Tx = db) {
  if (!code) return { coupon: null, discount: 0, freeShipping: false, error: undefined as string | undefined };
  const [c] = await tx.select().from(s.coupons).where(eq(s.coupons.code, code.toUpperCase()));
  const invalid = (error: string) => ({ coupon: null, discount: 0, freeShipping: false, error });
  if (!c || !c.active) return invalid("Coupon not valid");
  if (c.expiresAt && c.expiresAt.getTime() < Date.now()) return invalid("Coupon has expired");
  if (c.usageLimit !== null && c.usedCount >= c.usageLimit) return invalid("Coupon usage limit reached");
  if (subtotal < c.minSubtotal) return invalid(`Add items worth ${store.currencySymbol}${c.minSubtotal - subtotal} more to use this coupon`);
  let discount = 0;
  if (c.type === "percent") discount = Math.round((subtotal * c.value) / 100);
  if (c.type === "fixed") discount = c.value;
  if (c.maxDiscount) discount = Math.min(discount, c.maxDiscount);
  discount = Math.min(discount, subtotal);
  return { coupon: { code: c.code, type: c.type, value: c.value }, discount, freeShipping: c.type === "free_shipping", error: undefined };
}

export function shippingFor(subtotalAfterDiscount: number, freeShipping: boolean) {
  if (freeShipping || subtotalAfterDiscount === 0) return 0;
  return subtotalAfterDiscount >= store.shipping.freeAbove ? 0 : store.shipping.flatRate;
}

/**
 * "Frequently bought together": when the cart has 2+ different kinds (case / skin / protector)
 * for the SAME phone, those lines get store.bundle.percent off.
 */
export function bundleFor(items: CartLine[]) {
  const byModel = new Map<number, CartLine[]>();
  for (const i of items) {
    if (!i.model || !store.bundle.sections.includes(i.category) || i.issue) continue;
    byModel.set(i.model.id, [...(byModel.get(i.model.id) ?? []), i]);
  }
  const groups: { model: string; kinds: string[]; discount: number }[] = [];
  for (const lines of byModel.values()) {
    const kinds = [...new Set(lines.map((l) => l.category))];
    if (kinds.length < 2) continue;
    const d = Math.round((lines.reduce((a, l) => a + l.lineTotal, 0) * store.bundle.percent) / 100);
    groups.push({ model: lines[0].model!.name, kinds, discount: d });
  }
  return { groups, discount: groups.reduce((a, g) => a + g.discount, 0) };
}

/** Load a cart with live prices & stock and compute every total server-side. */
export async function computeCart(cartId: string, tx: Tx = db) {
  const [cart] = await tx.select().from(s.carts).where(eq(s.carts.id, cartId));
  if (!cart) throw notFound("Cart");
  const rows = await tx
    .select({
      id: s.cartItems.id,
      variantId: s.cartItems.variantId,
      qty: s.cartItems.qty,
      custom: s.cartItems.custom,
      categorySlug: s.categories.slug,
      price: s.variants.price,
      compareAtPrice: s.variants.compareAtPrice,
      stock: s.variants.stock,
      sku: s.variants.sku,
      variantActive: s.variants.active,
      productId: s.products.id,
      productSlug: s.products.slug,
      productName: s.products.name,
      material: s.products.material,
      productImages: s.products.images,
      productView: s.products.view,
      productActive: s.products.active,
      modelId: s.phoneModels.id,
      modelSlug: s.phoneModels.slug,
      modelName: s.phoneModels.name,
      colorId: s.productColors.id,
      colorName: s.productColors.name,
      colorHex: s.productColors.hex,
      colorDesign: s.productColors.designUrl,
    })
    .from(s.cartItems)
    .innerJoin(s.variants, eq(s.variants.id, s.cartItems.variantId))
    .innerJoin(s.products, eq(s.products.id, s.variants.productId))
    .innerJoin(s.categories, eq(s.categories.id, s.products.categoryId))
    .leftJoin(s.phoneModels, eq(s.phoneModels.id, s.variants.phoneModelId))
    .innerJoin(s.productColors, eq(s.productColors.id, s.variants.colorId))
    .where(eq(s.cartItems.cartId, cartId))
    .orderBy(s.cartItems.id);

  const items: CartLine[] = rows.map((r) => {
    const available = r.variantActive && r.productActive ? r.stock : 0;
    const extra = extraFor(r.categorySlug, r.custom);
    const unit = r.price + extra;
    return {
      id: r.id,
      variantId: r.variantId,
      qty: r.qty,
      unitPrice: unit,
      compareAtPrice: r.compareAtPrice ? r.compareAtPrice + extra : null,
      lineTotal: unit * r.qty,
      category: r.categorySlug,
      custom: r.custom ?? null,
      extraPrice: extra,
      stock: Math.min(available, 99),
      sku: r.sku,
      product: {
        id: r.productId, slug: r.productSlug, name: r.productName, material: r.material,
        // thumbnail hints: a photo for "photos only" products, else the print design
        image: (r.productView as { mode?: string })?.mode === "photos" ? (r.productImages?.[0] ?? null) : null,
        design: r.colorDesign ?? ((r.productView as { designUrl?: string })?.designUrl || null),
      },
      // universal gadgets have no phone model
      model: r.modelId ? { id: r.modelId, slug: r.modelSlug!, name: r.modelName! } : null,
      color: { id: r.colorId, name: r.colorName, hex: r.colorHex },
      issue:
        available <= 0 ? "out_of_stock"
        : r.qty > available ? "insufficient_stock"
        : r.material === "skin-custom" && !r.custom?.imageUrl ? "missing_photo"
        : undefined,
    };
  });

  const subtotal = items.reduce((a, i) => a + i.lineTotal, 0);
  const savings = items.reduce((a, i) => a + Math.max(0, ((i.compareAtPrice ?? i.unitPrice) - i.unitPrice) * i.qty), 0);
  const bundle = bundleFor(items);
  const c = await couponDiscount(cart.couponCode, subtotal - bundle.discount, tx);
  const discount = bundle.discount + c.discount;
  const shipping = shippingFor(subtotal - discount, c.freeShipping);
  const codFee = store.cod.fee;
  return {
    id: cart.id,
    items,
    itemCount: items.reduce((a, i) => a + i.qty, 0),
    coupon: c.coupon,
    couponError: cart.couponCode ? c.error : undefined,
    bundles: bundle.groups,
    totals: {
      subtotal,
      discount,
      bundleDiscount: bundle.discount,
      couponDiscount: c.discount,
      shipping,
      codFee,
      total: subtotal - discount + shipping,
      savings: savings + discount,
      freeShippingAbove: store.shipping.freeAbove,
      freeShippingRemaining: c.freeShipping ? 0 : Math.max(0, store.shipping.freeAbove - (subtotal - discount)),
    },
    currency: store.currency,
    hasIssues: items.some((i) => i.issue),
  };
}

export type ComputedCart = Awaited<ReturnType<typeof computeCart>>;

const touch = (cartId: string) => db.update(s.carts).set({ updatedAt: new Date() }).where(eq(s.carts.id, cartId));

export async function cartRoutes(app: FastifyInstance) {
  const tags = ["Cart"];
  const P = Type.Object({ cartId: Type.String({ minLength: 10, maxLength: 40 }) });

  app.post("/carts", { preHandler: optionalAuth, schema: { tags, summary: "Create a cart (guest or logged-in). Store the returned id on the device." } }, async (req, reply) => {
    const id = nanoid(24);
    await db.insert(s.carts).values({ id, userId: req.user?.id ?? null });
    reply.code(201);
    return { data: await computeCart(id) };
  });

  app.get("/carts/:cartId", { schema: { tags, summary: "Get cart with live prices & totals", params: P } }, async (req) => {
    const { cartId } = req.params as { cartId: string };
    return { data: await computeCart(cartId) };
  });

  app.post(
    "/carts/:cartId/items",
    {
      schema: {
        tags,
        summary: "Add a variant (adds to existing quantity)",
        params: P,
        body: Type.Object({
          variantId: Type.Integer(),
          qty: Type.Integer({ minimum: 1, maximum: 20, default: 1 }),
          custom: Type.Optional(
            Type.Object({
              coverage: Type.Optional(Type.Union([Type.Literal("back"), Type.Literal("back_sides")])),
              imageUrl: Type.Optional(Type.String({ maxLength: 500, description: "URL returned by POST /uploads (custom photo skins)" })),
              imageName: Type.Optional(Type.String({ maxLength: 120 })),
              note: Type.Optional(Type.String({ maxLength: 300 })),
            }),
          ),
        }),
      },
    },
    async (req) => {
      const { cartId } = req.params as { cartId: string };
      const { variantId, qty, custom } = req.body as { variantId: number; qty: number; custom?: ItemCustom };
      const [v] = await db
        .select({ stock: s.variants.stock, active: s.variants.active, material: s.products.material })
        .from(s.variants)
        .innerJoin(s.products, eq(s.products.id, s.variants.productId))
        .where(eq(s.variants.id, variantId));
      if (!v || !v.active) throw notFound("Variant");
      if (v.stock <= 0) throw badRequest("This option is out of stock", "out_of_stock");
      if (v.material === "skin-custom" && !custom?.imageUrl) throw badRequest("Please upload your photo first", "missing_photo");
      if (custom?.imageUrl && !custom.imageUrl.startsWith(`${config.publicApiUrl}/uploads/`)) throw badRequest("Invalid photo link", "invalid_photo");
      const [cart] = await db.select({ id: s.carts.id }).from(s.carts).where(eq(s.carts.id, cartId));
      if (!cart) throw notFound("Cart");
      const clean = custom && (custom.coverage || custom.imageUrl || custom.note) ? custom : null;
      const key = customKey(clean);
      const [existingItem] = await db
        .select()
        .from(s.cartItems)
        .where(and(eq(s.cartItems.cartId, cartId), eq(s.cartItems.variantId, variantId), eq(s.cartItems.customKey, key)));
      if (existingItem) {
        const newQty = Math.min(existingItem.qty + qty, Math.min(v.stock, 20));
        await db.update(s.cartItems).set({ qty: newQty }).where(eq(s.cartItems.id, existingItem.id));
      } else {
        await db.insert(s.cartItems).values({ cartId, variantId, qty: Math.min(qty, v.stock), custom: clean, customKey: key });
      }
      await touch(cartId);
      return { data: await computeCart(cartId) };
    },
  );

  app.patch(
    "/carts/:cartId/items/:itemId",
    {
      schema: {
        tags,
        summary: "Set quantity (0 removes)",
        params: Type.Object({ cartId: Type.String(), itemId: Type.Integer() }),
        body: Type.Object({ qty: Type.Integer({ minimum: 0, maximum: 20 }) }),
      },
    },
    async (req) => {
      const { cartId, itemId } = req.params as { cartId: string; itemId: number };
      const { qty } = req.body as { qty: number };
      const where = and(eq(s.cartItems.id, itemId), eq(s.cartItems.cartId, cartId));
      if (qty === 0) await db.delete(s.cartItems).where(where);
      else await db.update(s.cartItems).set({ qty }).where(where);
      await touch(cartId);
      return { data: await computeCart(cartId) };
    },
  );

  app.delete(
    "/carts/:cartId/items/:itemId",
    { schema: { tags, summary: "Remove an item", params: Type.Object({ cartId: Type.String(), itemId: Type.Integer() }) } },
    async (req) => {
      const { cartId, itemId } = req.params as { cartId: string; itemId: number };
      await db.delete(s.cartItems).where(and(eq(s.cartItems.id, itemId), eq(s.cartItems.cartId, cartId)));
      return { data: await computeCart(cartId) };
    },
  );

  app.post(
    "/carts/:cartId/coupon",
    { schema: { tags, summary: "Apply a coupon code", params: P, body: Type.Object({ code: Type.String({ minLength: 2, maxLength: 30 }) }) } },
    async (req) => {
      const { cartId } = req.params as { cartId: string };
      const code = (req.body as { code: string }).code.trim().toUpperCase();
      const current = await computeCart(cartId);
      const c = await couponDiscount(code, current.totals.subtotal - current.totals.bundleDiscount);
      if (c.error) throw badRequest(c.error, "invalid_coupon");
      await db.update(s.carts).set({ couponCode: code }).where(eq(s.carts.id, cartId));
      return { data: await computeCart(cartId) };
    },
  );

  app.delete("/carts/:cartId/coupon", { schema: { tags, summary: "Remove coupon", params: P } }, async (req) => {
    const { cartId } = req.params as { cartId: string };
    await db.update(s.carts).set({ couponCode: null }).where(eq(s.carts.id, cartId));
    return { data: await computeCart(cartId) };
  });
}
