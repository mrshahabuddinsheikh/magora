import Link from "next/link";
import { shortModel } from "@/lib/format";
import { ArrowRight, Banknote, ImagePlus, Smartphone, Sparkles, Truck } from "lucide-react";
import { getBrands, getProduct, getProducts } from "@/lib/api";
import { HeroStage, type HeroProduct } from "../HeroStage";
import { PhoneFinder } from "../PhoneFinder";
import { ProductCard } from "../ProductCard";
import { ProductThumb, SkinThumb } from "../CaseThumb";
import { ShopByPhone } from "./ShopByPhone";
import { Cta, Faq, OtherShops, Quality, SectionTitle, Steps } from "./Blocks";
import type { CategoryDef } from "@/lib/categories";

export interface PhoneSectionCopy {
  eyebrow: string;
  h1: [string, string];
  intro: string;
  pills: [typeof Truck, string][];
  steps: [typeof Truck, string, string][];
  quality: { accent: string; title: string; items: [typeof Truck, string, string][] };
  faq: [string, string][];
  cta: { title: string; text: string; label: string };
}

const FALLBACK_BRANDS = [
  {
    name: "Apple",
    slug: "apple",
    models: [
      { name: "iPhone 16 Pro Max", slug: "iphone-16-pro-max" },
      { name: "iPhone 16 Pro", slug: "iphone-16-pro" },
      { name: "iPhone 16", slug: "iphone-16" },
      { name: "iPhone 15 Pro Max", slug: "iphone-15-pro-max" },
      { name: "iPhone 15 Pro", slug: "iphone-15-pro" },
      { name: "iPhone 14 Pro Max", slug: "iphone-14-pro-max" },
    ],
  },
  {
    name: "Samsung",
    slug: "samsung",
    models: [
      { name: "Galaxy S24 Ultra", slug: "samsung-s24-ultra" },
      { name: "Galaxy S24 Plus", slug: "samsung-s24-plus" },
      { name: "Galaxy S24", slug: "samsung-s24" },
      { name: "Galaxy S23 Ultra", slug: "samsung-s23-ultra" },
      { name: "Galaxy Z Fold 6", slug: "samsung-z-fold-6" },
    ],
  },
  {
    name: "Google Pixel",
    slug: "google-pixel",
    models: [
      { name: "Pixel 9 Pro XL", slug: "pixel-9-pro-xl" },
      { name: "Pixel 9 Pro", slug: "pixel-9-pro" },
      { name: "Pixel 9", slug: "pixel-9" },
      { name: "Pixel 8 Pro", slug: "pixel-8-pro" },
    ],
  },
];

const FALLBACK_HERO_PRODUCTS: HeroProduct[] = [
  { slug: "matte-black-skin", name: "Matte Stealth Black Skin", material: "skin-solid", price: 1499, colors: [{ id: 1, name: "Stealth Black", hex: "#1c1d1f" }] },
  { slug: "carbon-fiber-skin", name: "3D Textured Carbon Fiber Skin", material: "skin-carbon", price: 1699, colors: [{ id: 2, name: "Carbon Fiber", hex: "#111111" }] },
  { slug: "white-marble-skin", name: "Carrara White Marble Skin", material: "skin-marble", price: 1799, colors: [{ id: 3, name: "White Marble", hex: "#f0f2f5" }] },
];

const FALLBACK_HERO_SPEC = { width: 77.6, height: 163.0, depth: 8.25, cornerRadius: 21, camera: { x: 19.5, y: 130.5, w: 38.5, h: 38.5, r: 10 } };

