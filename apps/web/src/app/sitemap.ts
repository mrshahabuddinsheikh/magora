import type { MetadataRoute } from "next";
import { getBrands, getProducts } from "@/lib/api";
import { SITE_URL } from "@/lib/config";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, brands] = await Promise.all([getProducts({ limit: 60 }), getBrands()]);
  return [
    { url: SITE_URL, priority: 1 },
    ...["/skins", "/screen-protectors", "/gadgets"].map((h) => ({ url: `${SITE_URL}${h}`, priority: 0.95 })),
    { url: `${SITE_URL}/shop`, priority: 0.9 },
    ...((products?.data ?? []).map((p) => ({ url: `${SITE_URL}/product/${p.slug}`, priority: 0.8 }))),
    ...((brands ?? []).flatMap((b) => (b.models ?? []).map((m) => ({ url: `${SITE_URL}/shop?model=${m.slug}`, priority: 0.6 })))),
  ];
}
