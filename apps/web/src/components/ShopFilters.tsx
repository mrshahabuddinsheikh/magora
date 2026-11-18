"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { cn, shortModel } from "@/lib/format";
import { categoryOf } from "@/lib/categories";
import { GadgetThumb } from "./GadgetThumb";
import { usePrefs } from "@/stores/prefs";
import type { BrandWithModels } from "@/lib/types";

type Cur = { category?: string; brand?: string; model?: string; material?: string; sort?: string; q?: string };

export function ShopFilters({
  brands,
  current,
  activeBrand,
  activeModel,
  onChange,
}: {
  brands: BrandWithModels[];
  current: Cur;
  activeBrand?: string;
  activeModel?: string;
  onChange?: (patch: Partial<Cur>) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const setPhone = usePrefs((s) => s.setPhone);

  const curBrandSlug = activeBrand !== undefined ? activeBrand : current.brand;
  const curModelSlug = activeModel !== undefined ? activeModel : current.model;

  const go = (patch: Partial<Cur>) => {
    if (onChange) {
      onChange(patch);
      return;
    }
    const next: Record<string, string | undefined> = { ...current, ...patch };
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) if (v) u.set(k, v);
    start(() => router.push(`/shop?${u}`, { scroll: false }));
  };

  const brand = brands.find((b) => b.slug === curBrandSlug);
  const cat = categoryOf(current.category);

  return (
    <div className={cn("glass sticky top-[84px] z-20 rounded-[26px] p-2 transition-opacity", pending && "opacity-70")}>
      <div className="no-scrollbar flex items-center gap-2 overflow-x-auto">
        <span className="hidden items-center gap-1.5 pl-2 pr-1 text-sm font-semibold text-muted sm:flex">
          <SlidersHorizontal size={15} /> Filter
        </span>
        {cat.phoneBased ? (
          <>
            <button className="chip" data-active={!curBrandSlug && !curModelSlug} onClick={() => go({ brand: undefined, model: undefined })}>
              All phones
            </button>
            {brands.map((b) => (
              <button key={b.slug} className="chip" data-active={curBrandSlug === b.slug} onClick={() => go({ brand: b.slug, model: undefined })}>
                {b.name}
              </button>
            ))}
            <span className="mx-1 h-6 w-px shrink-0 bg-black/10" />
          </>
        ) : (
          <>
            <button className="chip" data-active={current.category === cat.slug} onClick={() => go({ category: cat.slug, brand: undefined, model: undefined })}>
              All gadgets
            </button>
            {cat.styles.map((s) => (
              <button key={s.cat} className="chip" data-active={current.category === s.cat} onClick={() => go({ category: s.cat, brand: undefined, model: undefined })}>
                <GadgetThumb material={s.id} color={s.color} accent={s.accent} className="h-5 w-5" /> {s.name}
              </button>
            ))}
          </>
        )}
        {cat.phoneBased && cat.styles.map((s) => (
          <button key={s.id} className="chip" data-active={current.material === s.id} onClick={() => go({ material: current.material === s.id ? undefined : s.id })}>
            <span className="h-3 w-3 rounded-full border border-black/10" style={{ background: s.color }} /> {s.name}
          </button>
        ))}
        <select
          value={current.sort ?? ""}
          onChange={(e) => go({ sort: e.target.value || undefined })}
          className="chip ml-auto shrink-0 cursor-pointer pr-2 outline-none"
          aria-label="Sort"
        >
          <option value="">Sort: Popular</option>
          <option value="newest">Newest</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
          <option value="rating">Top rated</option>
        </select>
      </div>

      {brand && cat.phoneBased && (
        <div className="no-scrollbar mt-2 flex items-center gap-2 overflow-x-auto border-t border-white/70 pt-2">
          {brand.models.map((m) => (
            <button
              key={m.slug}
              className="chip h-8 text-[13px]"
              data-active={curModelSlug === m.slug}
              onClick={() => {
                setPhone({ slug: m.slug, name: m.name, brand: m.brand.slug });
                go({ model: curModelSlug === m.slug ? undefined : m.slug, brand: brand.slug });
              }}
            >
              {shortModel(m.name)}
              {curModelSlug === m.slug && <X size={13} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