/** Home page of a phone-fitted shop (skins, screen protectors) — same layout language as the cases home. */
export async function PhoneSectionHome({ section, copy }: { section: CategoryDef; copy: PhoneSectionCopy }) {
  const [list, brandsRes] = await Promise.all([getProducts({ category: section.slug, limit: 12 }), getBrands()]);
  const brands = brandsRes && brandsRes.length > 0 ? brandsRes : FALLBACK_BRANDS;
  const heroSlugs = list.data.filter((p) => p.material !== "skin-custom").slice(0, 5).map((p) => p.slug);
  const heroData = (await Promise.all(heroSlugs.map((s) => getProduct(s)))).filter((p) => p !== null);
  const heroProducts: HeroProduct[] = heroData.length > 0
    ? heroData.map((p) => ({ slug: p.slug, name: p.name, material: p.material, price: p.minPrice, colors: p.colors }))
    : FALLBACK_HERO_PRODUCTS;
  const heroModel =
    heroData[0]?.models.find((m) => m.isHero) ??
    heroData[0]?.models.find((m) => m.popular) ??
    heroData[0]?.models.find((m) => m.slug === "iphone-16-pro-max") ??
    heroData[0]?.models[0] ??
    { name: "iPhone 16 Pro Max", slug: "iphone-16-pro-max", spec: FALLBACK_HERO_SPEC };
  const best = list.data.slice(0, 4);
  const shop = `/shop?category=${section.slug}`;

  return (
    <>
      {/* ───── hero ───── */}
      <section className="grid items-center gap-6 pt-2 lg:grid-cols-[1fr_1.05fr] lg:gap-10 lg:pt-6">
        <div className="animate-rise min-w-0">
          <span className="glass inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold">
            <Sparkles size={14} className="text-accent-2" /> {copy.eyebrow}
          </span>
          <h1 className="mt-4 text-[40px] font-bold leading-[1.02] tracking-[-0.03em] sm:text-[56px] lg:text-[64px]">
            {copy.h1[0]}
            <br />
            <span className="heading-gradient">{copy.h1[1]}</span>
          </h1>
          <p className="mt-4 max-w-lg text-[17px] leading-relaxed text-muted">{copy.intro}</p>
          <div className="mt-7 max-w-xl">
            <PhoneFinder category={section.slug} noun={section.noun} />
          </div>
          <div className="mt-6 flex flex-wrap gap-2 text-[13px] font-medium">
            {copy.pills.map(([Icon, t]) => (
              <span key={t} className="glass flex items-center gap-1.5 rounded-full px-3 py-1.5">
                <Icon size={14} className="text-accent" /> {t}
              </span>
            ))}
          </div>
        </div>
        <div className="min-w-0">
          <HeroStage products={heroProducts} spec={heroModel.spec} modelName={heroModel.name} modelSlug={heroModel.slug} />
        </div>
      </section>

      <OtherShops current={section.slug} />

      {/* ───── custom photo (skins only) ───── */}
      {section.slug === "skins" && (
        <section className="mt-14">
          <Link href="/product/custom-photo-skin" className="card group grid items-center gap-6 overflow-hidden bg-gradient-to-br from-white/90 to-[#f6ecff]/90 p-6 sm:grid-cols-[1fr_auto] sm:p-10">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#7c3aed] to-[#e11d74] px-3 py-1 text-[12px] font-bold uppercase text-white">
                <ImagePlus size={13} /> Custom photo skin
              </span>
              <h2 className="mt-3 text-[28px] font-bold leading-tight tracking-tight sm:text-[36px]">Your photo. Your phone. Printed &amp; laser-cut.</h2>
              <p className="mt-2 max-w-xl text-muted">Upload any picture — family, pet, artwork — and see it wrapped on your exact phone in 3D before you order. We print it in HD and cut it to fit your camera perfectly.</p>
              <span className="btn btn-primary mt-5 h-12 px-5">
                Upload your photo <ArrowRight size={17} />
              </span>
            </div>
            <div className="flex justify-center gap-3">
              <SkinThumb material="skin-custom" color="#f5d0fe" className="h-[180px] w-auto -rotate-6 transition duration-500 group-hover:-rotate-3 sm:h-[220px]" />
              <SkinThumb material="skin-marble" color="#eef0f2" accent="#9aa1ab" className="mt-6 h-[180px] w-auto rotate-6 transition duration-500 group-hover:rotate-3 sm:h-[220px]" />
            </div>
          </Link>
        </section>
      )}

      {/* ───── shop by style ───── */}
      <section className="mt-14">
        <SectionTitle eyebrow={section.stylesLabel} title={`Shop by ${section.stylesLabel.toLowerCase().replace(/s$/, "")}`} href={shop} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {section.styles.map((s) => (
            <Link
              key={s.id}
              href={s.id === "skin-custom" ? "/product/custom-photo-skin" : `${shop}&material=${s.id}`}
              className="card group flex flex-col items-center p-4 text-center transition duration-300 hover:-translate-y-1"
            >
              <span className="grid h-36 w-full place-items-center rounded-[20px] bg-gradient-to-b from-[#f4f5f9] to-[#e9ebf1]">
                <ProductThumb material={s.id} color={s.color} accent={s.accent} className="h-[120px] w-auto transition duration-500 group-hover:scale-105" />
              </span>
              <b className="mt-3 text-[15px]">{s.name}</b>
              <span className="text-[12.5px] text-muted">{s.hint}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ───── shop by phone ───── */}
      <ShopByPhone brands={brands as any} category={section.slug} />

      {/* ───── best sellers ───── */}
      {best.length > 0 && (
        <section className="mt-16">
          <SectionTitle eyebrow="Top trending" title={`Best-selling ${section.noun}`} href={shop} />
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {best.map((p, i) => (
              <ProductCard key={p.id} p={p} priority={i < 4} />
            ))}
          </div>
        </section>
      )}

      <section className="mt-16">
        <SectionTitle eyebrow="Easy as 1-2-3" title="How it works" />
        <Steps steps={copy.steps} />
      </section>

      <section className="mt-16">
        <Quality {...copy.quality} />
      </section>

      <Faq items={copy.faq} />
      <Cta title={copy.cta.title} text={copy.cta.text} href={shop} label={copy.cta.label} />
    </>
  );
}

export const COD_PILL: [typeof Truck, string] = [Banknote, "Cash on Delivery"];
