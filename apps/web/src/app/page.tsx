import Link from "next/link";
import { shortModel } from "@/lib/format";
import { ArrowRight, Banknote, Box, Magnet, RotateCcw, ShieldCheck, Smartphone, Sparkles, Truck } from "lucide-react";
import { getBrands, getProduct, getProducts } from "@/lib/api";
import { HeroStage, type HeroProduct } from "@/components/HeroStage";
import { PhoneFinder } from "@/components/PhoneFinder";
import { ProductCard } from "@/components/ProductCard";
import { OtherShops, SectionTitle } from "@/components/home/Blocks";
import { ReelsStoriesSection } from "@/components/reels/ReelsStoriesSection";
import { ShopByPhone } from "@/components/home/ShopByPhone";

const HERO_SLUGS = [
  "crystal-clear-magsafe-case",
  "frosted-matte-magsafe-case",
  "liquid-silicone-magsafe-case",
  "vegan-leather-magsafe-case",
  "aramid-carbon-magnetic-case",
];

const FAQ = [
  ["Will the case fit my exact phone?", "Yes. Every case is made for one specific model — pick your phone on the product page and you’ll see the case on that exact phone in 3D, with the right camera cut-out."],
  ["Do I have to pay in advance?", "No. Cash on Delivery is available all over Pakistan. You pay the rider when your order arrives."],
  ["Does it work with MagSafe chargers and wallets?", "Yes. Every case has a built-in ring of N52 magnets, so it snaps onto MagSafe and Qi2 chargers, wallets, car mounts and stands — even on Samsung and Pixel phones."],
  ["How long does delivery take?", "2–4 working days in major cities. You’ll get an order number to track it any time."],
  ["What if I ordered the wrong model?", "Exchange it within 7 days in its original packaging. Message us on WhatsApp and we’ll sort it out."],
];

export const dynamic = "force-dynamic";

