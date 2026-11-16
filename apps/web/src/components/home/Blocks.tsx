import Link from "next/link";
import { ArrowRight, Truck } from "lucide-react";
import { ProductThumb } from "../CaseThumb";
import { SectionIcon } from "../SectionIcon";
import { CATEGORIES } from "@/lib/categories";
import type { CategorySlug } from "@/lib/types";

export function SectionTitle({ eyebrow, title, href }: { eyebrow: string; title: string; href?: string }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <p className="text-sm font-bold uppercase tracking-wider text-accent">{eyebrow}</p>
        <h2 className="mt-1 text-[26px] font-bold tracking-tight sm:text-[32px]">{title}</h2>
      </div>
      {href && (
        <Link href={href} className="btn btn-glass h-10 shrink-0 px-4 text-[13.5px]">
          View all <ArrowRight size={15} />
        </Link>
      )}
    </div>
  );
}

/* artwork for each shop's mini card */
const ART: Record<CategorySlug, [string, string, string?][]> = {
  "magsafe-cases": [["silicone", "#f08a3c"], ["clear", "#f4f7fb"]],
  skins: [["skin-marble", "#1c1d20", "#c9cdd3"], ["skin-custom", "#fff"]],
  "screen-protectors": [["glass-privacy", "#2b2f36"], ["glass-clear", "#e8f1fb"]],
  gadgets: [["gadget-earbuds", "#f4f5f7", "#d9dce1"], ["gadget-watch", "#1f2126", "#f07a2a"]],
};

/** The other shops as small cards — the current shop stays the star of the page. */
export function OtherShops({ current }: { current: CategorySlug }) {
  return (
    <section className="mt-10" aria-label="Our other shops">
      <p className="mb-3 text-[12.5px] font-bold uppercase tracking-wider text-muted">Also in the store</p>
      <div className="no-scrollbar -mx-3 flex snap-x gap-2.5 overflow-x-auto px-3 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0">
        {CATEGORIES.filter((c) => c.slug !== current).map((c) => (
          <Link
            key={c.slug}
            href={c.home}
            className="glass group flex w-[78%] shrink-0 snap-start items-center gap-3 rounded-[22px] p-2.5 pr-4 transition hover:-translate-y-0.5 hover:bg-white/80 sm:w-auto"
          >
            <span className="flex h-16 w-[72px] shrink-0 items-end justify-center overflow-hidden rounded-2xl bg-gradient-to-b from-[#f4f5f9] to-[#e6e8ee] pt-1.5">
              {ART[c.slug].map(([m, col, acc], i) => (
                <ProductThumb key={i} material={m} color={col} accent={acc} className={`h-[54px] w-auto ${i ? "-ml-4 translate-y-1" : ""}`} />
              ))}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-[15px] font-bold">
                <SectionIcon slug={c.slug} size={15} className="text-accent" /> {c.name}
                {c.slug === "gadgets" && <span className="rounded-full bg-gradient-to-r from-[#7c3aed] to-[#e11d74] px-1.5 py-px text-[9.5px] font-bold uppercase text-white">New</span>}
              </span>
              <span className="line-clamp-1 text-[12.5px] text-muted">{c.tagline}</span>
            </span>
            <ArrowRight size={16} className="shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-ink" />
          </Link>
        ))}
      </div>
    </section>
  );
}

export function Steps({ steps }: { steps: [typeof Truck, string, string][] }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {steps.map(([Icon, t, d], i) => (
        <div key={i} className="glass rounded-[28px] p-6">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-[#4a65ff] to-[#7c3aed] text-white shadow-lg">
              <Icon size={20} />
            </span>
            <span className="text-sm font-bold text-muted">Step {i + 1}</span>
          </div>
          <h3 className="mt-4 text-lg font-bold">{t}</h3>
          <p className="mt-1 text-[14.5px] leading-relaxed text-muted">{d}</p>
        </div>
      ))}
    </div>
  );
}

export function Quality({ title, accent, items }: { title: string; accent: string; items: [typeof Truck, string, string][] }) {
  return (
    <div className="card overflow-hidden p-6 sm:p-10">
      <h2 className="text-center text-[28px] font-bold tracking-tight sm:text-[36px]">
        <span className="heading-gradient">{accent}</span> {title}
      </h2>
      <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        {items.map(([Icon, t, d], i) => (
          <div key={i} className="rounded-[22px] bg-black/[0.03] p-4 text-center">
            <Icon size={26} className="mx-auto text-accent" />
            <p className="mt-2 font-bold">{t}</p>
            <p className="text-[13px] text-muted">{d}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Faq({ items }: { items: [string, string][] }) {
  return (
    <section className="mt-16 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
      <div>
        <p className="text-sm font-bold uppercase tracking-wider text-accent">FAQs</p>
        <h2 className="mt-2 text-[30px] font-bold leading-tight tracking-tight">Questions? We’ve got answers.</h2>
        <p className="mt-3 text-muted">Still unsure? Tap the WhatsApp button — we reply fast.</p>
      </div>
      <div className="card divide-y divide-line px-5 sm:px-7">
        {items.map(([q, a]) => (
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
  );
}

export function Cta({ title, text, href, label }: { title: string; text: string; href: string; label: string }) {
  return (
    <section className="mt-16 overflow-hidden rounded-[32px] bg-[#0b0d12] p-8 text-white sm:p-12">
      <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
        <div>
          <h2 className="text-[28px] font-bold tracking-tight sm:text-[36px]">{title}</h2>
          <p className="mt-2 text-white/70">{text}</p>
        </div>
        <Link href={href} className="btn h-[52px] bg-white px-6 text-ink hover:bg-white/90">
          {label} <ArrowRight size={18} />
        </Link>
      </div>
    </section>
  );
}
