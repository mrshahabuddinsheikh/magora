import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { API_URL } from "./config";
import type { BrandWithModels, Paged, Product, ProductListItem, StoreInfo } from "./types";

/**
 * Server-side catalogue reads. Each is cached by Next.js ('use cache') so pages
 * render from cache in milliseconds; the API pings /api/revalidate after admin
 * edits so changes show up immediately.
 */
async function get<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}${path}`, { headers: { accept: "application/json" } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function getStore() {
  "use cache";
  cacheLife("hours");
  cacheTag("store");
  const res = await get<{ data: StoreInfo }>("/store");
  return res?.data ?? null;
}

export async function getBrands() {
  "use cache";
  cacheLife("hours");
  cacheTag("models");
  const res = await get<{ data: BrandWithModels[] }>("/brands");
  return Array.isArray(res?.data) ? res.data : [];
}

export async function getProducts(params: Record<string, string | number | undefined> = {}) {
  "use cache";
  cacheLife("minutes");
  cacheTag("products");
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") qs.set(k, String(v));
  const res = await get<Paged<ProductListItem>>(`/products?${qs}`);
  if (res && Array.isArray(res.data)) return res;
  return { data: [], meta: { page: 1, limit: 24, total: 0, hasMore: false } };
}

export async function getProduct(slug: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag("products", `product:${slug}`);
  return (await get<{ data: Product }>(`/products/${encodeURIComponent(slug)}`))?.data ?? null;
}
