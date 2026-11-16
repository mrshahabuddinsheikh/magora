"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Search, Smartphone } from "lucide-react";
import { api } from "@/lib/client-api";
import { usePrefs } from "@/stores/prefs";
import { cn } from "@/lib/format";
import type { PhoneModel } from "@/lib/types";

/** "Which phone do you have?" type-ahead used in the hero. */
export function PhoneFinder({ category = "magsafe-cases", noun = "cases" }: { category?: string; noun?: string }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<PhoneModel[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const router = useRouter();
  const setPhone = usePrefs((s) => s.setPhone);
  const saved = usePrefs((s) => s.phone);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!q.trim()) {
      queueMicrotask(() => setHits([]));
      return;
    }
    const ctl = new AbortController();
    const t = setTimeout(() => {
      api<{ data: PhoneModel[] }>(`/phone-models?q=${encodeURIComponent(q)}&limit=7`, { signal: ctl.signal, auth: false })
        .then((r) => {
          setHits(r.data);
          setActive(0);
        })
        .catch(() => {});
    }, 100);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [q]);

  useEffect(() => {
    const out = (e: MouseEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", out);
    return () => document.removeEventListener("mousedown", out);
  }, []);

  const go = (m: PhoneModel) => {
    setPhone({ slug: m.slug, name: m.name, brand: m.brand.slug });
    router.push(`/shop?category=${category}&model=${m.slug}`);
  };

  return (
    <div ref={wrap} className="relative">
      <div className="glass-strong flex h-[60px] items-center gap-2 rounded-full pl-5 pr-2 focus-within:shadow-[0_0_0_4px_rgba(54,83,255,0.18)]">
        <Search size={20} className="text-muted" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") setActive((a) => Math.min(a + 1, hits.length - 1));
            if (e.key === "ArrowUp") setActive((a) => Math.max(a - 1, 0));
            if (e.key === "Enter" && hits[active]) go(hits[active]);
          }}
          placeholder="Which phone do you have?"
          aria-label={`Find ${noun} for your phone`}
          className="h-full min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-muted/80"
          autoComplete="off"
        />
        <button className="btn btn-primary h-11 px-5" onClick={() => (hits[active] ? go(hits[active]) : router.push(`/shop?category=${category}`))}>
          Find {noun} <ArrowRight size={16} />
        </button>
      </div>
      {open && hits.length > 0 && (
        <ul className="glass-strong absolute inset-x-0 top-[68px] z-20 overflow-hidden rounded-[24px] p-1.5" role="listbox">
          {hits.map((m, i) => (
            <li key={m.id}>
              <button
                onMouseEnter={() => setActive(i)}
                onClick={() => go(m)}
                className={cn("flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left", i === active && "bg-white")}
              >
                <Smartphone size={17} className="text-accent" />
                <span className="flex-1 font-medium">{m.name}</span>
                <span className="text-xs text-muted">{m.brand.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {saved && !q && (
        <button onClick={() => router.push(`/shop?category=${category}&model=${saved.slug}`)} className="mt-3 text-[13.5px] text-muted hover:text-ink">
          Continue with <b className="text-ink">{saved.name}</b> →
        </button>
      )}
    </div>
  );
}
