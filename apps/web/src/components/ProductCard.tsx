"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { ProductThumb } from "./CaseThumb";
import { cardPhoto, designFor, viewOf } from "@/lib/view";
import { Stars } from "./ui/Stars";
import { money, pctOff, materialLabel } from "@/lib/format";
import type { CamLayout, ProductListItem } from "@/lib/types";

export function ProductCard({
  p, modelSlug, modelName, priority = false, layout, phoneHex,
}: {
  p: ProductListItem; modelSlug?: string; modelName?: string; priority?: boolean;
  /** camera shape + body colour of the phone the customer picked (brand or model filter) */
  layout?: CamLayout; phoneHex?: string;
}) {
  const [ci, setCi] = useState(0);
  const color = p.colors[ci] ?? p.colors[0];
  const off = pctOff(p.price, p.compareAtPrice);
  const pv = viewOf(p.view);
  const href = `/product/${p.slug}${modelSlug ? `?model=${modelSlug}` : ""}`;

  return (
    <article className="card group relative flex flex-col overflow-hidden p-3 transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_50px_-24px_rgba(15,23,42,0.35)]">
      {p.badge && (
        <span className="absolute left-5 top-5 z-10 max-w-[55%] truncate rounded-full bg-gradient-to-r from-[#3f37c9] to-[#4a65ff] px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider text-white shadow">
          {p.badge}
        </span>
      )}
      {off > 0 && <span className="absolute right-4 top-4 z-10 rounded-full bg-[#e11d74] px-2.5 py-1 text-[11px] font-bold text-white">−{off}%</span>}

      <Link href={href} prefetch={priority} className="relative grid aspect-[4/4.4] place-items-center overflow-hidden rounded-[22px] bg-gradient-to-b from-[#f4f5f9] to-[#e9ebf1]">
        {cardPhoto(p.images, pv) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cardPhoto(p.images, pv)!} alt={p.name} loading={priority ? "eager" : "lazy"} className="h-full w-full object-contain p-4 transition duration-500 group-hover:scale-[1.04]" />
        ) : (
          <ProductThumb
            material={p.material}
            color={color?.hex ?? "#ccc"}
            accent={color?.accentHex}
            design={designFor(pv, color)}
            layout={layout}
            phoneHex={phoneHex}
            modelSlug={modelSlug}
            className={`${p.material.startsWith("gadget-") ? "h-[70%]" : "h-[82%]"} w-auto transition duration-500 group-hover:scale-[1.04]`}
          />
        )}
        <span className="absolute bottom-3 left-3 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-semibold backdrop-blur">{materialLabel[p.material]}</span>
      </Link>

      <div className="flex flex-1 flex-col px-1.5 pb-1 pt-3.5">
        {p.colors.length > 1 && (
          <div className="mb-2 flex items-center gap-1.5">
            {p.colors.slice(0, 6).map((c, i) => (
              <button
                key={c.id}
                onMouseEnter={() => setCi(i)}
                onFocus={() => setCi(i)}
                onClick={() => setCi(i)}
                aria-label={c.name}
                title={c.name}
                className={`h-[18px] w-[18px] rounded-full border-2 bg-cover bg-center transition ${i === ci ? "scale-110 border-ink" : "border-white shadow-[0_0_0_1px_rgba(0,0,0,0.12)]"}`}
                style={pv.mode === "design" && c.designUrl ? { backgroundImage: `url(${c.designUrl})` } : { background: c.hex }}
              />
            ))}
            {p.colors.length > 6 && <span className="text-xs text-muted">+{p.colors.length - 6}</span>}
          </div>
        )}
        {p.brand && p.brand !== "Magora" && (
          <span className="mb-0.5 inline-block text-[11px] font-semibold uppercase tracking-wider text-accent-2">
            {p.brand}
          </span>
        )}
        <Link href={href} prefetch={false}>
          <h3 className="text-[15.5px] font-bold leading-snug">{p.name}</h3>
        </Link>
        <p className="mt-0.5 line-clamp-1 text-[12.5px] text-muted">{modelName ? `For ${modelName}` : p.subtitle}</p>
        <div className="mt-1.5"><Stars value={p.ratingAvg} count={p.ratingCount} size={13} twinkle /></div>
        <div className="mt-auto flex flex-col gap-2 pt-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="leading-tight">
            <div className="text-[16px] font-bold tabular-nums">{money(p.price)}</div>
            {p.compareAtPrice && p.compareAtPrice > p.price && <div className="text-[12.5px] text-muted line-through tabular-nums">{money(p.compareAtPrice)}</div>}
          </div>
          <Link href={href} prefetch={false} className="btn btn-primary h-9 w-full px-3.5 text-[13px] sm:w-auto">
            Buy Now <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </article>
  );
}
