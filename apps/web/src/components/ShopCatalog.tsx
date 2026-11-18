"use client";

import Link from "next/link";
import { useState, useTransition, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ProductCard } from "@/components/ProductCard";
import { ShopFilters } from "@/components/ShopFilters";
import { SectionMark } from "@/components/SectionMark";
import { cn } from "@/lib/format";
import { categoryOf, gadgetType } from "@/lib/categories";
import { usePrefs } from "@/stores/prefs";
import type { BrandWithModels, ProductListItem } from "@/lib/types";

type SP = { category?: string; brand?: string; model?: string; material?: string; sort?: string; page?: string; q?: string };

export function ShopCatalog({
  brands,
  products,
  total,
  limit,
  page,
  hasMore,
  sp,
}: {
  brands: BrandWithModels[];
  products: ProductListItem[];
  total: number;
  limit: number;
  page: number;
  hasMore: boolean;
  sp: SP;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const setPhone = usePrefs((s) => s.setPhone);

  const cat = categoryOf(sp.category);
  const type = gadgetType(sp.category);

  const allModels = useMemo(() => brands.flatMap((b) => b.models), [brands]);

  // Client-side optimistic active state for instant 0ms visual transformation
  const [activeModelSlug, setActiveModelSlug] = useState<string | undefined>(sp.model);
  const [activeBrandSlug, setActiveBrandSlug] = useState<string | undefined>(sp.brand);

  // Sync with incoming server URL changes
  useEffect(() => {
    setActiveModelSlug(sp.model);
  }, [sp.model]);

  useEffect(() => {
    setActiveBrandSlug(sp.brand);
  }, [sp.brand]);

  const activeModel = useMemo(() => {
    if (!activeModelSlug) return undefined;
    return allModels.find((m) => m.slug === activeModelSlug);
  }, [allModels, activeModelSlug]);

  const effectiveBrandSlug = activeModel?.brand.slug ?? activeBrandSlug;
  const activeBrand = useMemo(() => {
    if (!effectiveBrandSlug) return undefined;
    return brands.find((b) => b.slug === effectiveBrandSlug);
  }, [brands, effectiveBrandSlug]);

  const look = cat.phoneBased ? (activeModel ?? activeBrand?.models[0]) : undefined;
  const noun = cat.slug === "magsafe-cases" ? "MagSafe cases" : cat.name.toLowerCase();

  const title = sp.q
    ? `Results for “${sp.q}”`
    : type
      ? type.name
    : !cat.phoneBased
      ? "All gadgets"
    : activeModel
      ? `${cat.slug === "magsafe-cases" ? "Cases" : cat.name} for ${activeModel.name}`
      : activeBrand
        ? `${activeBrand.name} ${noun}`
        : cat.slug === "magsafe-cases" ? "All MagSafe cases" : `All ${noun}`;

  const handleFilterChange = (patch: Partial<SP>) => {
    // Instantaneous optimistic state update (0ms delay)
    if ("model" in patch) {
      setActiveModelSlug(patch.model);
      if (patch.model) {
        const found = allModels.find((m) => m.slug === patch.model);
        if (found) {
          setPhone({ slug: found.slug, name: found.name, brand: found.brand.slug });
          setActiveBrandSlug(found.brand.slug);
        }
      }
    }
    if ("brand" in patch) {
      setActiveBrandSlug(patch.brand);
      if (!patch.model) {
        setActiveModelSlug(undefined);
      }
    }

    const next: Record<string, string | undefined> = { ...sp, ...patch };
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) if (v) u.set(k, v);
    start(() => router.push(`/shop?${u}`, { scroll: false }));
  };

  const qs = (patch: Partial<SP>) => {
    const u = new URLSearchParams();
    const merged = { ...sp, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) u.set(k, String(v));
    return `/shop?${u}`;
  };

  return (
    <div>
      <div className="mb-5">
        <nav className="text-[13px] text-muted">
          <Link href={cat.home} className="hover:text-ink">{cat.name}</Link> / <Link href={`/shop?category=${cat.slug}`} className="hover:text-ink">Shop</Link>
          {activeBrand && cat.phoneBased && <> / {activeBrand.name}</>}
          {type && <> / {type.name}</>}
        </nav>
        <h1 className="mt-1 text-[28px] font-bold tracking-tight sm:text-[38px] transition-colors">{title}</h1>
        <p className="mt-1 text-muted">
          {total} {cat.phoneBased ? (total === 1 ? "design" : "designs") : total === 1 ? "product" : "products"} · {type ? type.hint : cat.tagline} · Cash on Delivery
        </p>
      </div>
      <SectionMark section={cat.slug} />

      <ShopFilters
        brands={brands}
        current={{ ...sp, category: type?.cat ?? cat.slug, brand: effectiveBrandSlug }}
        activeBrand={effectiveBrandSlug}
        activeModel={activeModelSlug}
        onChange={handleFilterChange}
      />

      {products.length === 0 ? (
        <div className="card mt-6 p-10 text-center">
          <p className="text-lg font-semibold">No {cat.noun} found</p>
          <p className="mt-1 text-muted">Try another {cat.phoneBased ? cat.stylesLabel.toLowerCase().replace(/s$/, "") : "type"} or clear the filters.</p>
          <Link href={`/shop?category=${cat.slug}`} className="btn btn-primary mt-5">Clear filters</Link>
        </div>
      ) : (
        <div className={cn("mt-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4 transition-opacity duration-200", pending && "opacity-85")}>
          {products.map((p, i) => (
            <ProductCard
              key={`${p.id}-${activeModelSlug ?? "generic"}`}
              p={p}
              modelSlug={cat.phoneBased ? activeModel?.slug : undefined}
              modelName={cat.phoneBased ? activeModel?.name : undefined}
              layout={look?.layout}
              phoneHex={look?.bodyHex}
              priority={i < 4}
            />
          ))}
        </div>
      )}

      {(hasMore || page > 1) && (
        <div className="mt-8 flex items-center justify-center gap-2">
          <Link href={qs({ page: String(page - 1) })} className={cn("btn btn-glass", page <= 1 && "pointer-events-none opacity-40")} aria-disabled={page <= 1}>
            ← Previous
          </Link>
          <span className="px-3 text-sm text-muted">
            Page {page} of {Math.max(1, Math.ceil(total / limit))}
          </span>
          <Link href={qs({ page: String(page + 1) })} className={cn("btn btn-glass", !hasMore && "pointer-events-none opacity-40")} aria-disabled={!hasMore}>
            Next →
          </Link>
        </div>
      )}
    </div>
  );
}
