"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Search, Smartphone, X } from "lucide-react";
import { api } from "@/lib/client-api";
import { cn, shortModel } from "@/lib/format";
import type { PhoneModel } from "@/lib/types";

type M = PhoneModel & { inStock?: boolean };

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9+]/g, "");

/**
 * Brand tabs → model chips, plus a type-ahead that understands short names
 * ("16pm", "s25u") and model numbers ("A3084", "SM-S938B") via the API.
 */
export function ModelPicker({ models, value, onChange }: { models: M[]; value?: string; onChange: (m: M) => void }) {
  const brands = useMemo(() => {
    const seen = new Map<string, string>();
    for (const m of models) seen.set(m.brand.slug, m.brand.name);
    return [...seen].map(([slug, name]) => ({ slug, name }));
  }, [models]);
  const selected = models.find((m) => m.slug === value);
  const [brand, setBrand] = useState(selected?.brand.slug ?? brands[0]?.slug);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<M[]>([]);
  const [focus, setFocus] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selected) {
      queueMicrotask(() => setBrand(selected.brand.slug));
    }
  }, [selected]);

  // instant local match, then refine with the API (aliases & model numbers)
  useEffect(() => {
    const nq = norm(q);
    if (!nq) {
      queueMicrotask(() => setHits([]));
      return;
    }
    const local = models.filter((m) => norm(m.name).includes(nq) || norm(m.name.replace(/^(iphone|galaxy|pixel|xiaomi|oneplus|vivo|oppo|iqoo|motorola)/i, "")).startsWith(nq));
    queueMicrotask(() => {
      setHits(local.slice(0, 8));
      setActive(0);
    });
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await api<{ data: PhoneModel[] }>(`/phone-models?q=${encodeURIComponent(q)}&limit=10`, { signal: ctl.signal, auth: false });
        const ids = new Set(models.map((m) => m.id));
        const fromApi = r.data.filter((m) => ids.has(m.id)).map((m) => models.find((x) => x.id === m.id)!);
        if (fromApi.length) setHits(fromApi.slice(0, 8));
      } catch {}
    }, 160);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [q, models]);

  useEffect(() => {
    const out = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setFocus(false);
    document.addEventListener("mousedown", out);
    return () => document.removeEventListener("mousedown", out);
  }, []);

  const pick = (m: M) => {
    onChange(m);
    setQ("");
    setFocus(false);
  };

  const list = models.filter((m) => m.brand.slug === brand);

  return (
    <div>
      {/* type-ahead */}
      <div ref={box} className="relative">
        <div className="flex h-12 items-center gap-2 rounded-2xl border border-black/10 bg-white/90 px-3.5 focus-within:border-accent focus-within:shadow-[0_0_0_4px_rgba(54,83,255,0.15)]">
          <Search size={18} className="text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setFocus(true)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") setActive((a) => Math.min(a + 1, hits.length - 1));
              if (e.key === "ArrowUp") setActive((a) => Math.max(a - 1, 0));
              if (e.key === "Enter" && hits[active]) {
                e.preventDefault();
                pick(hits[active]);
              }
              if (e.key === "Escape") setFocus(false);
            }}
            placeholder="Type your phone model (e.g. 18 pro max, s26u)"
            className="h-full flex-1 bg-transparent text-[16px] outline-none placeholder:text-muted/70"
            role="combobox"
            aria-expanded={focus && hits.length > 0}
            aria-controls="model-suggestions"
            aria-label="Search your phone model"
            autoComplete="off"
          />
          {q && (
            <button onClick={() => setQ("")} aria-label="Clear">
              <X size={16} className="text-muted" />
            </button>
          )}
        </div>
        {focus && q && (
          <ul id="model-suggestions" role="listbox" className="glass-strong absolute inset-x-0 top-[54px] z-20 max-h-72 overflow-y-auto rounded-2xl p-1.5">
            {hits.length === 0 && <li className="px-3 py-3 text-sm text-muted">Not available for this case yet</li>}
            {hits.map((m, i) => (
              <li key={m.id} role="option" aria-selected={i === active}>
                <button
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(m)}
                  className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left", i === active ? "bg-white" : "")}
                >
                  <Smartphone size={16} className="text-accent" />
                  <span className="flex-1 font-medium">{m.name}</span>
                  <span className="text-xs text-muted">{m.brand.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* brand tabs */}
      <div className="mt-3 flex flex-wrap gap-1 rounded-[22px] bg-black/[0.04] p-1" role="tablist" aria-label="Phone brand">
        {brands.map((b) => (
          <button
            key={b.slug}
            role="tab"
            aria-selected={brand === b.slug}
            onClick={() => setBrand(b.slug)}
            className={cn("h-9 grow whitespace-nowrap rounded-full px-3 text-[14px] font-semibold transition", brand === b.slug ? "bg-white shadow-sm" : "text-muted hover:text-ink")}
          >
            {b.name}
          </button>
        ))}
      </div>

      {/* model chips */}
      <div className="no-scrollbar mt-3 grid max-h-[212px] grid-cols-2 gap-2 overflow-y-auto pr-0.5 sm:grid-cols-3">
        {list.map((m) => {
          const on = m.slug === value;
          return (
            <button
              key={m.id}
              onClick={() => pick(m)}
              className={cn(
                "relative flex h-12 items-center justify-center rounded-2xl border px-2 text-center text-[13.5px] font-medium leading-tight transition",
                on
                  ? "border-ink bg-ink text-white dark:border-white dark:bg-white dark:text-neutral-950 font-bold shadow-sm"
                  : "border-black/[0.08] bg-white/80 hover:border-black/25 text-ink dark:border-white/15 dark:bg-white/10 dark:text-neutral-200",
                m.inStock === false && "opacity-45",
              )}
              aria-pressed={on}
            >
              {shortModel(m.name)}
              {on && <Check size={13} className="absolute right-2 top-2" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
