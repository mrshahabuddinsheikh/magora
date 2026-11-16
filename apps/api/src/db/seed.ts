import bcrypt from "bcryptjs";
import { and, eq, sql } from "drizzle-orm";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { db, client, tuneDatabase, runMigrations } from "./client";
import * as s from "./schema";
import { phones, brandSeeds } from "./data/phones";
import { productSeeds, couponSeeds, categorySeeds, skinSeeds, protectorSeeds, gadgetSeeds } from "./data/products";
import { phoneSearchText } from "../lib/text";

/**
 * Idempotent seed: safe to run many times. Pass --bulk=5000 to also create
 * thousands of extra demo products to test speed with a large catalogue.
 */
const bulkArg = process.argv.find((a) => a.startsWith("--bulk="));
/**
 * Without --reset the seed only ADDS what's missing (new categories, products,
 * phones, colours, variants) and never overwrites prices/stock you edited in the admin.
 */
const reset = process.argv.includes("--reset");
const bulk = bulkArg ? Number(bulkArg.split("=")[1]) : 0;

await tuneDatabase();
// the seed may run before the server ever started on this version → bring the schema up to date first
await runMigrations(join(dirname(fileURLToPath(import.meta.url)), "../../drizzle"));

/* brands */
for (const b of brandSeeds) {
  const [existing] = await db.select().from(s.brands).where(eq(s.brands.slug, b.slug));
  if (existing) {
    await db.update(s.brands).set({ name: b.name, sort: b.sort }).where(eq(s.brands.id, existing.id));
  } else {
    await db.insert(s.brands).values(b);
  }
}
const brandRows = await db.select().from(s.brands);
const brandBySlug = new Map(brandRows.map((b) => [b.slug, b]));

/* phone models */
let sort = 0;
for (const p of phones) {
  const brand = brandBySlug.get(p.brand)!;
  const row = {
    brandId: brand.id,
    slug: p.slug,
    name: p.name,
    year: p.year,
    aliases: p.aliases ?? "",
    searchText: phoneSearchText(p.name, brand.name, p.aliases ?? ""),
    heightMm: p.h,
    widthMm: p.w,
    depthMm: p.d,
    cornerRadiusMm: p.r,
    camera: p.camera,
    details: {},
    bodyHex: p.bodyHex,
    priceAdjust: p.priceAdjust ?? 0,
    popular: p.popular ?? false,
    sort: sort++,
  };
  const [existingModel] = await db.select().from(s.phoneModels).where(eq(s.phoneModels.slug, p.slug));
  if (existingModel) {
    if (reset) await db.update(s.phoneModels).set(row).where(eq(s.phoneModels.id, existingModel.id));
  } else {
    await db.insert(s.phoneModels).values(row);
  }
}
const models = await db.select().from(s.phoneModels);
console.log(`✓ ${brandRows.length} brands, ${models.length} phone models`);

/* categories */
for (const c of categorySeeds) {
  const [existingCat] = await db.select().from(s.categories).where(eq(s.categories.slug, c.slug));
  if (existingCat) {
    await db.update(s.categories).set({ name: c.name, section: c.section, description: c.description, sort: c.sort }).where(eq(s.categories.id, existingCat.id));
  } else {
    await db.insert(s.categories).values(c);
  }
}
const categoryRows = await db.select().from(s.categories);
const categoryBySlug = new Map(categoryRows.map((c) => [c.slug, c]));

