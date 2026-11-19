import "server-only";
import { API_URL } from "./config";
import type { BrandWithModels, Paged, Product, ProductListItem, StoreInfo } from "./types";

/**
 * Server-side catalogue reads. Cached via Next.js Data Cache ('next: { revalidate, tags }')
 * so pages render instantly while automatically invalidating on admin updates via /api/revalidate.
 * Failed requests are never cached, preventing dead/empty page bugs.
 */
async function get<T>(path: string, tags?: string[], revalidate = 60): Promise<T | null> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`${API_URL}${path}`, {
        headers: { accept: "application/json" },
        next: {
          revalidate,
          tags,
        },
      });
      if (res.ok) return (await res.json()) as T;
      if (res.status === 404 && attempt < 2) {
        // Brief retry in case of cold-start route registration
        await new Promise((r) => setTimeout(r, 200));
        continue;
      }
      if (res.status === 404) return null; // Genuine 404
    } catch {
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 300 * attempt));
        continue;
      }
    }
  }
  return null;
}

export async function getStore() {
  const res = await get<{ data: StoreInfo }>("/store", ["store"], 3600);
  return res?.data ?? null;
}

export async function getBrands() {
  const res = await get<{ data: BrandWithModels[] }>("/brands", ["models"], 3600);
  return Array.isArray(res?.data) ? res.data : [];
}

export async function getProducts(params: Record<string, string | number | undefined> = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") qs.set(k, String(v));
  const res = await get<Paged<ProductListItem>>(`/products?${qs}`, ["products"], 60);
  if (res && Array.isArray(res.data)) return res;
  return { data: [], meta: { page: 1, limit: 24, total: 0, hasMore: false } };
}

export async function getProduct(slug: string) {
  const res = await get<{ data: Product }>(`/products/${encodeURIComponent(slug)}`, ["products", `product:${slug}`], 60);
  return res?.data ?? null;
}
