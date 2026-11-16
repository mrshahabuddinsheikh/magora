"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Search, Smartphone, X, ArrowRight } from "lucide-react";
import { api } from "@/lib/client-api";
import { money } from "@/lib/format";
import { usePrefs } from "@/stores/prefs";
import type { PhoneModel } from "@/lib/types";
import type { CategoryDef } from "@/lib/categories";
import { ProductThumb } from "./CaseThumb";

interface Result {
  models: PhoneModel[];
  products: { id: number; slug: string; name: string; price: number; material: string; category?: string; section?: string }[];
}

const POPULAR = ["iPhone 18 Pro Max", "iPhone 17 Pro", "Galaxy S26 Ultra", "iPhone 16 Pro Max", "Galaxy S25 Ultra", "Pixel 10 Pro"];
const POPULAR_GADGETS = ["Earbuds", "Power bank", "Charger", "Watch", "Cable", "Handsfree"];

export function SearchOverlay({ open, onClose, section }: { open: boolean; onClose: () => void; section: CategoryDef }) {
  const gadgets = !section.phoneBased;
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Result | null>(null);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const setPhone = usePrefs((s) => s.setPhone);

  useEffect(() => {
    if (open) {
      setTimeout(() => input.current?.focus(), 30);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!q.trim()) {
      queueMicrotask(() => setRes(null));
      return;
    }
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await api<{ data: Result }>(`/search?q=${encodeURIComponent(q.trim())}`, { signal: ctl.signal, auth: false });
        setRes(r.data);
        setActive(0);
      } catch {}
    }, 120);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [q]);

  const pickModel = (m: PhoneModel) => {
    setPhone({ slug: m.slug, name: m.name, brand: m.brand.slug });
    onClose();
    setQ("");
    // a phone picked inside gadgets opens cases for it
    router.push(`/shop?category=${section.phoneBased ? section.slug : "magsafe-cases"}&model=${m.slug}`);
  };

  if (!open) return null;
  const models = res?.models ?? [];

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Search">
      <div className="absolute inset-0 bg-[#0b0d12]/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className="glass-strong animate-rise relative mx-3 mt-[72px] max-w-2xl rounded-[28px] p-3 sm:mx-auto">
        <div className="flex items-center gap-2 rounded-2xl bg-white/90 px-3">
          <Search size={20} className="text-muted" />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "ArrowDown") setActive((a) => Math.min(a + 1, models.length - 1));
              if (e.key === "ArrowUp") setActive((a) => Math.max(a - 1, 0));
              if (e.key === "Enter" && models[active]) pickModel(models[active]);
            }}
            placeholder={gadgets ? "Search earbuds, chargers, watches… or your phone" : "Type your phone — e.g. 16 pro max, s25u, SM-S938B"}
            className="h-14 flex-1 bg-transparent text-[16px] outline-none placeholder:text-muted/70"
            autoComplete="off"
            enterKeyHint="search"
          />
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-black/5" aria-label="Close search">
            <X size={17} />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-1 pb-1 pt-3">
          {!q.trim() && (
            <div className="px-2">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{gadgets ? "Popular gadgets" : "Popular phones"}</p>
              <div className="flex flex-wrap gap-2">
                {(gadgets ? POPULAR_GADGETS : POPULAR).map((p) => (
                  <button key={p} className="chip" onClick={() => setQ(p)}>
                    {!gadgets && <Smartphone size={14} />} {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {models.length > 0 && (
            <div className="mb-2">
              <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wider text-muted">Your phone</p>
              {models.map((m, i) => (
                <button
                  key={m.id}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pickModel(m)}
                  className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${i === active ? "bg-white" : "hover:bg-white/70"}`}
                >
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#eef1ff] text-accent">
                    <Smartphone size={18} />
                  </span>
                  <span className="flex-1">
                    <span className="block font-medium">{m.name}</span>
                    <span className="text-xs text-muted">
                      {m.brand.name} · {m.year}
                    </span>
                  </span>
                  <span className="flex items-center gap-1 text-sm text-accent">
                    View {section.phoneBased ? section.noun : "cases"} <ArrowRight size={15} />
                  </span>
                </button>
              ))}
            </div>
          )}

          {(res?.products.length ?? 0) > 0 && (
            <div>
              <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wider text-muted">Products</p>
              {[...res!.products].sort((a, b) => Number(b.section === section.slug) - Number(a.section === section.slug)).map((p) => (
                <Link key={p.id} href={`/product/${p.slug}`} onClick={onClose} className="flex items-center gap-3 rounded-2xl px-3 py-2.5 hover:bg-white/80">
                  <ProductThumb material={p.material} color="#d9dce1" className="h-10 w-10 shrink-0" />
                  <span className="flex-1 font-medium">{p.name} {p.category && <span className="ml-1 text-xs font-normal text-muted">· {p.category}</span>}</span>
                  <span className="text-sm text-muted">from {money(p.price)}</span>
                </Link>
              ))}
            </div>
          )}

          {q.trim() && res && !models.length && !res.products.length && (
            <p className="px-3 py-6 text-center text-muted">
              No match for “{q}”. Try the short name like <b>16 pro</b> or <b>s24 ultra</b>.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