/* products + colours + variants */
async function upsertProduct(p: (typeof productSeeds)[number], opts: { modelIds?: number[]; stock?: number } = {}) {
  const category = categoryBySlug.get(p.category ?? "magsafe-cases")!;
  const universal = category.section === "gadgets";
  // big phones cost a little more; for skins/protectors the surcharge is smaller
  const adj = (m: (typeof models)[number]) => (category.slug === "magsafe-cases" ? m.priceAdjust : Math.round(m.priceAdjust / 300) * 100);
  const prices = universal ? p.colors.map((c) => p.basePrice + (c.priceAdd ?? 0)) : models.map((m) => p.basePrice + adj(m));
  const values = {
    slug: p.slug,
    name: p.name,
    subtitle: p.subtitle,
    description: p.description,
    categoryId: category.id,
    material: p.material,
    basePrice: p.basePrice,
    compareAtPrice: p.compareAtPrice ?? null,
    minPrice: Math.min(...prices),
    badge: p.badge ?? null,
    featured: p.featured ?? false,
    features: p.features,
    specs: p.specs,
  };

  let prod: typeof s.products.$inferSelect;
  const [existingProd] = await db.select().from(s.products).where(eq(s.products.slug, p.slug));
  if (existingProd) {
    if (reset) await db.update(s.products).set({ ...values, updatedAt: new Date() }).where(eq(s.products.id, existingProd.id));
    prod = (await db.select().from(s.products).where(eq(s.products.id, existingProd.id)))[0];
  } else {
    const [insertProd] = await db.insert(s.products).values(values);
    prod = (await db.select().from(s.products).where(eq(s.products.id, insertProd.insertId)))[0];
  }

  const existingColors = await db.select().from(s.productColors).where(eq(s.productColors.productId, prod.id));
  const colorIds: number[] = [];
  for (const [i, c] of p.colors.entries()) {
    const found = existingColors.find((e) => e.name === c.name);
    if (found) {
      colorIds.push(found.id);
      if (!reset) continue;
      colorIds.pop();
      await db.update(s.productColors).set({ hex: c.hex, accentHex: c.accentHex ?? null, sort: i }).where(eq(s.productColors.id, found.id));
      colorIds.push(found.id);
    } else {
      const [insertCol] = await db.insert(s.productColors).values({ productId: prod.id, name: c.name, hex: c.hex, accentHex: c.accentHex ?? null, sort: i });
      colorIds.push(insertCol.insertId);
    }
  }

  if (universal) {
    // gadgets: one variant per option, not tied to a phone
    const existing = await db.select({ colorId: s.variants.colorId }).from(s.variants).where(eq(s.variants.productId, prod.id));
    const have = new Set(existing.map((v) => v.colorId));
    for (const [ci, colorId] of colorIds.entries()) {
      const add = p.colors[ci]?.priceAdd ?? 0;
      const row = {
        productId: prod.id,
        phoneModelId: null,
        colorId,
        sku: `${prod.id}-U-${colorId}`,
        price: p.basePrice + add,
        compareAtPrice: p.compareAtPrice ? p.compareAtPrice + add : null,
        stock: opts.stock ?? 30 + ((colorId * 7) % 40),
      };
      if (!have.has(colorId)) await db.insert(s.variants).values(row);
      else if (reset) await db.update(s.variants).set({ price: row.price, compareAtPrice: row.compareAtPrice }).where(and(eq(s.variants.productId, prod.id), eq(s.variants.colorId, colorId)));
    }
    return prod;
  }

  const useModels = opts.modelIds ? models.filter((m) => opts.modelIds!.includes(m.id)) : models;
  const rows = [];
  for (const m of useModels) {
    for (const [ci, colorId] of colorIds.entries()) {
      const price = p.basePrice + adj(m) + (p.colors[ci]?.priceAdd ?? 0);
      rows.push({
        productId: prod.id,
        phoneModelId: m.id,
        colorId,
        sku: `${prod.id}-${m.slug}-${colorId}`.toUpperCase(),
        price,
        compareAtPrice: p.compareAtPrice ? p.compareAtPrice + adj(m) + (p.colors[ci]?.priceAdd ?? 0) : null,
        stock: opts.stock ?? 25 + ((m.id * 7 + colorId * 3) % 40),
      });
    }
  }
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    for (const r of chunk) {
      const [ex] = await db.select({ id: s.variants.id }).from(s.variants).where(
        and(eq(s.variants.productId, r.productId), eq(s.variants.phoneModelId, r.phoneModelId), eq(s.variants.colorId, r.colorId))
      );
      if (!ex) {
        await db.insert(s.variants).values(r);
      } else if (reset) {
        await db.update(s.variants).set({ price: r.price, compareAtPrice: r.compareAtPrice }).where(eq(s.variants.id, ex.id));
      }
    }
  }
  return prod;
}

for (const p of [...productSeeds, ...skinSeeds, ...protectorSeeds, ...gadgetSeeds]) await upsertProduct(p);
console.log(`✓ ${productSeeds.length} cases, ${skinSeeds.length} skins, ${protectorSeeds.length} protectors, ${gadgetSeeds.length} gadgets`);

