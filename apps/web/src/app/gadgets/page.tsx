import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Banknote, BatteryCharging, Box, Magnet, RotateCcw, ShieldCheck, Sparkles, Truck, Wrench, Zap } from "lucide-react";
import { getProduct, getProducts } from "@/lib/api";
import { GadgetStage, type StageGadget } from "@/components/home/GadgetStage";
import { GadgetThumb } from "@/components/GadgetThumb";
import { ProductCard } from "@/components/ProductCard";
import { Cta, Faq, OtherShops, Quality, SectionTitle, Steps } from "@/components/home/Blocks";
import { CATEGORIES } from "@/lib/categories";
import { money } from "@/lib/format";

export const metadata: Metadata = {
  title: "Gadgets — Earbuds, Smart Watches, Power Banks & Chargers",
  description: "Earbuds, smart watches, magnetic power banks, fast chargers, cables and handsfree — see them in 3D, 6-month warranty, cash on delivery across Pakistan.",
  alternates: { canonical: "/gadgets" },
};

const section = CATEGORIES[3];

export default async function GadgetsHome() {
  const all = await getProducts({ category: "gadgets", limit: 60 });
  const allList = all?.data ?? [];
  // one hero product per type, in the order of the menu
  const heroSlugs = section.styles.map((s) => allList.find((p) => p.category === s.cat)?.slug).filter((s): s is string => !!s);
  const heroData = (await Promise.all(heroSlugs.map((s) => getProduct(s)))).filter((p) => p !== null);
  const stage: StageGadget[] = heroData.map((p) => ({ slug: p.slug, name: p.name, material: p.material, price: p.minPrice, colors: p.colors }));
  const best = allList.filter((p) => p.badge === "Best Seller").concat(allList.filter((p) => p.badge !== "Best Seller")).slice(0, 8);
  const from = (cat?: string) => {
    const prices = allList.filter((p) => p.category === cat).map((p) => p.price);
    return prices.length ? Math.min(...prices) : 0;
  };
  const magnetic = allList.find((p) => p.slug === "magsafe-power-bank-5000");

  return (
    <>
      {/* ───── hero ───── */}
      <section className="grid items-center gap-6 pt-2 lg:grid-cols-[1fr_1.05fr] lg:gap-10 lg:pt-6">
        <div className="animate-rise min-w-0">
          <span className="glass inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold">
            <Sparkles size={14} className="text-accent-2" /> New · Gadgets you can spin in 3D
          </span>
          <h1 className="mt-4 text-[40px] font-bold leading-[1.02] tracking-[-0.03em] sm:text-[56px] lg:text-[64px]">
            Charge. Listen.
            <br />
            <span className="heading-gradient">Stay connected.</span>
          </h1>
          <p className="mt-4 max-w-lg text-[17px] leading-relaxed text-muted">
            Earbuds, smart watches, power banks, fast chargers and cables that work with every phone. 6-month warranty, pay cash when it arrives.
          </p>
          <div className="mt-7 grid max-w-xl grid-cols-2 gap-2 sm:grid-cols-3">
            {section.styles.map((s) => (
              <Link key={s.cat} href={`/shop?category=${s.cat}`} className="glass-strong group flex items-center gap-2 rounded-2xl p-2 pr-3 transition hover:-translate-y-0.5">
                <GadgetThumb material={s.id} color={s.color} accent={s.accent} className="h-9 w-9 shrink-0 transition group-hover:scale-110" />
                <span className="text-[13px] font-semibold leading-tight">{s.name.replace("Charging ", "")}</span>
              </Link>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-2 text-[13px] font-medium">
            {(
              [
                [Banknote, "Cash on Delivery"],
                [Wrench, "6-month warranty"],
                [Truck, "Free delivery over Rs.3,000"],
              ] as const
            ).map(([Icon, t]) => (
              <span key={t} className="glass flex items-center gap-1.5 rounded-full px-3 py-1.5">
                <Icon size={14} className="text-accent" /> {t}
              </span>
            ))}
          </div>
        </div>
        <div className="min-w-0">
          {stage.length > 0 ? (
            <GadgetStage products={stage} />
          ) : (
            <div className="glass grid h-[420px] place-items-center rounded-[32px] text-muted sm:h-[520px]">Start the API to load products</div>
          )}
        </div>
      </section>

      <OtherShops current="gadgets" />

      {/* ───── shop by type ───── */}
      <section className="mt-14">
        <SectionTitle eyebrow="Shop by type" title="Find your next gadget" href="/shop?category=gadgets" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {section.styles.map((s) => (
            <Link key={s.cat} href={`/shop?category=${s.cat}`} className="card group flex flex-col items-center p-4 text-center transition duration-300 hover:-translate-y-1">
              <span className="grid h-36 w-full place-items-center rounded-[20px] bg-gradient-to-b from-[#f4f5f9] to-[#e9ebf1]">
                <GadgetThumb material={s.id} color={s.color} accent={s.accent} className="h-[110px] w-auto transition duration-500 group-hover:scale-105" />
              </span>
              <b className="mt-3 text-[15px]">{s.name}</b>
              <span className="text-[12.5px] text-muted">{s.hint}</span>
              {Number.isFinite(from(s.cat)) && <span className="mt-1 text-[12.5px] font-semibold">from {money(from(s.cat))}</span>}
            </Link>
          ))}
        </div>
      </section>

      {/* ───── best sellers ───── */}
      {best.length > 0 && (
        <section className="mt-16">
          <SectionTitle eyebrow="Top trending" title="Best-selling gadgets" href="/shop?category=gadgets" />
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {best.map((p, i) => (
              <ProductCard key={p.id} p={p} priority={i < 4} />
            ))}
          </div>
        </section>
      )}

      {/* ───── works with your MagSafe case ───── */}
      {magnetic && (
        <section className="mt-16">
          <div className="card grid items-center gap-6 overflow-hidden bg-gradient-to-br from-white/90 to-[#eef1ff]/90 p-6 sm:grid-cols-[auto_1fr] sm:p-10">
            <div className="flex justify-center">
              <GadgetThumb material="gadget-powerbank" color="#c9bde8" accent="#a796d8" className="h-[170px] w-auto" />
            </div>
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eef1ff] px-3 py-1 text-[12px] font-bold uppercase text-accent">
                <Magnet size={13} /> Snaps on
              </span>
              <h2 className="mt-3 text-[26px] font-bold leading-tight tracking-tight sm:text-[34px]">A power bank that sticks to your phone.</h2>
              <p className="mt-2 max-w-xl text-muted">
                The magnetic power bank snaps onto MagSafe iPhones — and onto any Samsung or Pixel wearing one of our MagSafe cases. No cables, just charge.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link href={`/product/${magnetic.slug}`} className="btn btn-primary h-12 px-5">
                  {magnetic.name} · {money(magnetic.price)} <ArrowRight size={17} />
                </Link>
                <Link href="/" className="btn btn-glass h-12 px-5">
                  See MagSafe cases
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="mt-16">
        <SectionTitle eyebrow="Easy as 1-2-3" title="How it works" />
        <Steps
          steps={[
            [Box, "See it in 3D", "Spin every gadget around, switch colours and options before you buy."],
            [Zap, "Pick your option", "Cable length, colour or pack — the price updates instantly."],
            [Banknote, "Pay on delivery", "No advance payment. Delivered in 2–4 days, pay the rider in cash."],
          ]}
        />
      </section>

      <section className="mt-16">
        <Quality
          accent="Tested gadgets,"
          title="real warranty"
          items={[
            [ShieldCheck, "6-month warranty", "Free replacement"],
            [BatteryCharging, "Fast charging", "PD, GaN & Qi2"],
            [RotateCcw, "7-day returns", "Sealed & unused"],
            [Truck, "Nationwide COD", "Every city in Pakistan"],
          ]}
        />
      </section>

      <Faq
        items={[
          ["Will it work with my phone?", "Yes — earbuds, watches, chargers and power banks work with both iPhone and Android. For cables, pick USB-C for iPhone 15 and newer, Samsung and Pixel, or Lightning for iPhone 14 and older."],
          ["What does the 6-month warranty cover?", "Any manufacturing fault. Message us on WhatsApp with your order number and we’ll replace it — no repair wait."],
          ["Do I have to pay in advance?", "No. Cash on Delivery is available all over Pakistan. You pay the rider when your order arrives."],
          ["Which charger do I need?", "20W is perfect for one phone. 35W charges a phone and earbuds together, and 65W GaN also charges tablets and laptops."],
          ["Can I return it?", "Yes, within 7 days if it’s sealed and unused. Faulty items are covered by the warranty."],
        ]}
      />
      <Cta title="Gear up your phone." text="Earbuds, watches, power banks & more — delivered in 2–4 days, pay cash at your door." href="/shop?category=gadgets" label="Shop all gadgets" />
    </>
  );
}
