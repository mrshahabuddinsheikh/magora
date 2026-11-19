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

export async function getCodSettings(tx: Tx = db) {
  try {
    const [row] = await tx.select().from(s.codSettings).where(eq(s.codSettings.id, 1));
    if (row) {
      let allowedCities: string[] = ["Karachi"];
      try {
        if (row.allowedCities) {
          allowedCities = typeof row.allowedCities === "string" ? JSON.parse(row.allowedCities) : row.allowedCities;
        }
      } catch {}
      return {
        ...row,
        cityRestriction: row.cityRestriction || "selected_only",
        allowedCities: Array.isArray(allowedCities) && allowedCities.length > 0 ? allowedCities : ["Karachi"],
        nonCodNotice: row.nonCodNotice || "Cash on Delivery is only available in Karachi. Orders from other cities require online payment.",
        payoneerEnabled: row.payoneerEnabled ?? true,
        payoneerTitle: row.payoneerTitle || "Payoneer / Card / Online Transfer",
        payoneerEmail: row.payoneerEmail || "",
        payoneerLink: row.payoneerLink || "",
        payoneerInstructions: row.payoneerInstructions || "Pay via Payoneer or online transfer. Share your transaction ID or receipt screenshot on WhatsApp after placing order.",
        bankTitle: row.bankTitle || "",
        bankAccount: row.bankAccount || "",
        bankIban: row.bankIban || "",
        bankEnabled: row.bankEnabled ?? true,
        bankInstructions: row.bankInstructions || "Transfer the total amount via online banking / Raast and share your receipt on WhatsApp.",
        cardEnabled: row.cardEnabled ?? true,
        cardTitle: row.cardTitle || "Debit / Credit Card",
        cardInstructions: row.cardInstructions || "Pay securely with any Visa, Mastercard, UnionPay or PayPak debit/credit card.",
        safepayEnabled: row.safepayEnabled ?? false,
        safepayApiKey: row.safepayApiKey || "",
        safepaySecretKey: row.safepaySecretKey || "",
        safepayEnv: row.safepayEnv || "sandbox",
        jazzcashEnabled: row.jazzcashEnabled ?? true,
        jazzcashTitle: row.jazzcashTitle || "JazzCash",
        jazzcashAccountTitle: row.jazzcashAccountTitle || "",
        jazzcashAccountNumber: row.jazzcashAccountNumber || "",
        jazzcashInstructions: row.jazzcashInstructions || "Send payment to our JazzCash account and enter your TID / sender mobile below.",
        jazzcashMerchantId: row.jazzcashMerchantId || "",
        jazzcashPassword: row.jazzcashPassword || "",
        jazzcashSalt: row.jazzcashSalt || "",
        jazzcashEnv: row.jazzcashEnv || "sandbox",
        easypaisaEnabled: row.easypaisaEnabled ?? true,
        easypaisaTitle: row.easypaisaTitle || "Easypaisa",
        easypaisaAccountTitle: row.easypaisaAccountTitle || "",
        easypaisaAccountNumber: row.easypaisaAccountNumber || "",
        easypaisaInstructions: row.easypaisaInstructions || "Send payment to our Easypaisa account and enter your TID / sender mobile below.",
      };
    }
  } catch {}
  return {
    id: 1,
    enabled: true,
    threshold: 2000,
    feeBelow: 50,
    feeAbove: 100,
    cityRestriction: "selected_only",
    allowedCities: ["Karachi"],
    nonCodNotice: "Cash on Delivery is only available in Karachi. Orders from other cities require online payment.",
    payoneerEnabled: true,
    payoneerTitle: "Payoneer / Card / Online Transfer",
    payoneerEmail: "",
    payoneerLink: "",
    payoneerInstructions: "Pay via Payoneer or online transfer. Share your transaction ID or receipt screenshot on WhatsApp after placing order.",
    bankTitle: "",
    bankAccount: "",
    bankIban: "",
    bankEnabled: true,
    bankInstructions: "Transfer the total amount via online banking / Raast and share your receipt on WhatsApp.",
    cardEnabled: true,
    cardTitle: "Debit / Credit Card",
    cardInstructions: "Pay securely with any Visa, Mastercard, UnionPay or PayPak debit/credit card.",
    safepayEnabled: false,
    safepayApiKey: "",
    safepaySecretKey: "",
    safepayEnv: "sandbox",
    jazzcashEnabled: true,
    jazzcashTitle: "JazzCash",
    jazzcashAccountTitle: "",
    jazzcashAccountNumber: "",
    jazzcashInstructions: "Send payment to our JazzCash account and enter your TID / sender mobile below.",
    jazzcashMerchantId: "",
    jazzcashPassword: "",
    jazzcashSalt: "",
    jazzcashEnv: "sandbox",
    easypaisaEnabled: true,
    easypaisaTitle: "Easypaisa",
    easypaisaAccountTitle: "",
    easypaisaAccountNumber: "",
    easypaisaInstructions: "Send payment to our Easypaisa account and enter your TID / sender mobile below.",
  };
}