/* bulk demo products for load testing */
if (bulk > 0) {
  const popular = models.filter((m) => m.popular).map((m) => m.id);
  const t0 = Date.now();
  for (let i = 0; i < bulk; i++) {
    const base = productSeeds[i % productSeeds.length];
    await upsertProduct(
      {
        ...base,
        slug: `${base.slug}-demo-${i + 1}`,
        name: `${base.name} · Demo ${i + 1}`,
        badge: undefined,
        featured: false,
        colors: base.colors.slice(0, 2),
      },
      { modelIds: popular, stock: 10 },
    );
    if ((i + 1) % 500 === 0) console.log(`  … ${i + 1}/${bulk}`);
  }
  console.log(`✓ ${bulk} bulk demo products in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

/* coupons */
for (const c of couponSeeds) {
  const [existingC] = await db.select().from(s.coupons).where(eq(s.coupons.code, c.code));
  if (!existingC) await db.insert(s.coupons).values(c);
}

/* admin user */
const adminEmail = (process.env.ADMIN_EMAIL ?? "admin@magora.pk").toLowerCase();
const adminPass = process.env.ADMIN_PASSWORD ?? "ChangeMe@123";
if (process.env.NODE_ENV === "production" && (adminPass === "ChangeMe@123" || adminPass.length < 10)) {
  console.error("✗ Set a strong ADMIN_PASSWORD (10+ characters) in apps/api/.env before seeding a live store.");
  process.exit(1);
}
const existing = await db.select().from(s.users).where(eq(s.users.email, adminEmail));
if (!existing.length) {
  await db.insert(s.users).values({
    name: "Store Admin",
    email: adminEmail,
    passwordHash: await bcrypt.hash(adminPass, 10),
    role: "admin",
  });
  console.log(`✓ Admin created: ${adminEmail} (change the password in .env before going live)`);
}

/* trust settings (social proof popups frequency and config) */
const [existingTrustSettings] = await db.select().from(s.trustSettings).where(eq(s.trustSettings.key, "general"));
if (!existingTrustSettings) {
  await db.insert(s.trustSettings).values({
    key: "general",
    value: { enabled: true, mode: "hybrid", initialDelaySec: 3, intervalSec: 16, durationSec: 6 },
  });
  console.log("✓ Seeded trust settings");
}

/* trust signals (social proof sales popups) */
const defaultSignals = [
  { city: "Lahore", productName: "Crystal Clear MagSafe Case", productSlug: "crystal-clear-magsafe-case", material: "clear", colorHex: "#f4f7fb", modelName: "iPhone 16 Pro Max", timeAgoText: "2 min ago", sort: 1 },
  { city: "Karachi", productName: "Frosted Matte MagSafe Case", productSlug: "frosted-matte-magsafe-case", material: "frosted", colorHex: "#1f2024", modelName: "Galaxy S25 Ultra", timeAgoText: "5 min ago", sort: 2 },
  { city: "Islamabad", productName: "Carbon Fiber 3D Textured Skin", productSlug: "carbon-fiber-skin", material: "skin-carbon", colorHex: "#1f2024", modelName: "iPhone 15 Pro", timeAgoText: "11 min ago", sort: 3 },
  { city: "Rawalpindi", productName: "9H Tempered Glass Protector", productSlug: "9h-tempered-glass", material: "glass-clear", colorHex: "#e8f1fb", modelName: "iPhone 14 Pro Max", timeAgoText: "18 min ago", sort: 4 },
  { city: "Faisalabad", productName: "65W GaN 3-Port Fast Charger", productSlug: "65w-gan-charger", material: "gadget-charger", colorHex: "#ffffff", modelName: null, timeAgoText: "27 min ago", sort: 5 },
  { city: "Multan", productName: "Vegan Leather MagSafe Case", productSlug: "vegan-leather-magsafe-case", material: "leather", colorHex: "#8a5a3b", modelName: "Galaxy S24 Ultra", timeAgoText: "42 min ago", sort: 6 },
  { city: "Peshawar", productName: "Armor Kickstand MagSafe Case", productSlug: "armor-kickstand-magsafe-case", material: "armor", colorHex: "#2b2d42", modelName: "iPhone 16 Pro", timeAgoText: "1 hour ago", sort: 7 },
  { city: "Sialkot", productName: "Magnetic Power Bank 5,000 mAh", productSlug: "magsafe-power-bank-5000", material: "gadget-powerbank", colorHex: "#f2f3f5", modelName: null, timeAgoText: "2 hours ago", sort: 8 },
  { city: "Gujranwala", productName: "Silicone Soft Touch MagSafe Case", productSlug: "silicone-soft-touch-case", material: "silicone", colorHex: "#2e384d", modelName: "Pixel 9 Pro", timeAgoText: "2 hours ago", sort: 9 },
  { city: "Quetta", productName: "MagSafe Ring Stand & Grip", productSlug: "magsafe-ring-stand-grip", material: "gadget-ring", colorHex: "#1a1a1a", modelName: null, timeAgoText: "3 hours ago", sort: 10 },
];
for (const sig of defaultSignals) {
  const [existingSig] = await db.select().from(s.trustSignals).where(and(eq(s.trustSignals.city, sig.city), eq(s.trustSignals.productSlug, sig.productSlug)));
  if (!existingSig) {
    await db.insert(s.trustSignals).values({ ...sig, active: true });
  }
}
console.log("✓ Seeded trust signals");

/* product brands (Casetify, dbrand, Ronin, Spigen, Apple, etc.) */
const defaultBrands = [
  { slug: "magora", name: "Magora", description: "Official Magora Original Cases & Accessories", sort: 1 },
  { slug: "casetify", name: "Casetify", description: "High-impact designer protective cases", sort: 2 },
  { slug: "dbrand", name: "dbrand", description: "Precision vinyl skins, grip cases & tempered glass", sort: 3 },
  { slug: "ronin", name: "Ronin", description: "Premium Pakistani mobile accessories & audio", sort: 4 },
  { slug: "spigen", name: "Spigen", description: "Tough armor & ultra hybrid protection", sort: 5 },
  { slug: "apple", name: "Apple", description: "Original Apple MagSafe accessories", sort: 6 },
  { slug: "samsung", name: "Samsung", description: "Original Samsung Galaxy covers & chargers", sort: 7 },
  { slug: "rhinoshield", name: "RhinoShield", description: "Impact protection crashguards & solidsuit", sort: 8 },
  { slug: "anker", name: "Anker", description: "Industry-leading GaN chargers & power banks", sort: 9 },
];
for (const b of defaultBrands) {
  const [existingB] = await db.select().from(s.productBrands).where(eq(s.productBrands.slug, b.slug));
  if (!existingB) {
    await db.insert(s.productBrands).values({ ...b, active: true });
  }
}
console.log("✓ Seeded product brands");

/* custom styles & materials */
const defaultStyles = [
  { slug: "clear", name: "Crystal Clear", section: "magsafe-cases", hint: "Show off the original phone colour", color: "#f4f7fb", accent: "#38bdf8", sort: 1 },
  { slug: "frosted", name: "Frosted Matte", section: "magsafe-cases", hint: "Anti-fingerprint matte translucent finish", color: "#25272b", accent: "#94a3b8", sort: 2 },
  { slug: "leather", name: "Vegan Leather", section: "magsafe-cases", hint: "Luxury stitched synthetic leather", color: "#8a5a3b", accent: "#d4a373", sort: 3 },
  { slug: "armor", name: "Heavy Duty Armor", section: "magsafe-cases", hint: "Shock-absorbing dual layer kickstand", color: "#1f2229", accent: "#f97316", sort: 4 },
  { slug: "silicone", name: "Silicone Touch", section: "magsafe-cases", hint: "Silky soft-touch with microfiber lining", color: "#2e384d", accent: "#60a5fa", sort: 5 },
];
for (const st of defaultStyles) {
  const [existingSt] = await db.select().from(s.customStyles).where(eq(s.customStyles.slug, st.slug));
  if (!existingSt) {
    await db.insert(s.customStyles).values({ ...st, active: true });
  }
}
console.log("✓ Seeded custom styles");

client.close();
console.log("✓ Seed complete");
