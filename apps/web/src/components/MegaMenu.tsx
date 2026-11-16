"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, ImagePlus, Sparkles } from "lucide-react";
import { CaseThumb, ProductThumb } from "./CaseThumb";
import { GadgetThumb } from "./GadgetThumb";
import { api } from "@/lib/client-api";
import { cn, money, shortModel } from "@/lib/format";
import { CATEGORIES, type CategoryDef } from "@/lib/categories";
import type { BrandWithModels, ProductListItem } from "@/lib/types";

/** kept for the mobile menu */
export const MATERIALS = CATEGORIES[0].styles;

export type MegaTab = string; // brand slug or "styles"

const shopUrl = (cat: CategoryDef, extra: string) => `/shop?category=${cat.slug}${extra ? `&${extra}` : ""}`;

/**
 * Ronin-style "crystal" mega menu, one per product line (cases / skins /
 * protectors). Left: brand tabs + "Shop by style". Right: glass tiles.
 */
export function MegaPanel({
  brands,
  category,
  tab,
  setTab,
  onNavigate,
}: {
  brands: BrandWithModels[];
  category: CategoryDef;
  tab: MegaTab;
  setTab: (t: MegaTab) => void;
  onNavigate: () => void;
}) {
  const tabs = [
    ...brands.map((b) => ({ id: b.slug, label: b.name, count: b.models.length })),
    { id: "styles", label: `Shop by ${category.stylesLabel.toLowerCase().replace(/s$/, "")}`, count: category.styles.length },
  ];
  const brand = brands.find((b) => b.slug === tab);
  const thisYear = Math.max(0, ...brands.flatMap((b) => b.models.map((m) => m.year)));
  const sample = category.slug === "skins" ? category.styles[3] : category.styles[0];

  return (
    <div className="grid grid-cols-[230px_1fr] gap-4 pb-4 pt-3">
      <div className={cn("flex flex-col py-1", tabs.length > 6 ? "gap-0.5" : "gap-1.5")} role="tablist" aria-orientation="vertical">
        <p className="mb-1 pl-3 text-[11.5px] font-bold uppercase tracking-wider text-muted">{category.name}</p>
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onMouseEnter={() => setTab(t.id)}
            onFocus={() => setTab(t.id)}
            onClick={() => setTab(t.id)}
            className={cn(
              "-ml-4 flex items-center justify-between rounded-r-full pl-7 pr-5 text-left font-semibold transition-all duration-200",
              tabs.length > 6 ? "h-10 text-[14px]" : "h-12 text-[15px]",
              tab === t.id
                ? "bg-white/60 text-ink shadow-[4px_4px_10px_rgba(15,23,42,0.12),inset_0_1px_0_rgba(255,255,255,0.9)]"
                : "text-ink/60 hover:bg-white/25 hover:text-ink",
            )}
          >
            {t.label}
            <span className="text-[12px] font-medium text-muted">{t.count}</span>
          </button>
        ))}
        <Link href={shopUrl(category, "")} onClick={onNavigate} className="mt-2 flex items-center gap-1.5 pl-3 text-[13.5px] font-semibold text-accent">
          All {category.noun} <ArrowRight size={14} />
        </Link>
      </div>

      <div className="no-scrollbar max-h-[min(58vh,460px)] overflow-y-auto pr-1">
        {brand && (
          <div key={`${category.slug}${brand.slug}`} className="grid animate-rise grid-cols-4 gap-2 xl:grid-cols-6">
            {brand.models.map((m) => (
              <Link
                key={m.slug}
                href={shopUrl(category, `model=${m.slug}`)}
                prefetch={false}
                onClick={onNavigate}
                className="group relative flex flex-col items-center rounded-[18px] border border-white/70 bg-white/35 px-2 pb-2.5 pt-2.5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition duration-200 hover:-translate-y-0.5 hover:bg-white/70 hover:shadow-[0_12px_28px_-14px_rgba(15,23,42,0.35)]"
              >
                {m.year === thisYear && (
                  <span className="absolute right-2 top-2 rounded-full bg-gradient-to-r from-[#4a65ff] to-[#7c3aed] px-1.5 py-0.5 text-[9.5px] font-bold uppercase text-white">New</span>
                )}
                {category.slug === "magsafe-cases" ? (
                  <CaseThumb material="clear" color="#f4f7fb" phoneHex={m.bodyHex ?? "#c9ccd2"} layout={m.layout ?? "bar"} className="h-[58px] w-auto transition duration-300 group-hover:scale-105" />
                ) : (
                  <ProductThumb material={sample.id} color={sample.color} accent={sample.accent} className="h-[58px] w-auto transition duration-300 group-hover:scale-105" />
                )}
                <span className="mt-1.5 text-[12.5px] font-semibold leading-tight">{shortModel(m.name)}</span>
              </Link>
            ))}
            <Link
              href={shopUrl(category, `brand=${brand.slug}`)}
              onClick={onNavigate}
              className="flex flex-col items-center justify-center gap-1 rounded-[18px] border border-dashed border-ink/15 bg-white/20 p-3 text-center text-[13px] font-semibold text-accent hover:bg-white/60"
            >
              All {brand.name} {category.noun} <ArrowRight size={15} />
            </Link>
          </div>
        )}
        {tab === "styles" && (
          <div key={`${category.slug}-styles`} className="grid animate-rise grid-cols-3 gap-2.5 xl:grid-cols-6">
            {category.styles.map((s) => (
              <Link
                key={s.id}
                href={s.id === "skin-custom" ? "/product/custom-photo-skin" : shopUrl(category, `material=${s.id}`)}
                onClick={onNavigate}
                className={cn(
                  "group flex flex-col items-center rounded-[20px] border px-2 pb-3 pt-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition duration-200 hover:-translate-y-0.5 hover:bg-white/70",
                  s.id === "skin-custom" ? "border-[#e9d5ff] bg-gradient-to-b from-white/70 to-[#f5e8ff]/70" : "border-white/70 bg-white/35",
                )}
              >
                <ProductThumb material={s.id} color={s.color} accent={s.accent} className="h-[96px] w-auto transition duration-300 group-hover:scale-105" />
                <span className="mt-2 text-[13.5px] font-bold">{s.name}</span>
                <span className="text-[11.5px] text-muted">{s.hint}</span>
              </Link>
            ))}
          </div>
        )}
        {category.slug === "skins" ? (
          <Link href="/product/custom-photo-skin" onClick={onNavigate} className="mt-3 flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#eef1ff]/80 to-[#fdeaf4]/80 px-3 py-2.5 text-[13px] font-medium text-ink hover:from-white hover:to-white">
            <ImagePlus size={16} className="text-accent-2" /> <b>New:</b> print your own photo on a skin — preview it on your phone in 3D before you order <ArrowRight size={14} className="ml-auto" />
          </Link>
        ) : (
          <div className="mt-3 flex items-center gap-2 rounded-2xl bg-white/30 px-3 py-2 text-[12.5px] text-muted">
            <Sparkles size={14} className="text-accent-2" /> {category.tagline} — pick your phone to see it in 3D.
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────── Gadgets: left = types, right = live products of that type ───────── */

const gadgetCache = new Map<string, ProductListItem[]>();

export function GadgetMegaPanel({ tab, setTab, onNavigate }: { tab: MegaTab; setTab: (t: MegaTab) => void; onNavigate: () => void }) {
  const category = CATEGORIES[3];
  const type = category.styles.find((s) => s.cat === tab) ?? category.styles[0];
  const [items, setItems] = useState<ProductListItem[] | null>(gadgetCache.get(type.cat!) ?? null);

  useEffect(() => {
    const key = type.cat!;
    const hit = gadgetCache.get(key);
    if (hit) {
      queueMicrotask(() => setItems(hit));
      return;
    }
    queueMicrotask(() => setItems(null));
    let live = true;
    api<{ data: ProductListItem[] }>(`/products?category=${key}&limit=8`, { auth: false })
      .then((r) => {
        gadgetCache.set(key, r.data);
        if (live) setItems(r.data);
      })
      .catch(() => live && setItems([]));
    return () => {
      live = false;
    };
  }, [type.cat]);

  return (
    <div className="grid grid-cols-[230px_1fr] gap-4 pb-4 pt-3">
      <div className="flex flex-col gap-1.5 py-1" role="tablist" aria-orientation="vertical">
        <p className="mb-1 pl-3 text-[11.5px] font-bold uppercase tracking-wider text-muted">{category.name}</p>
        {category.styles.map((s) => (
          <button
            key={s.cat}
            role="tab"
            aria-selected={type.cat === s.cat}
            onMouseEnter={() => setTab(s.cat!)}
            onFocus={() => setTab(s.cat!)}
            onClick={() => setTab(s.cat!)}
            className={cn(
              "-ml-4 flex h-12 items-center gap-2.5 rounded-r-full pl-7 pr-5 text-left text-[15px] font-semibold transition-all duration-200",
              type.cat === s.cat
                ? "bg-white/60 text-ink shadow-[4px_4px_10px_rgba(15,23,42,0.12),inset_0_1px_0_rgba(255,255,255,0.9)]"
                : "text-ink/60 hover:bg-white/25 hover:text-ink",
            )}
          >
            <GadgetThumb material={s.id} color={s.color} accent={s.accent} className="h-7 w-7" />
            {s.name}
          </button>
        ))}
        <Link href={category.home} onClick={onNavigate} className="mt-2 flex items-center gap-1.5 pl-3 text-[13.5px] font-semibold text-accent">
          All gadgets <ArrowRight size={14} />
        </Link>
      </div>

      <div className="no-scrollbar max-h-[min(58vh,460px)] overflow-y-auto pr-1">
        <div key={type.cat} className="grid animate-rise grid-cols-3 gap-2.5 xl:grid-cols-5">
          {(items ?? Array.from({ length: 4 }, () => null)).map((p, i) =>
            p ? (
              <Link
                key={p.id}
                href={`/product/${p.slug}`}
                prefetch={false}
                onClick={onNavigate}
                className="group flex flex-col items-center rounded-[20px] border border-white/70 bg-white/35 px-2 pb-3 pt-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition duration-200 hover:-translate-y-0.5 hover:bg-white/70"
              >
                <GadgetThumb material={p.material} color={p.colors[0]?.hex ?? type.color} className="h-[92px] w-auto transition duration-300 group-hover:scale-105" />
                <span className="mt-2 line-clamp-2 text-[13px] font-bold leading-tight">{p.name}</span>
                <span className="mt-0.5 text-[12px] font-semibold text-muted">{money(p.price)}</span>
              </Link>
            ) : (
              <div key={i} className="skeleton h-[150px] rounded-[20px]" />
            ),
          )}
          <Link
            href={`/shop?category=${type.cat}`}
            onClick={onNavigate}
            className="flex min-h-[150px] flex-col items-center justify-center gap-1 rounded-[20px] border border-dashed border-ink/15 bg-white/20 p-3 text-center text-[13px] font-semibold text-accent hover:bg-white/60"
          >
            All {type.name.toLowerCase()} <ArrowRight size={15} />
          </Link>
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-2xl bg-white/30 px-3 py-2 text-[12.5px] text-muted">
          <Sparkles size={14} className="text-accent-2" /> {type.hint} · 6-month replacement warranty · Cash on Delivery
        </div>
      </div>
    </div>
  );
}
