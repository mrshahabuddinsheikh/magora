import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import * as s from "../db/schema";
import { store } from "../config";

function escapeXml(unsafe?: string | null): string {
  if (!unsafe) return "";
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function catalogFeedRoutes(app: FastifyInstance) {
  /* Public XML Feed for Google Merchant Center & Meta (Facebook/Instagram) Catalog */
  app.get("/feed.xml", async (req, reply) => {
    const siteUrl = process.env.PUBLIC_WEB_URL || "https://new.officialhayafoundation.com";
    const storeName = (store as any)?.name || "Magora";
    const storeDesc = "MagSafe magnetic phone cases, 3D skins, screen protectors and accessories with Cash on Delivery across Pakistan";
    const activeProducts = await db
      .select({
        id: s.products.id,
        slug: s.products.slug,
        name: s.products.name,
        subtitle: s.products.subtitle,
        description: s.products.description,
        brand: s.products.brand,
        basePrice: s.products.basePrice,
        minPrice: s.products.minPrice,
        compareAtPrice: s.products.compareAtPrice,
        material: s.products.material,
        active: s.products.active,
        categorySlug: s.categories.slug,
        categoryName: s.categories.name,
      })
      .from(s.products)
      .leftJoin(s.categories, eq(s.products.categoryId, s.categories.id))
      .where(eq(s.products.active, true));

    const itemsXml = activeProducts
      .map((p) => {
        const title = escapeXml(p.name);
        const desc = escapeXml(p.description || p.subtitle || `${p.name} - Available with Cash on Delivery across Pakistan`);
        const link = `${siteUrl}/product/${encodeURIComponent(p.slug)}`;
        const image = `${siteUrl}/opengraph-image.jpg`;
        const price = `${p.minPrice || p.basePrice} PKR`;
        const category = escapeXml(p.categoryName || "Mobile Phone Accessories");
        const brand = escapeXml(p.brand || "Magora");

        return `    <item>
      <g:id>${escapeXml(p.slug)}</g:id>
      <g:title>${title}</g:title>
      <g:description>${desc}</g:description>
      <g:link>${escapeXml(link)}</g:link>
      <g:image_link>${escapeXml(image)}</g:image_link>
      <g:brand>${brand}</g:brand>
      <g:condition>new</g:condition>
      <g:availability>in_stock</g:availability>
      <g:price>${price}</g:price>
      <g:google_product_category>Electronics &gt; Communications &gt; Telephony &gt; Mobile Phone Accessories</g:google_product_category>
      <g:product_type>${category}</g:product_type>
      <g:identifier_exists>no</g:identifier_exists>
    </item>`;
      })
      .join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${escapeXml(storeName)} Catalog</title>
    <link>${escapeXml(siteUrl)}</link>
    <description>${escapeXml(storeDesc)}</description>
${itemsXml}
  </channel>
</rss>`;

    reply.header("Content-Type", "application/xml; charset=utf-8");
    return reply.send(xml);
  });
}
