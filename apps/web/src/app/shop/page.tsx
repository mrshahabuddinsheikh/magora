import type { Metadata } from "next";
import { Suspense } from "react";
import { getBrands, getProducts } from "@/lib/api";
import { categoryOf, gadgetType } from "@/lib/categories";
import { ShopCatalog } from "@/components/ShopCatalog";

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

export const dynamic = "force-dynamic";

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
  const cat = categoryOf(sp.category);
  const type = gadgetType(sp.category);
  const [brands, res] = await Promise.all([
    getBrands(),
    getProducts({ category: sp.q ? undefined : (type?.cat ?? cat.slug), model: cat.phoneBased ? sp.model : undefined, material: sp.material, sort: sp.sort, q: sp.q, page, limit: 24 }),
  ]);

  return (
    <ShopCatalog
      brands={brands}
      products={res?.data ?? []}
      total={res.meta.total}
      limit={res.meta.limit}
      page={page}
      hasMore={res.meta.hasMore}
      sp={sp}
    />
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