export async function getLeadCaptureSettings(tx: Tx = db) {
  try {
    const [row] = await tx.select().from(s.leadCaptureSettings).where(eq(s.leadCaptureSettings.id, 1));
    if (row) return row;
  } catch {}
  return {
    id: 1,
    enabled: false,
    showFloatingPill: false,
    badgeText: "🎁 Rs. 300 OFF Code",
    heading: "Get Rs. 300 OFF",
    subheading: "Your first MagSafe case or skin",
    couponCode: "VIP300",
    discountAmount: 300,
    delaySeconds: 10,
  };
}

let loyaltyTableChecked = false;
async function ensureLoyaltyTables(tx: Tx = db) {
  if (loyaltyTableChecked) return;
  try {
    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS \`loyalty_settings\` (
        \`id\` INT PRIMARY KEY AUTO_INCREMENT,
        \`enabled\` BOOLEAN NOT NULL DEFAULT TRUE,
        \`coin_rate_pct\` INT NOT NULL DEFAULT 5,
        \`coin_value_pkr\` INT NOT NULL DEFAULT 1,
        \`min_order_pkr\` INT NOT NULL DEFAULT 0,
        \`custom_badge_template\` VARCHAR(255) NOT NULL DEFAULT 'Earn {coins} Magora Coins (Rs. {discount} discount on your next order)',
        \`terms_notice\` TEXT NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS \`coin_transactions\` (
        \`id\` INT PRIMARY KEY AUTO_INCREMENT,
        \`customer_phone\` VARCHAR(32) NOT NULL,
        \`customer_email\` VARCHAR(128),
        \`customer_name\` VARCHAR(128),
        \`order_id\` INT,
        \`order_number\` VARCHAR(64),
        \`amount_coins\` INT NOT NULL,
        \`amount_pkr\` INT NOT NULL,
        \`type\` VARCHAR(32) NOT NULL DEFAULT 'earned',
        \`status\` VARCHAR(32) NOT NULL DEFAULT 'approved',
        \`notes\` VARCHAR(255),
        \`created_at\` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updated_at\` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        INDEX idx_customer_phone (\`customer_phone\`),
        INDEX idx_order_number (\`order_number\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    loyaltyTableChecked = true;
  } catch (err) {
    console.warn("Failed ensuring loyalty tables:", err);
  }
}

export async function getLoyaltySettings(tx: Tx = db) {
  await ensureLoyaltyTables(tx);
  try {
    const [row] = await tx.select().from(s.loyaltySettings).where(eq(s.loyaltySettings.id, 1));
    if (row) return row;
    const defaultData = {
      id: 1,
      enabled: true,
      coinRatePct: 5,
      coinValuePkr: 1,
      minOrderPkr: 0,
      customBadgeTemplate: "Earn {coins} Magora Coins (Rs. {discount} discount on your next order)",
      termsNotice:
        "Magora Coins are promotional loyalty rewards provided at Magora's sole discretion. Magora reserves the absolute right to modify, suspend, reject, cancel, or revoke any Magora Coins, rewards, or discounts earned or redeemed on any order at its sole discretion without prior notice (including suspected abuse, cancellations, or returns). Coins hold no cash redemption value outside the platform.",
    };
    await tx.insert(s.loyaltySettings).values(defaultData);
    return defaultData;
  } catch {}
  return {
    id: 1,
    enabled: true,
    coinRatePct: 5,
    coinValuePkr: 1,
    minOrderPkr: 0,
    customBadgeTemplate: "Earn {coins} Magora Coins (Rs. {discount} discount on your next order)",
    termsNotice:
      "Magora Coins are promotional loyalty rewards provided at Magora's sole discretion. Magora reserves the absolute right to modify, suspend, reject, cancel, or revoke any Magora Coins, rewards, or discounts earned or redeemed on any order at its sole discretion without prior notice (including suspected abuse, cancellations, or returns). Coins hold no cash redemption value outside the platform.",
  };
}

export function computeCodFee(subtotalAfterDiscount: number, settings: { enabled: boolean; threshold: number; feeBelow: number; feeAbove: number }) {
  if (!settings.enabled) return 0;
  return subtotalAfterDiscount < settings.threshold ? settings.feeBelow : settings.feeAbove;
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
  const codSettings = await getCodSettings(tx);
  const codFee = computeCodFee(subtotal - discount, codSettings);
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
      codSettings: {
        enabled: codSettings.enabled,
        threshold: codSettings.threshold,
        feeBelow: codSettings.feeBelow,
        feeAbove: codSettings.feeAbove,
      },
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
