"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { LazyGadgetViewer } from "../viewer/LazyViewer";
import { cn, materialLabel, money } from "@/lib/format";
import type { Color } from "@/lib/types";

export interface StageGadget { slug: string; name: string; material: string; price: number; colors: Color[] }

/** Gadgets hero: switch product & colour live, drag to rotate. */
export function GadgetStage({ products }: { products: StageGadget[] }) {
  const [pi, setPi] = useState(0);
  const p = products[pi];
  const [ci, setCi] = useState(0);
  const color = p.colors[Math.min(ci, p.colors.length - 1)];

  return (
    <div className="glass relative overflow-hidden rounded-[32px]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_45%_at_50%_42%,rgba(255,255,255,0.95),transparent_70%)]" />
      <div className="relative h-[420px] sm:h-[520px]">
        <LazyGadgetViewer key={p.material} material={p.material} color={color.hex} accent={color.accentHex} autoRotate />
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
              className={cn("h-8 shrink-0 rounded-full px-3.5 text-[12.5px] font-semibold transition", i === pi ? "bg-ink text-white" : "hover:bg-white/80")}
            >
              {materialLabel[x.material] ?? x.name}
            </button>
          ))}
        </div>
      </div>

      <div className="absolute inset-x-3 bottom-3">
        <div className="glass-strong flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[24px] p-3 pl-4">
          <div className="min-w-0 flex-1 basis-[140px]">
            <p className="truncate text-[13px] font-bold">{p.name}</p>
            <p className="truncate text-[12px] text-muted">
              {color.name} · from {money(p.price)}
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
                style={{ background: c.accentHex && c.accentHex !== c.hex ? `linear-gradient(135deg, ${c.hex} 55%, ${c.accentHex} 55%)` : c.hex }}
              />
            ))}
          </div>
          <Link href={`/product/${p.slug}?color=${color.id}`} className="btn btn-primary h-10 px-4 text-[13.5px]">
            View <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </div>
  );
}
