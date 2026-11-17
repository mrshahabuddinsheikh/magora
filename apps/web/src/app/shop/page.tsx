import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getBrands, getProducts } from "@/lib/api";
import { ProductCard } from "@/components/ProductCard";
import { ShopFilters } from "@/components/ShopFilters";
import { cn } from "@/lib/format";
import { categoryOf, gadgetType } from "@/lib/categories";
import { SectionMark } from "@/components/SectionMark";

const META: Record<string, Metadata> = {
  "magsafe-cases": {
    title: "Shop MagSafe Cases",
    description: "MagSafe-compatible cases for every iPhone, Samsung Galaxy S and Google Pixel. Cash on delivery across Pakistan.",
  },
  gadgets: {
    title: "Shop Gadgets — Earbuds, Chargers, Watches & Power Banks",
    description: "Earbuds, smart watches, power banks, fast chargers, cables and handsfree with a 6-month warranty. Cash on delivery across Pakistan.",
  },
  skins: {
    title: "Shop Phone Skins & Custom Photo Skins",
    description: "Laser-cut back and side skins for every iPhone, Galaxy and Pixel, or print your own photo. Cash on delivery across Pakistan.",
  },
  "screen-protectors": {
    title: "Shop Screen Protectors",
    description: "9H tempered, privacy and matte glass plus camera lens protectors for every iPhone, Galaxy and Pixel. Cash on delivery across Pakistan.",
  },
};

export async function generateMetadata(props: PageProps<"/shop">): Promise<Metadata> {
  const sp = (await props.searchParams) as SP;
  return META[categoryOf(sp.category).slug] ?? META["magsafe-cases"];
}

type SP = { category?: string; brand?: string; model?: string; material?: string; sort?: string; page?: string; q?: string };

export default function ShopPage(props: PageProps<"/shop">) {
  return (
    <Suspense fallback={<GridSkeleton />}>
      <Results searchParams={props.searchParams as Promise<SP>} />
    </Suspense>
  );
}

async function Results({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  // each product line is its own shop: /shop?category=skins shows only skins
  const cat = categoryOf(sp.category);
  const type = gadgetType(sp.category); // gadgets sub-category ("earbuds")
  const [brands, res] = await Promise.all([
    getBrands(),
    getProducts({ category: sp.q ? undefined : (type?.cat ?? cat.slug), model: cat.phoneBased ? sp.model : undefined, material: sp.material, sort: sp.sort, q: sp.q, page, limit: 24 }),
  ]);
  const allModels = brands.flatMap((b) => b.models);
  const model = allModels.find((m) => m.slug === sp.model);
  const brandSlug = model?.brand.slug ?? sp.brand;
  const brand = brands.find((b) => b.slug === brandSlug);
  // cards show the camera of the phone picked above: the model, or the brand's newest flagship
  const look = cat.phoneBased ? (model ?? brand?.models[0]) : undefined;
  const noun = cat.slug === "magsafe-cases" ? "MagSafe cases" : cat.name.toLowerCase();
  const title = sp.q
    ? `Results for “${sp.q}”`
    : type
      ? type.name
    : !cat.phoneBased
      ? "All gadgets"
    : model
      ? `${cat.slug === "magsafe-cases" ? "Cases" : cat.name} for ${model.name}`
      : brand
        ? `${brand.name} ${noun}`
        : cat.slug === "magsafe-cases" ? "All MagSafe cases" : `All ${noun}`;

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
          {brand && cat.phoneBased && <> / {brand.name}</>}
          {type && <> / {type.name}</>}
        </nav>
        <h1 className="mt-1 text-[28px] font-bold tracking-tight sm:text-[38px]">{title}</h1>
        <p className="mt-1 text-muted">{res.meta.total} {cat.phoneBased ? (res.meta.total === 1 ? "design" : "designs") : res.meta.total === 1 ? "product" : "products"} · {type ? type.hint : cat.tagline} · Cash on Delivery</p>
      </div>
      <SectionMark section={cat.slug} />

      <ShopFilters brands={brands} current={{ ...sp, category: type?.cat ?? cat.slug, brand: brandSlug }} />

      {res.data.length === 0 ? (
        <div className="card mt-6 p-10 text-center">
          <p className="text-lg font-semibold">No {cat.noun} found</p>
          <p className="mt-1 text-muted">Try another {cat.phoneBased ? cat.stylesLabel.toLowerCase().replace(/s$/, "") : "type"} or clear the filters.</p>
          <Link href={`/shop?category=${cat.slug}`} className="btn btn-primary mt-5">Clear filters</Link>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
          {(res?.data ?? []).map((p, i) => (
            <ProductCard
              key={p.id}
              p={p}
              modelSlug={cat.phoneBased ? model?.slug : undefined}
              modelName={cat.phoneBased ? model?.name : undefined}
              layout={look?.layout}
              phoneHex={look?.bodyHex}
              priority={i < 4}
            />
          ))}
        </div>
      )}

      {(res.meta.hasMore || page > 1) && (
        <div className="mt-8 flex items-center justify-center gap-2">
          <Link href={qs({ page: String(page - 1) })} className={cn("btn btn-glass", page <= 1 && "pointer-events-none opacity-40")} aria-disabled={page <= 1}>
            ← Previous
          </Link>
          <span className="px-3 text-sm text-muted">
            Page {page} of {Math.max(1, Math.ceil(res.meta.total / res.meta.limit))}
          </span>
          <Link href={qs({ page: String(page + 1) })} className={cn("btn btn-glass", !res.meta.hasMore && "pointer-events-none opacity-40")} aria-disabled={!res.meta.hasMore}>
            Next →
          </Link>
        </div>
      )}
    </div>
  );
}

function GridSkeleton() {
  return (
    <div>
      <div className="skeleton h-10 w-72 rounded-2xl" />
      <div className="skeleton mt-6 h-12 w-full rounded-full" />
      <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skeleton aspect-[3/4.4] rounded-[28px]" />
        ))}
      </div>
    </div>
  );
}
