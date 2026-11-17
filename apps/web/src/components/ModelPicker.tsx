"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, Smartphone, Sparkles, X } from "lucide-react";
import { api } from "@/lib/client-api";
import { cn, shortModel } from "@/lib/format";
import type { PhoneModel } from "@/lib/types";

type M = PhoneModel & { inStock?: boolean };

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9+]/g, "");

/**
 * Modern, Simplified Model Selector:
 * Shows a compact selected phone card with 1-tap quick pills for top models,
 * and a focused modal for full brand browsing and instant search.
 */
export function ModelPicker({ models, value, onChange }: { models: M[]; value?: string; onChange: (m: M) => void }) {
  const brands = useMemo(() => {
    const seen = new Map<string, string>();
    for (const m of models) seen.set(m.brand.slug, m.brand.name);
    return [...seen].map(([slug, name]) => ({ slug, name }));
  }, [models]);

  const selected = models.find((m) => m.slug === value);
  const [brand, setBrand] = useState(selected?.brand.slug ?? brands[0]?.slug);
  const [modalOpen, setModalOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<M[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selected) {
      queueMicrotask(() => setBrand(selected.brand.slug));
    }
  }, [selected]);

  // Focus search input when modal opens
  useEffect(() => {
    if (modalOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 80);
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") setModalOpen(false);
      };
      window.addEventListener("keydown", onKeyDown);
      return () => window.removeEventListener("keydown", onKeyDown);
    }
  }, [modalOpen]);

  // Instant local match + refined API lookup for model aliases / numbers
  useEffect(() => {
    const nq = norm(q);
    if (!nq) {
      queueMicrotask(() => setHits([]));
      return;
    }
    const local = models.filter(
      (m) =>
        norm(m.name).includes(nq) ||
        norm(m.name.replace(/^(iphone|galaxy|pixel|xiaomi|oneplus|vivo|oppo|iqoo|motorola)/i, "")).startsWith(nq),
    );
    queueMicrotask(() => setHits(local.slice(0, 15)));

    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await api<{ data: PhoneModel[] }>(`/phone-models?q=${encodeURIComponent(q)}&limit=15`, {
          signal: ctl.signal,
          auth: false,
        });
        const ids = new Set(models.map((m) => m.id));
        const fromApi = r.data.filter((m) => ids.has(m.id)).map((m) => models.find((x) => x.id === m.id)!);
        if (fromApi.length) setHits(fromApi.slice(0, 15));
      } catch {}
    }, 160);

    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [q, models]);

  const pick = (m: M) => {
    onChange(m);
    setQ("");
    setModalOpen(false);
  };

  const currentBrandModels = useMemo(() => {
    return models.filter((m) => m.brand.slug === brand);
  }, [models, brand]);

  // Top 4 quick popular models for the selected brand
  const quickPills = useMemo(() => {
    const brandList = models.filter((m) => m.brand.slug === (selected?.brand.slug ?? brand));
    // Prioritize popular ones or first 4
    const popular = brandList.filter((m) => m.popular);
    const combined = [...popular, ...brandList.filter((m) => !m.popular)];
    return combined.slice(0, 4);
  }, [models, selected?.brand.slug, brand]);

  return (
    <div className="space-y-2">
      {/* ── 1. Compact Active Phone Card ── */}
      <div
        onClick={() => setModalOpen(true)}
        className="group relative flex items-center justify-between rounded-2xl border border-black/10 dark:border-white/15 bg-white/80 dark:bg-white/[0.04] p-3 sm:p-3.5 transition hover:border-accent/50 hover:shadow-sm cursor-pointer"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setModalOpen(true)}
        aria-label="Change phone model"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent font-bold">
            <Smartphone size={20} />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
              <span>{selected?.brand.name ?? "Select Brand"}</span>
              {selected?.popular && (
                <span className="rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 px-1.5 py-0.2 text-[9.5px] font-bold">
                  Popular
                </span>
              )}
            </div>
            <div className="text-[15.5px] sm:text-[16px] font-bold text-ink truncate leading-tight mt-0.5">
              {selected?.name ?? "Choose your phone model"}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 rounded-xl bg-black/[0.05] dark:bg-white/10 px-3 py-1.5 text-xs font-bold text-ink group-hover:bg-accent group-hover:text-white transition">
          <span>Change Model</span>
          <ChevronDown size={14} className="transition group-hover:translate-y-0.5" />
        </div>
      </div>

      {/* ── 2. Quick 1-Tap Pills for Top Models ── */}
      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
        {quickPills.map((m) => {
          const isSelected = m.slug === value;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onChange(m)}
              className={cn(
                "h-8 rounded-full px-3 text-xs font-semibold transition shrink-0",
                isSelected
                  ? "bg-ink text-white dark:bg-white dark:text-neutral-950 font-bold shadow-sm"
                  : "bg-black/[0.04] dark:bg-white/[0.06] text-ink/80 hover:bg-black/[0.08] dark:hover:bg-white/10",
              )}
            >
              {shortModel(m.name)}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="h-8 rounded-full px-3 text-xs font-semibold text-accent hover:underline flex items-center gap-1 shrink-0"
        >
          <span>All models ▾</span>
        </button>
      </div>

      {/* ── 3. Focused Modal Selector ── */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="card max-w-xl w-full max-h-[85vh] flex flex-col p-4 sm:p-6 overflow-hidden rounded-[28px] shadow-2xl animate-in zoom-in-95 duration-200 bg-white dark:bg-[#151821] border border-black/10 dark:border-white/15"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <div className="flex items-center gap-2">
                <Smartphone size={20} className="text-accent" />
                <h3 className="text-lg font-bold text-ink">Choose Your Phone Model</h3>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-muted hover:text-ink transition"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Search Bar */}
            <div className="mt-3 relative">
              <div className="flex h-11 items-center gap-2 rounded-2xl border border-black/10 dark:border-white/15 bg-black/[0.02] dark:bg-white/[0.03] px-3.5 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/15">
                <Search size={16} className="text-muted shrink-0" />
                <input
                  ref={searchInputRef}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Type your model (e.g. 16 Pro Max, S24 Ultra, Pixel 9)..."
                  className="h-full flex-1 bg-transparent text-sm outline-none placeholder:text-muted/70 text-ink"
                  autoComplete="off"
                />
                {q && (
                  <button type="button" onClick={() => setQ("")} aria-label="Clear search">
                    <X size={15} className="text-muted hover:text-ink" />
                  </button>
                )}
              </div>
            </div>

            {/* When not searching: Brand Tabs */}
            {!q.trim() && (
              <div className="no-scrollbar mt-3 flex gap-1 overflow-x-auto rounded-[20px] bg-black/[0.04] dark:bg-white/[0.04] p-1 shrink-0">
                {brands.map((b) => (
                  <button
                    key={b.slug}
                    type="button"
                    onClick={() => setBrand(b.slug)}
                    className={cn(
                      "h-8 whitespace-nowrap rounded-full px-3 text-xs font-semibold transition shrink-0",
                      brand === b.slug
                        ? "bg-white dark:bg-white/15 text-ink dark:text-white shadow-sm font-bold"
                        : "text-muted hover:text-ink",
                    )}
                  >
                    {b.name}
                  </button>
                ))}
              </div>
            )}

            {/* Model List Grid */}
            <div className="no-scrollbar mt-3.5 flex-1 overflow-y-auto pr-0.5 space-y-2">
              {q.trim() ? (
                // Search Results
                <div>
                  <div className="text-xs font-semibold text-muted mb-2 px-1">
                    {hits.length ? `Search Results (${hits.length})` : "No matching models found"}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {hits.map((m) => {
                      const on = m.slug === value;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => pick(m)}
                          className={cn(
                            "relative flex flex-col items-center justify-center rounded-2xl border p-3 text-center text-xs font-semibold transition min-h-[58px]",
                            on
                              ? "border-ink bg-ink text-white dark:border-white dark:bg-white dark:text-neutral-950 font-bold shadow-sm"
                              : "border-black/[0.08] dark:border-white/10 bg-white/70 dark:bg-white/[0.03] hover:border-black/25 text-ink",
                            m.inStock === false && "opacity-45",
                          )}
                        >
                          <span className="text-[10px] text-muted uppercase tracking-wider block">{m.brand.name}</span>
                          <span className="line-clamp-1">{m.name}</span>
                          {on && <Check size={14} className="absolute right-2 top-2" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                // Selected Brand's Model List
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {currentBrandModels.map((m) => {
                    const on = m.slug === value;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => pick(m)}
                        className={cn(
                          "relative flex items-center justify-center rounded-2xl border px-3 py-3 text-center text-[13px] font-semibold transition min-h-[52px]",
                          on
                            ? "border-ink bg-ink text-white dark:border-white dark:bg-white dark:text-neutral-950 font-bold shadow-sm"
                            : "border-black/[0.08] dark:border-white/10 bg-white/70 dark:bg-white/[0.03] hover:border-black/25 text-ink",
                          m.inStock === false && "opacity-45",
                        )}
                      >
                        <span className="line-clamp-1">{shortModel(m.name)}</span>
                        {on && <Check size={14} className="absolute right-2 top-2" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="mt-4 pt-3 border-t border-line flex items-center justify-between text-xs text-muted">
              <span>{models.length} models available</span>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="btn btn-secondary text-xs h-8 px-3 font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