export default async function Home() {
  const [heroData, featured, brands] = await Promise.all([
    Promise.all(HERO_SLUGS.map((s) => getProduct(s))),
    getProducts({ featured: "true", category: "magsafe-cases", limit: 4 }),
    getBrands(),
  ]);
  const heroProducts: HeroProduct[] = heroData
    .filter((p) => p !== null)
    .map((p) => ({ slug: p.slug, name: p.name, material: p.material, price: p.minPrice, colors: p.colors }));
  const heroModel =
    heroData.find(Boolean)?.models.find((m) => m.isHero) ??
    heroData.find(Boolean)?.models.find((m) => m.popular) ??
    heroData.find(Boolean)?.models.find((m) => m.slug === "iphone-18-pro-max") ??
    heroData.find(Boolean)?.models[0];

  return (
    <>
      {/* ───── hero ───── */}
      <section className="grid items-center gap-6 pt-2 lg:grid-cols-[1fr_1.05fr] lg:gap-10 lg:pt-6">
        <div className="animate-rise min-w-0">
          <span className="glass inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold">
            <Sparkles size={14} className="text-accent-2" /> New · See your case in 3D before you buy
          </span>
          <h1 className="mt-4 text-[40px] font-bold leading-[1.02] tracking-[-0.03em] sm:text-[56px] lg:text-[64px]">
            Snaps on.
            <br />
            <span className="heading-gradient">Stays on.</span>
          </h1>
          <p className="mt-4 max-w-lg text-[17px] leading-relaxed text-muted">
            MagSafe-compatible cases for iPhone, Samsung &amp; Pixel. Choose your phone, spin it around in 3D, and pay cash when it arrives.
          </p>
          <div className="mt-7 max-w-xl">
            <PhoneFinder />
          </div>
          <div className="mt-6 flex flex-wrap gap-2 text-[13px] font-medium">
            {[
              [Banknote, "Cash on Delivery"],
              [Truck, "Free delivery over Rs.3,000"],
              [Magnet, "N52 magnets"],
            ].map(([I, t], i) => {
              const Icon = I as typeof Truck;
              return (
                <span key={i} className="glass flex items-center gap-1.5 rounded-full px-3 py-1.5">
                  <Icon size={14} className="text-accent" /> {t as string}
                </span>
              );
            })}
          </div>
        </div>
        <div className="min-w-0">
          {heroModel && heroProducts.length > 0 ? (
            <HeroStage products={heroProducts} spec={heroModel.spec} modelName={heroModel.name} modelSlug={heroModel.slug} />
          ) : (
            <div className="glass grid h-[420px] place-items-center rounded-[32px] text-muted sm:h-[520px]">Start the API to load products</div>
          )}
        </div>
      </section>

      <OtherShops current="magsafe-cases" />

      {/* ───── TikTok / Instagram Shoppable Reels ───── */}
      <ReelsStoriesSection />

      {/* ───── shop by phone (Clean Interactive Tabbed Selector) ───── */}
      <ShopByPhone brands={brands ?? []} category="magsafe-cases" />

      {/* ───── best sellers ───── */}
      <section className="mt-16">
        <SectionTitle eyebrow="Top trending" title="Best-selling MagSafe cases" href="/shop?category=magsafe-cases" />
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {(featured?.data ?? []).map((p, i) => (
            <ProductCard key={p.id} p={p} priority={i < 4} />
          ))}
        </div>
      </section>

      {/* ───── how it works ───── */}
      <section className="mt-16">
        <SectionTitle eyebrow="Easy as 1-2-3" title="How it works" />
        <div className="grid gap-4 md:grid-cols-3">
          {[
            [Smartphone, "Pick your phone", "Type your model or choose from the list — we remember it for next time."],
            [Box, "See it in 3D", "Rotate, zoom and switch colours. What you see is the exact cut-out for your phone."],
            [Banknote, "Pay on delivery", "No advance payment. Pay the rider in cash when your case arrives in 2–4 days."],
          ].map(([I, t, d], i) => {
            const Icon = I as typeof Truck;
            return (
              <div key={i} className="glass rounded-[28px] p-6">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-[#4a65ff] to-[#7c3aed] text-white shadow-lg">
                    <Icon size={20} />
                  </span>
                  <span className="text-sm font-bold text-muted">Step {i + 1}</span>
                </div>
                <h3 className="mt-4 text-lg font-bold">{t as string}</h3>
                <p className="mt-1 text-[14.5px] leading-relaxed text-muted">{d as string}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ───── why us ───── */}
      <section className="mt-16">
        <div className="card overflow-hidden p-6 sm:p-10">
          <h2 className="text-center text-[28px] font-bold tracking-tight sm:text-[36px]">
            <span className="heading-gradient">Exceptional quality,</span> delivered
          </h2>
          <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              [Magnet, "Strong magnets", "N52 ring, ~1,500 gf hold"],
              [ShieldCheck, "Drop tested", "Up to 2.4 m (8 ft)"],
              [RotateCcw, "7-day exchange", "Wrong model? No problem"],
              [Truck, "Nationwide COD", "Every city in Pakistan"],
            ].map(([I, t, d], i) => {
              const Icon = I as typeof Truck;
              return (
                <div key={i} className="rounded-[22px] bg-black/[0.03] p-4 text-center">
                  <Icon size={26} className="mx-auto text-accent" />
                  <p className="mt-2 font-bold">{t as string}</p>
                  <p className="text-[13px] text-muted">{d as string}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ───── FAQ ───── */}
      <section className="mt-16 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <p className="text-sm font-bold uppercase tracking-wider text-accent">FAQs</p>
          <h2 className="mt-2 text-[30px] font-bold leading-tight tracking-tight">Questions? We’ve got answers.</h2>
          <p className="mt-3 text-muted">Still unsure? Tap the WhatsApp button — we reply fast.</p>
        </div>
        <div className="card divide-y divide-line px-5 sm:px-7">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                {q}
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-black/5 transition group-open:rotate-45">+</span>
              </summary>
              <p className="pt-2 text-[14.5px] leading-relaxed text-muted">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ───── CTA ───── */}
      <section className="mt-16 overflow-hidden rounded-[32px] bg-[#0b0d12] p-8 text-white sm:p-12">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div>
            <h2 className="text-[28px] font-bold tracking-tight sm:text-[36px]">Your phone deserves a better case.</h2>
            <p className="mt-2 text-white/70">Pick your model and see it in 3D — it takes 10 seconds.</p>
          </div>
          <Link href="/shop?category=magsafe-cases" className="btn h-[52px] bg-white px-6 text-ink hover:bg-white/90">
            Shop all cases <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </>
  );
}
