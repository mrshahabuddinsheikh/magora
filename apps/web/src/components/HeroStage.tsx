"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { LazyViewer } from "./viewer/LazyViewer";
import { cn, materialLabel, money } from "@/lib/format";
import type { Color, Material, PhoneSpec } from "@/lib/types";

export interface HeroProduct {
  slug: string;
  name: string;
  material: Material;
  price: number;
  colors: Color[];
}

/** Interactive 3D hero: switch material & colour live, drag to rotate. */
export function HeroStage({ products, spec, modelName, modelSlug }: { products: HeroProduct[]; spec: PhoneSpec; modelName: string; modelSlug: string }) {
  const [pi, setPi] = useState(Math.max(0, products.findIndex((p) => p.material === "clear")));
  const p = products[pi];
  const [ci, setCi] = useState(0);
  const color = p.colors[Math.min(ci, p.colors.length - 1)];

  return (
    <div className="glass relative overflow-hidden rounded-[32px]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_45%_at_50%_42%,rgba(255,255,255,0.95),transparent_70%)]" />
      <div className="relative h-[420px] sm:h-[520px]">
        <LazyViewer key={p.material} spec={spec} brand="apple" material={p.material} color={color.hex} accent={color.accentHex} autoRotate view={p.material.startsWith("glass-") ? "front" : "angle"} />
      </div>

      <div className="absolute inset-x-3 top-3 flex justify-center">
        <div className="glass no-scrollbar flex max-w-full gap-1 overflow-x-auto rounded-full p-1">
          {products.map((x, i) => (
            <button
              key={x.slug}
              onClick={() => {
                setPi(i);
                setCi(0);
              }}
              className={cn(
                "h-8 shrink-0 rounded-full px-3.5 text-[12.5px] font-semibold transition",
                i === pi
                  ? "bg-ink text-white dark:bg-white dark:text-neutral-950 font-bold shadow-sm"
                  : "hover:bg-white/80 text-ink/70 dark:text-neutral-300 dark:hover:bg-white/15 dark:hover:text-white",
              )}
            >
              {materialLabel[x.material]}
            </button>
          ))}
        </div>
      </div>

      <div className="absolute inset-x-3 bottom-3">
        <div className="glass-strong flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[24px] p-3 pl-4">
          <div className="min-w-0 flex-1 basis-[140px]">
            <p className="truncate text-[13px] font-bold">{p.name}</p>
            <p className="truncate text-[12px] text-muted">
              {color.name} on {modelName} · from {money(p.price)}
            </p>
          </div>
          <div className="no-scrollbar order-3 -my-1 flex w-full items-center gap-1.5 overflow-x-auto p-1 sm:order-none sm:w-auto">
            {p.colors.map((c, i) => (
              <button
                key={c.id}
                onClick={() => setCi(i)}
                aria-label={c.name}
                title={c.name}
                className={cn("h-7 w-7 shrink-0 rounded-full border-[2.5px] transition", c.id === color.id ? "scale-110 border-ink" : "border-white shadow-[0_0_0_1px_rgba(0,0,0,0.12)]")}
                style={{ background: c.hex }}
              />
            ))}
          </div>
          <Link href={`/product/${p.slug}?model=${modelSlug}&color=${color.id}`} className="btn btn-primary h-10 px-4 text-[13.5px]">
            View <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </div>
  );
}
