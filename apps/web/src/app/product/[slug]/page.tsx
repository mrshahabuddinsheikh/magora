import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getProduct, getProducts, getStore } from "@/lib/api";
import { RecentlyViewed } from "@/components/ProductExtras";
import { ProductClient } from "@/components/ProductClient";
import { GadgetProductClient } from "@/components/GadgetProductClient";
import { SectionMark } from "@/components/SectionMark";
import { categoryOf } from "@/lib/categories";
import { Reviews } from "@/components/Reviews";
import { ProductCard } from "@/components/ProductCard";
import { SITE_URL } from "@/lib/config";

/** Pre-render the best sellers at build; every other product renders once on first visit, then is cached. */
export async function generateStaticParams() {
  try {
    const res = await getProducts({ limit: 30 });
    const slugs = res?.data?.map((p) => ({ slug: p.slug })) ?? [];
    return slugs.length ? slugs : [{ slug: "crystal-clear-magsafe-case" }];
  } catch {
    return [{ slug: "crystal-clear-magsafe-case" }];
  }
}

export async function generateMetadata(props: PageProps<"/product/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const p = await getProduct(slug);
  if (!p) return { title: "Case not found" };
  const gadget = p.category?.section === "gadgets";
  const title = gadget
    ? `${p.name} — ${p.category?.name?.replace(/s$/, "") ?? "Gadget"} · Cash on Delivery`
    : `${p.name} — ${p.category?.slug === "magsafe-cases" ? "MagSafe case" : p.category?.name?.replace(/s$/, "") ?? ""} for iPhone, Samsung & Pixel`;
  const productPrice = p.minPrice || p.basePrice || 0;
  const desc = `${p.subtitle}. From Rs. ${productPrice.toLocaleString()} — Cash on delivery across Pakistan.`;
  const imageUrl = (p as any).images?.[0] || (p as any).image || `${SITE_URL}/opengraph-image.jpg`;

  return {
    title,
    description: desc,
    alternates: { canonical: `/product/${p.slug}` },
    openGraph: {
      title,
      description: desc,
      url: `${SITE_URL}/product/${p.slug}`,
      siteName: "Magora",
      type: "website",
      locale: "en_PK",
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: p.name,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: desc,
      images: [imageUrl],
    },
  };
}

export default function ProductPage(props: PageProps<"/product/[slug]">) {
  return (
    <Suspense fallback={<PdpSkeleton />}>
      <Pdp params={props.params} />
    </Suspense>
  );
}

async function Pdp({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await getProduct(slug);
  if (!p) notFound();
  const [more, store] = await Promise.all([getProducts({ category: p.category?.slug, limit: 5 }), getStore()]);
  const delivery = store?.shipping.etaByCity
    ? { cities: store.cities, etaByCity: store.shipping.etaByCity, etaDefault: store.shipping.etaDefault ?? [3, 5], freeAbove: store.shipping.freeAbove, flatRate: store.shipping.flatRate }
    : null;
  const section = categoryOf(p.category?.section ?? p.category?.slug);
  const gadget = section.slug === "gadgets";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description: p.description,
    sku: String(p.id),
    url: `${SITE_URL}/product/${p.slug}`,
    brand: { "@type": "Brand", name: process.env.NEXT_PUBLIC_STORE_NAME ?? "Magora" },
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "PKR",
      lowPrice: p.minPrice,
      highPrice: Math.max(...p.variants.map((v) => v.price)),
      offerCount: p.variants.length,
      availability: p.variants.some((v) => v.inStock) ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
    ...(p.ratingCount ? { aggregateRating: { "@type": "AggregateRating", ratingValue: p.ratingAvg, reviewCount: p.ratingCount } } : {}),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <nav className="mb-4 text-[13px] text-muted">
        <Link href={section.home} className="hover:text-ink">{section.name}</Link>
        {gadget && <> / <Link href={`/shop?category=${p.category.slug}`} className="hover:text-ink">{p.category.name}</Link></>} / <span className="text-ink">{p.name}</span>
      </nav>
      <SectionMark section={section.slug} />
      {gadget ? <GadgetProductClient product={p} delivery={delivery} /> : <ProductClient product={p} delivery={delivery} />}
      <Reviews slug={p.slug} ratingAvg={p.ratingAvg} ratingCount={p.ratingCount} />
      <section className="mt-12">
        <h2 className="mb-5 text-[26px] font-bold tracking-tight">You may also like</h2>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {more.data.filter((x) => x.slug !== p.slug).slice(0, 4).map((x) => (
            <ProductCard key={x.id} p={x} />
          ))}
        </div>
      </section>
      <RecentlyViewed current={p.slug} />
    </>
  );
}

function PdpSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.12fr_1fr]">
      <div className="skeleton h-[440px] rounded-[32px] sm:h-[620px]" />
      <div className="space-y-3">
        <div className="skeleton h-10 w-3/4 rounded-2xl" />
        <div className="skeleton h-6 w-1/2 rounded-2xl" />
        <div className="skeleton h-64 rounded-[28px]" />
      </div>
    </div>
  );
}
