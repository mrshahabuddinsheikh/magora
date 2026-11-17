"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Search, Smartphone, X } from "lucide-react";
import { shortModel, cn } from "@/lib/format";
import { usePrefs } from "@/stores/prefs";
import type { BrandWithModels } from "@/lib/types";

interface ShopByPhoneProps {
  brands: BrandWithModels[];
  category?: string;
}

export function ShopByPhone({ brands, category = "magsafe-cases" }: ShopByPhoneProps) {
  const savedPhone = usePrefs((s) => s.phone);
  
  // Default to saved brand if present, otherwise first brand (usually Apple)
  const initialBrandSlug = useMemo(() => {
    if (savedPhone?.brand) {
      const found = brands.find((b) => b.slug.toLowerCase() === savedPhone.brand.toLowerCase());
      if (found) return found.slug;
    }
    return brands[0]?.slug ?? "apple";
  }, [brands, savedPhone]);

  const [activeBrandSlug, setActiveBrandSlug] = useState<string>(initialBrandSlug);
  const [search, setSearch] = useState<string>("");

  const activeBrand = useMemo(() => {
    return brands.find((b) => b.slug === activeBrandSlug) ?? brands[0];
  }, [brands, activeBrandSlug]);

  // If user is searching, find matching models across all brands
  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return null;

    const matches: { brand: BrandWithModels; model: { slug: string; name: string } }[] = [];
    for (const b of brands) {
      for (const m of b.models ?? []) {
        if (m.name.toLowerCase().includes(q)) {
          matches.push({ brand: b, model: m });
        }
      }
    }
    return matches.slice(0, 12);
  }, [brands, search]);

  if (!brands || brands.length === 0) return null;

  return (
    <section className="mt-12 sm:mt-16" aria-label="Shop by phone">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-accent">Find your fit</p>
          <h2 className="mt-0.5 text-2xl font-bold tracking-tight sm:text-3xl">Shop by phone</h2>
        </div>
        <Link
          href={`/shop?category=${category}`}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-accent hover:underline sm:text-sm"
        >
          View all models ({brands.reduce((acc, b) => acc + (b.models?.length ?? 0), 0)}) <ArrowRight size={14} />
        </Link>
      </div>

      {/* Main Clean Card Container */}
      <div className="card overflow-hidden p-4 sm:p-6 shadow-sm border border-line">
        {/* Top Controls: Brand Tabs & Quick Search */}
        <div className="space-y-3">
          {/* Quick Search Input */}
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search your model (e.g. 16 Pro Max, S24 Ultra, Vivo, Note)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input h-10 w-full pl-9 pr-8 text-xs sm:text-sm bg-black/[0.02] border-line focus:bg-white"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 grid h-5 w-5 place-items-center rounded-full bg-black/10 text-muted hover:text-ink"
                aria-label="Clear search"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Horizontal Brand Scroll Tabs (Mobile & Desktop) */}
          {!search && (
            <div className="no-scrollbar -mx-1 flex snap-x gap-1.5 overflow-x-auto px-1 py-1">
              {brands.map((b) => {
                const isActive = b.slug === activeBrandSlug;
                const count = b.models?.length ?? 0;
                return (
                  <button
                    key={b.slug}
                    type="button"
                    onClick={() => setActiveBrandSlug(b.slug)}
                    className={cn(
                      "flex shrink-0 snap-start items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-200",
                      isActive
                        ? "bg-ink text-white shadow-sm ring-2 ring-ink/20 scale-[1.02]"
                        : "bg-black/[0.04] text-muted hover:bg-black/[0.08] hover:text-ink dark:bg-white/10 dark:text-muted dark:hover:text-white",
                    )}
                  >
                    <span>{b.name}</span>
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.2 text-[10px] font-bold tabular-nums",
                        isActive ? "bg-white/20 text-white" : "bg-black/5 text-muted dark:bg-white/10 dark:text-white/70",
                      )}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Content Area: Search Mode vs Active Brand Mode */}
        <div className="mt-4 border-t border-line/60 pt-3.5">
          {search ? (
            /* Search Results Mode */
            <div>
              <div className="mb-2 flex items-center justify-between text-xs text-muted">
                <span>
                  Search results for &ldquo;<b>{search}</b>&rdquo; ({searchResults?.length ?? 0} found):
                </span>
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="text-accent hover:underline font-medium"
                >
                  Back to brands
                </button>
              </div>

              {searchResults && searchResults.length > 0 ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                  {searchResults.map(({ brand, model }) => (
                    <Link
                      key={`${brand.slug}-${model.slug}`}
                      href={`/shop?category=${category}&model=${model.slug}`}
                      prefetch={false}
                      className="group flex items-center justify-between gap-1.5 rounded-xl border border-line bg-black/[0.01] p-2.5 transition hover:border-accent hover:bg-white hover:shadow-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-bold text-ink group-hover:text-accent">
                          {model.name}
                        </div>
                        <div className="text-[10px] text-muted">{brand.name}</div>
                      </div>
                      <ArrowRight size={13} className="shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-accent" />
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-muted">
                  Koi phone nahi mila &ldquo;{search}&rdquo; ke liye. Dusra naam likh kar check karein.
                </div>
              )}
            </div>
          ) : activeBrand ? (
            /* Active Brand Mode */
            <div>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-ink sm:text-base">{activeBrand.name} MagSafe Cases</h3>
                  <span className="text-xs text-muted font-normal">
                    ({activeBrand.models?.length ?? 0} models)
                  </span>
                </div>
                <Link
                  href={`/shop?category=${category}&brand=${activeBrand.slug}`}
                  className="text-xs font-semibold text-accent hover:underline inline-flex items-center gap-1"
                >
                  All {activeBrand.name} <ArrowRight size={12} />
                </Link>
              </div>

              {/* Compact Model Chips Grid */}
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {(activeBrand.models ?? []).slice(0, 8).map((m) => (
                  <Link
                    key={m.slug}
                    href={`/shop?category=${category}&model=${m.slug}`}
                    prefetch={false}
                    className="chip group flex items-center gap-1.5 text-xs py-1.5 px-3 transition hover:!bg-accent hover:!text-white hover:border-accent"
                  >
                    <Smartphone size={13} className="text-muted group-hover:text-white transition" />
                    <span className="font-medium">{shortModel(m.name)}</span>
                  </Link>
                ))}

                {(activeBrand.models?.length ?? 0) > 8 && (
                  <Link
                    href={`/shop?category=${category}&brand=${activeBrand.slug}`}
                    className="chip text-xs py-1.5 px-3 font-semibold text-accent hover:!bg-accent hover:!text-white transition"
                  >
                    +{activeBrand.models.length - 8} more models &rarr;
                  </Link>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
