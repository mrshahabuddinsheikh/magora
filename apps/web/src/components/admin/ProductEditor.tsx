"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Eye, EyeOff, GripVertical, Plus, Sparkles, Star, Trash2, X } from "lucide-react";
import { api } from "@/lib/client-api";
import { CATEGORIES, categoryOf, gadgetType, type CategoryDef } from "@/lib/categories";
import { cn, materialLabel, money, pctOff, shortModel } from "@/lib/format";
import { ProductThumb } from "../CaseThumb";
import { GadgetThumb } from "../GadgetThumb";
import { LazyGadgetViewer, LazyViewer } from "../viewer/LazyViewer";
import { PhotosEditor } from "./PhotosEditor";
import type { BrandWithModels, Material, PhoneSpec, ProductView } from "@/lib/types";
import { designFor, viewOf } from "@/lib/view";
import { tokenStore } from "@/lib/client-api";
import { PUBLIC_API_URL } from "@/lib/config";
import { Box as Cube, Brush, Image as ImageIcon, Upload } from "lucide-react";

/* ───────── types ───────── */

export interface Opt {
  id?: number;
  designUrl?: string | null;
  name: string;
  hex: string;
  accentHex?: string | null;
  priceAdd: number;
  stock: number;
}
interface Draft {
  id?: number;
  slug?: string;
  category: string; // section slug, or a gadget sub-category
  brand: string; // e.g. Magora, Casetify, dbrand, Ronin, Spigen, Apple, Samsung
  material: string;
  name: string;
  subtitle: string;
  description: string;
  basePrice: string;
  compareAtPrice: string;
  badge: string;
  featured: boolean;
  active: boolean;
  features: string[];
  specs: { label: string; value: string }[];
  images: string[];
  options: Opt[];
  /** [] = every phone */
  modelSlugs: string[];
  view: Required<Pick<ProductView, "mode" | "first" | "designFit">> & { designUrl: string | null; modelUrl: string | null; modelBytes: number };
}
interface Detail {
  id: number; slug: string; name: string; brand?: string; subtitle: string; description: string; category: string; section: string; material: string;
  basePrice: number; compareAtPrice: number | null; badge: string | null; featured: boolean; active: boolean;
  features: string[]; specs: { label: string; value: string }[]; images: string[]; view?: ProductView;
  options: (Opt & { id: number; stockTotal: number; variants: number })[]; modelSlugs: string[];
}

/* ───────── presets: so a new product takes a minute, not ten ───────── */

const COLOR_PRESETS: Opt[] = [
  { name: "Black", hex: "#1d1e21", priceAdd: 0, stock: 25 },
  { name: "White", hex: "#eef0f3", priceAdd: 0, stock: 25 },
  { name: "Midnight Blue", hex: "#1f2a44", priceAdd: 0, stock: 25 },
  { name: "Sage Green", hex: "#9fb3a0", priceAdd: 0, stock: 25 },
  { name: "Baby Pink", hex: "#f3c4cf", priceAdd: 0, stock: 25 },
  { name: "Lavender", hex: "#c7b8e8", priceAdd: 0, stock: 25 },
  { name: "Red", hex: "#c8273a", priceAdd: 0, stock: 25 },
  { name: "Orange", hex: "#f08a3c", priceAdd: 0, stock: 25 },
  { name: "Crystal Clear", hex: "#f4f7fb", accentHex: "#d9dde3", priceAdd: 0, stock: 25 },
];
const optionPresets = (cat: string, material: string): { label: string; opts: Opt[] }[] => {
  if (cat === "screen-protectors" && material !== "lens")
    return [{ label: "Single + 2-Pack", opts: [{ name: "Single", hex: "#e8f1fb", priceAdd: 0, stock: 40 }, { name: "2-Pack", hex: "#d5e6f8", priceAdd: 500, stock: 40 }] }];
  if (cat === "cables")
    return [{ label: "1 m / 2 m · Black & White", opts: [
      { name: "1 m · Black", hex: "#1f2023", accentHex: "#8b8f96", priceAdd: 0, stock: 40 },
      { name: "1 m · White", hex: "#eef0f3", accentHex: "#c3c7cd", priceAdd: 0, stock: 40 },
      { name: "2 m · Black", hex: "#1f2023", accentHex: "#8b8f96", priceAdd: 200, stock: 40 },
      { name: "2 m · White", hex: "#eef0f3", accentHex: "#c3c7cd", priceAdd: 200, stock: 40 },
    ] }];
  if (material === "skin-custom") return [{ label: "Your photo", opts: [{ name: "Your photo", hex: "#ffffff", priceAdd: 0, stock: 999 }] }];
  return [];
};

const warranty = { label: "Warranty", value: "6-month replacement warranty" };
const SPEC_TEMPLATES: Record<string, { label: string; value: string }[]> = {
  "magsafe-cases": [
    { label: "Material", value: "Polycarbonate + TPU" },
    { label: "Magnet strength", value: "N52 magnets, ~1,500 gf hold" },
    { label: "Wireless charging", value: "MagSafe & Qi2 compatible, up to 25W" },
    { label: "Drop protection", value: "Tested to 2.4 m (8 ft)" },
    { label: "Camera lip", value: "Raised 1.2 mm bezel" },
  ],
  skins: [
    { label: "Material", value: "Premium cast vinyl, 0.2 mm" },
    { label: "Adhesive", value: "Air-release, residue-free" },
    { label: "Fit", value: "Laser-cut for your exact phone" },
  ],
  "screen-protectors": [
    { label: "Hardness", value: "9H tempered glass, 0.33 mm" },
    { label: "Coating", value: "Oleophobic anti-fingerprint" },
    { label: "Touch", value: "100% touch & Face ID / fingerprint compatible" },
    { label: "In the box", value: "Glass, alignment frame, wipes, dust stickers" },
  ],
  earbuds: [{ label: "Battery", value: "8 h buds + 24 h case" }, { label: "Bluetooth", value: "5.3" }, { label: "Water resistance", value: "IPX5" }, warranty],
  "smart-watches": [{ label: "Display", value: "1.96\" AMOLED" }, { label: "Battery", value: "Up to 7 days" }, { label: "Works with", value: "iPhone and Android" }, warranty],
  "power-banks": [{ label: "Capacity", value: "10,000 mAh" }, { label: "Output", value: "22.5W fast charging" }, warranty],
  chargers: [{ label: "Output", value: "USB-C, 20W PD" }, { label: "Input", value: "100–240V" }, warranty],
  cables: [{ label: "Connectors", value: "USB-C ↔ USB-C" }, { label: "Power", value: "Up to 60W" }, { label: "Works with", value: "iPhone 15+, Galaxy, Pixel" }, warranty],
  handsfree: [{ label: "Connector", value: "USB-C" }, { label: "Cable", value: "1.2 m" }, warranty],
};
const BADGES = ["New", "Best Seller", "Sale", "Limited", "Premium", "Custom"];

const sectionOf = (cat: string): CategoryDef => categoryOf(cat);
const emptyDraft = (): Draft => ({
  category: "magsafe-cases", brand: "Magora", material: "clear", name: "", subtitle: "", description: "", basePrice: "", compareAtPrice: "",
  badge: "", featured: false, active: true, features: [], specs: [], images: [], options: [], modelSlugs: [],
  view: { mode: "auto", first: "3d", designFit: "cover", designUrl: null, modelUrl: null, modelBytes: 0 },
});

/* ───────── editor ───────── */

export function ProductEditor({ productId, onClose, onSaved }: { productId?: number; onClose: () => void; onSaved: (msg: string) => void }) {
  const [d, setD] = useState<Draft>(emptyDraft);
  const [orig, setOrig] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(!!productId);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [brands, setBrands] = useState<BrandWithModels[]>([]);
  const [productBrands, setProductBrands] = useState<{ id: number; name: string; slug: string }[]>([]);
  const [customStyles, setCustomStyles] = useState<{ id: number; name: string; slug: string; section: string; hint: string; color: string; accent?: string | null }[]>([]);
  const [previewOpt, setPreviewOpt] = useState(0);
  const [choosePhones, setChoosePhones] = useState(false);
  const [specFor, setSpecFor] = useState<{ slug: string; spec: PhoneSpec; brand: string; name: string } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const setView = (patch: Partial<Draft["view"]>) => setD((x) => ({ ...x, view: { ...x.view, ...patch } }));
  const section = sectionOf(d.category);
  const gadget = !section.phoneBased;
  const type = gadgetType(d.category);
  const isNew = !productId;

  // load
  useEffect(() => {
    api<{ data: BrandWithModels[] }>("/brands", { auth: false }).then((r) => setBrands(r.data)).catch(() => {});
    api<{ data: { id: number; name: string; slug: string }[] }>("/product-brands", { auth: false })
      .then((r) => setProductBrands(r.data))
      .catch(() => {});
    api<{ data: { id: number; name: string; slug: string; section: string; hint: string; color: string; accent?: string | null }[] }>("/custom-styles", { auth: false })
      .then((r) => setCustomStyles(r.data))
      .catch(() => {});
    if (!productId) return;
    api<{ data: Detail }>(`/admin/products/${productId}`)
      .then(({ data: p }) => {
        setOrig(p);
        const allSlugs = p.section === "gadgets" ? [] : p.modelSlugs;
        setD({
          id: p.id, slug: p.slug, category: p.category, brand: p.brand || "Magora", material: p.material, name: p.name, subtitle: p.subtitle, description: p.description,
          basePrice: String(p.basePrice), compareAtPrice: p.compareAtPrice ? String(p.compareAtPrice) : "", badge: p.badge ?? "",
          featured: p.featured, active: p.active, features: p.features, specs: p.specs, images: p.images,
          options: p.options.map((o) => ({ id: o.id, name: o.name, hex: o.hex, accentHex: o.accentHex, designUrl: o.designUrl ?? null, priceAdd: o.priceAdd, stock: o.stock })),
          modelSlugs: allSlugs,
          view: (() => {
            const v = viewOf(p.view);
            return { mode: v.mode, first: v.first, designFit: v.designFit, designUrl: v.designUrl, modelUrl: v.modelUrl, modelBytes: v.modelBytes };
          })(),
        });
      })
      .catch((e) => setErr((e as Error).message))
      .finally(() => setLoading(false));
  }, [productId]);

  const allModels = useMemo(() => brands.flatMap((b) => b.models), [brands]);
  // an existing product sold for only some phones opens in "Choose phones" mode
  useEffect(() => {
    if (orig && orig.section !== "gadgets" && allModels.length && orig.modelSlugs.length < allModels.length) {
      queueMicrotask(() => setChoosePhones(true));
    }
  }, [orig, allModels.length]);
  const everyPhone = !choosePhones && (d.modelSlugs.length === 0 || (allModels.length > 0 && d.modelSlugs.length >= allModels.length));

  // 3D preview phone: the first selected phone, else iPhone 17 Pro Max
  const previewSlug = !gadget ? (everyPhone ? "iphone-17-pro-max" : d.modelSlugs[0]) : null;
  useEffect(() => {
    if (!previewSlug || specFor?.slug === previewSlug) return;
    api<{ data: { slug: string; name: string; spec: PhoneSpec; brand: { slug: string } } }>(`/phone-models/${previewSlug}`, { auth: false })
      .then((r) => setSpecFor({ slug: r.data.slug, spec: r.data.spec, brand: r.data.brand.slug, name: r.data.name }))
      .catch(() => {});
  }, [previewSlug, specFor?.slug]);

  const pickCategory = (cat: string) => {
    const sec = sectionOf(cat);
    const t = gadgetType(cat);
    setD((x) => {
      const material = t ? t.id : sec.styles.some((s) => s.id === x.material) ? x.material : sec.styles[0].id;
      // fresh product: offer the category's spec template right away
      const specs = isNew && (x.specs.length === 0 || x.specs === SPEC_TEMPLATES[x.category]) ? SPEC_TEMPLATES[cat] ?? SPEC_TEMPLATES[sec.slug] ?? [] : x.specs;
      const ok = VIEW_MODES.find((m) => m.id === x.view.mode)?.when(sec.slug, !sec.phoneBased);
      return { ...x, category: cat, material, specs, view: ok ? x.view : { ...x.view, mode: "auto" } };
    });
  };
  useEffect(() => {
    if (isNew) {
      queueMicrotask(() => pickCategory("magsafe-cases"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeStyles = useMemo(() => {
    const customMatches = customStyles
      .filter((cs) => cs.section === section.slug)
      .map((cs) => ({
        id: cs.slug,
        name: cs.name,
        hint: cs.hint,
        color: cs.color,
        accent: cs.accent ?? undefined,
        cat: section.phoneBased ? undefined : cs.slug,
      }));
    return [...section.styles, ...customMatches];
  }, [section.styles, customStyles, section.slug, section.phoneBased]);

  const price = Number(d.basePrice) || 0;
  const compare = Number(d.compareAtPrice) || 0;
  const opt = d.options[Math.min(previewOpt, d.options.length - 1)];
  const colour = opt?.hex ?? activeStyles.find((s) => s.id === d.material)?.color ?? "#cccccc";
  const previewDesign = designFor(viewOf(d.view), opt);

  const problems = [
    d.name.trim().length < 3 && "Product name (at least 3 letters)",
    price <= 0 && "Price",
    d.options.length === 0 && "At least one option / colour",
    d.options.some((o) => !o.name.trim()) && "A name for every option",
    new Set(d.options.map((o) => o.name.trim().toLowerCase())).size !== d.options.length && "Option names must be different",
    compare > 0 && compare <= price && "Compare-at price must be higher than the price",
    d.view.mode === "photos" && d.images.length === 0 && "At least one photo (view is set to “Photos only”)",
    d.view.mode === "design" && !d.view.designUrl && d.options.some((o) => !o.designUrl) && "A print design (for the product, or for every option)",
    d.view.mode === "model" && !d.view.modelUrl && "The 3D model file (.glb)",
  ].filter(Boolean) as string[];

  const save = async () => {
    if (problems.length) {
      setErr(`Please fill in: ${problems.join(", ")}`);
      return;
    }
    setBusy(true);
    setErr(null);
    const body = {
      name: d.name.trim(), brand: d.brand.trim() || "Magora", subtitle: d.subtitle.trim(), description: d.description.trim(), material: d.material as Material,
      basePrice: price, compareAtPrice: compare || null, badge: d.badge.trim() || null, featured: d.featured, active: d.active,
      features: d.features.slice(0, 8), specs: d.specs.filter((s) => s.label.trim() && s.value.trim()), images: d.images,
      view: d.view,
    };
    try {
      if (isNew) {
        const r = await api<{ data: { slug: string } }>("/admin/products", {
          method: "POST",
          json: {
            ...body,
            category: d.category,
            colors: d.options.map((o) => ({ name: o.name.trim(), hex: o.hex, accentHex: o.accentHex || undefined, priceAdd: o.priceAdd || undefined, stock: o.stock, designUrl: o.designUrl || undefined })),
            modelSlugs: gadget || everyPhone || d.modelSlugs.length >= allModels.length ? undefined : d.modelSlugs,
          },
        });
        onSaved(`Created “${body.name}” — /product/${r.data.slug}`);
      } else {
        await api(`/admin/products/${d.id}`, { method: "PATCH", json: { ...body, ...(d.category !== orig?.category ? { category: d.category } : {}) } });
        const before = new Map(orig!.options.map((o) => [o.id, o]));
        const keep = new Set(d.options.filter((o) => o.id).map((o) => o.id));
        // added first, then removed — a product must always keep one option
        for (const [i, o] of d.options.entries()) {
          if (!o.id) {
            await api(`/admin/products/${d.id}/options`, { method: "POST", json: { name: o.name.trim(), hex: o.hex, accentHex: o.accentHex || null, priceAdd: o.priceAdd, stock: o.stock, designUrl: o.designUrl || null } });
            continue;
          }
          const b = before.get(o.id)!;
          const patch: Record<string, unknown> = {};
          if (b.name !== o.name.trim()) patch.name = o.name.trim();
          if (b.hex !== o.hex) patch.hex = o.hex;
          if ((b.accentHex ?? null) !== (o.accentHex || null)) patch.accentHex = o.accentHex || null;
          if (b.priceAdd !== o.priceAdd) patch.priceAdd = o.priceAdd;
          if (b.stock !== o.stock) patch.stock = o.stock;
          if ((b.designUrl ?? null) !== (o.designUrl || null)) patch.designUrl = o.designUrl || null;
          patch.sort = i;
          await api(`/admin/options/${o.id}`, { method: "PATCH", json: patch });
        }
        for (const id of before.keys()) if (!keep.has(id)) await api(`/admin/options/${id}`, { method: "DELETE" });
        if (!gadget) {
          const want = everyPhone ? allModels.map((m) => m.slug) : d.modelSlugs;
          if (!want.length) throw new Error("Pick at least one phone");
          const was = orig!.modelSlugs;
          if (want.length !== was.length || want.some((x) => !was.includes(x))) await api(`/admin/products/${d.id}/models`, { method: "PUT", json: { modelSlugs: want } });
        }
        onSaved(`Saved “${body.name}”`);
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const go = (id: string) => scroller.current?.querySelector(`#pe-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-[#0b0d12]/35 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-label={isNew ? "New product" : "Edit product"}>
      <div className="flex h-full w-full max-w-[1240px] flex-col bg-[#f3f4f8] shadow-2xl sm:rounded-l-[28px]">
        {/* top bar */}
        <div className="flex items-center gap-3 border-b border-line bg-white/80 px-5 py-3 backdrop-blur sm:rounded-tl-[28px]">
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold uppercase tracking-wider text-muted">{isNew ? "New product" : "Edit product"}</p>
            <h2 className="truncate text-lg font-bold">{d.name || "Untitled product"}</h2>
          </div>
          <button onClick={() => set("active", !d.active)} className={cn("chip h-9", d.active ? "bg-[#e9f8ef] text-success" : "")}>
            {d.active ? <Eye size={15} /> : <EyeOff size={15} />} {d.active ? "Live on store" : "Hidden"}
          </button>
          <button className="btn btn-glass h-10 px-4 text-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary h-10 px-5 text-sm" disabled={busy || loading} onClick={save}>
            <Check size={16} /> {busy ? "Saving…" : isNew ? "Create product" : "Save changes"}
          </button>
        </div>
        {/* section nav */}
        <div className="no-scrollbar flex gap-1 overflow-x-auto border-b border-line bg-white/60 px-5 py-2 text-[13px] font-semibold">
          {[
            ["category", "1 · Category & style"],
            ["basics", "2 · Name & text"],
            ["price", "3 · Price"],
            ["options", "4 · Options & stock"],
            ["photos", "5 · 3D & photos"],
            ["details", "6 · Features & specs"],
            ...(gadget ? [] : [["phones", "7 · Phones"]]),
          ].map(([id, l]) => (
            <button key={id} onClick={() => go(id)} className="shrink-0 rounded-full px-3 py-1.5 text-ink/70 hover:bg-black/5 hover:text-ink">{l}</button>
          ))}
        </div>

        {err && (
          <div className="mx-5 mt-3 flex items-start gap-2 rounded-2xl bg-[#fde8e8] px-4 py-2.5 text-sm text-danger">
            <span className="flex-1">{err}</span>
            <button onClick={() => setErr(null)} aria-label="Dismiss"><X size={15} /></button>
          </div>
        )}

        {loading ? (
          <div className="grid flex-1 place-items-center text-muted">Loading product…</div>
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1fr_400px]">
            {/* ── form ── */}
            <div ref={scroller} className="min-h-0 space-y-4 overflow-y-auto p-5 pb-24">
              {/* 1 category */}
              <Box id="category" title="Category & style" hint="Where it appears in the store, and how it looks in 3D">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {CATEGORIES.map((c) => {
                    const on = section.slug === c.slug;
                    const locked = !isNew && (c.slug === "gadgets") !== gadget;
                    return (
                      <button
                        key={c.slug}
                        disabled={locked}
                        title={locked ? "Gadgets and phone products can't be switched — use Duplicate instead" : undefined}
                        onClick={() => pickCategory(c.phoneBased ? c.slug : (type?.cat ?? c.styles[0].cat!))}
                        className={cn("flex flex-col items-center rounded-2xl border p-3 text-center transition", on ? "border-ink bg-white shadow-sm" : "border-transparent bg-black/[0.03] hover:bg-white", locked && "cursor-not-allowed opacity-40")}
                      >
                        <ProductThumb material={c.styles[c.slug === "skins" ? 3 : 0].id} color={c.styles[c.slug === "skins" ? 3 : 0].color} accent={c.styles[c.slug === "skins" ? 3 : 0].accent} className="h-16 w-auto" />
                        <b className="mt-1.5 text-[13.5px]">{c.name}</b>
                        <span className="text-[11.5px] text-muted">{c.phoneBased ? "Made for each phone" : "Fits every phone"}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="mb-2 mt-4 flex items-center justify-between">
                  <p className="text-[13px] font-semibold">{gadget ? "Type" : section.stylesLabel.replace(/s$/, "")} <span className="font-normal text-muted">— sets the 3D look</span></p>
                  <a href="/admin#categories" target="_blank" rel="noreferrer" className="text-[12px] font-medium text-accent hover:underline">
                    + Add / edit styles &amp; categories ↗
                  </a>
                </div>
                <div className="flex flex-wrap gap-2">
                  {activeStyles.map((s) => {
                    const on = gadget ? d.category === s.cat : d.material === s.id;
                    return (
                      <button
                        key={s.id}
                        onClick={() => (gadget ? pickCategory(s.cat!) : set("material", s.id))}
                        className={cn("flex items-center gap-2 rounded-2xl border py-1.5 pl-1.5 pr-3 text-left transition", on ? "border-ink bg-ink text-white" : "border-black/10 bg-white hover:border-black/25")}
                      >
                        <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#f1f2f6]">
                          {gadget ? <GadgetThumb material={s.id} color={s.color} accent={s.accent} className="h-8 w-8" /> : <ProductThumb material={s.id} color={s.color} accent={s.accent} className="h-9 w-auto" />}
                        </span>
                        <span>
                          <b className="block text-[13px] leading-tight">{s.name}</b>
                          <span className={cn("text-[11px]", on ? "text-white/70" : "text-muted")}>{s.hint}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </Box>

              {/* 2 basics */}
              <Box id="basics" title="Name & text">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Brand / Company *" className="sm:col-span-2" hint="Select an existing brand or type a new manufacturer / accessory company name">
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={productBrands.some((b) => b.name.toLowerCase() === d.brand.toLowerCase()) ? d.brand : "custom"}
                        onChange={(e) => {
                          if (e.target.value !== "custom") set("brand", e.target.value);
                        }}
                        className="h-11 rounded-2xl border border-black/10 bg-black/[0.03] px-3.5 text-sm font-semibold outline-none"
                      >
                        {productBrands.map((b) => (
                          <option key={b.id} value={b.name}>{b.name}</option>
                        ))}
                        <option value="custom">Other / Custom Brand…</option>
                      </select>
                      <input
                        className="input h-11 flex-1 min-w-[180px]"
                        value={d.brand}
                        onChange={(e) => set("brand", e.target.value)}
                        placeholder="Brand name (e.g. Casetify, Ronin, RhinoShield, Magora)"
                        maxLength={60}
                      />
                      <a href="/admin#brands" target="_blank" rel="noreferrer" className="chip h-11 text-xs text-muted hover:text-ink">
                        Manage brands ↗
                      </a>
                    </div>
                  </Field>
                  <Field label="Product name *" className="sm:col-span-2">
                    <input className="input" value={d.name} onChange={(e) => set("name", e.target.value)} placeholder={gadget ? "e.g. AirBuds Max ANC" : "e.g. Glitter MagSafe Case"} maxLength={120} />
                  </Field>
                  <Field label="Short line under the name" className="sm:col-span-2">
                    <input className="input" value={d.subtitle} onChange={(e) => set("subtitle", e.target.value)} placeholder="e.g. Sparkly, slim and drop-tested" maxLength={160} />
                  </Field>
                  <Field label="Description" className="sm:col-span-2" hint={`${d.description.length}/4000`}>
                    <textarea className="input h-auto py-3" rows={4} value={d.description} onChange={(e) => set("description", e.target.value)} maxLength={4000} placeholder="What makes it great, what's in the box…" />
                  </Field>
                  <Field label="Badge on the product card">
                    <div className="flex flex-wrap gap-1.5">
                      {BADGES.map((b) => (
                        <button key={b} onClick={() => set("badge", d.badge === b ? "" : b)} className={cn("chip h-8 text-[12.5px]", d.badge === b && "bg-ink text-white")}>{b}</button>
                      ))}
                      <input className="h-8 w-28 rounded-full bg-black/[0.04] px-3 text-[12.5px] outline-none" value={BADGES.includes(d.badge) ? "" : d.badge} onChange={(e) => set("badge", e.target.value)} placeholder="Custom…" maxLength={30} />
                    </div>
                  </Field>
                  <Field label="Home page">
                    <button onClick={() => set("featured", !d.featured)} className={cn("chip h-10", d.featured && "bg-[#fff4d6] text-[#8a5a00]")}>
                      <Star size={15} className={d.featured ? "fill-current" : ""} /> {d.featured ? "Featured on the home page" : "Not featured"}
                    </button>
                  </Field>
                </div>
              </Box>

              {/* 3 price */}
              <Box id="price" title="Price" hint="Whole rupees. Customers see the compare-at price crossed out.">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Price (Rs.) *">
                    <input className="input" inputMode="numeric" value={d.basePrice} onChange={(e) => set("basePrice", e.target.value.replace(/\D/g, ""))} placeholder="2499" />
                  </Field>
                  <Field label="Compare-at price (optional)">
                    <input className="input" inputMode="numeric" value={d.compareAtPrice} onChange={(e) => set("compareAtPrice", e.target.value.replace(/\D/g, ""))} placeholder="3499" />
                  </Field>
                  <div className="flex items-end">
                    {price > 0 && compare > price ? (
                      <span className="rounded-2xl bg-[#ffe4ef] px-3 py-2.5 text-sm font-bold text-[#c2185b]">Customers save {pctOff(price, compare)}% ({money(compare - price)})</span>
                    ) : (
                      <span className="text-[12.5px] text-muted">Add a compare-at price to show a discount.</span>
                    )}
                  </div>
                </div>
                {!gadget && (
                  <p className="mt-3 rounded-2xl bg-[#eef1ff] px-3.5 py-2.5 text-[12.5px] text-ink/80">
                    Big phones (Pro Max, Ultra, Plus) automatically cost a little more — {section.slug === "magsafe-cases" ? "+Rs.300" : "+Rs.100"} — set per phone in <b>Phone models</b>. Fine-tune any single phone later in <b>Stock &amp; prices</b>.
                  </p>
                )}
              </Box>

              {/* 4 options */}
              <Box id="options" title={gadget ? "Options & stock" : "Colours / options & stock"} hint={gadget ? "Colour, cable length, pack size… each with its own extra price and stock" : "Each option is made for every selected phone; stock is per phone"}>
                <div className="space-y-2">
                  {d.options.map((o, i) => (
                    <div
                      key={o.id ?? `n${i}`}
                      onMouseEnter={() => setPreviewOpt(i)}
                      onFocus={() => setPreviewOpt(i)}
                      className={cn("flex flex-wrap items-center gap-2 rounded-2xl border bg-white p-2 pr-3", previewOpt === i ? "border-accent/40" : "border-transparent")}
                    >
                      <GripVertical size={15} className="shrink-0 text-muted/50" />
                      <label className="relative h-9 w-9 shrink-0 cursor-pointer overflow-hidden rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.15)]" style={{ background: o.hex }} title="Main colour">
                        <input type="color" value={o.hex} onChange={(e) => updOpt(i, { hex: e.target.value })} className="absolute inset-0 cursor-pointer opacity-0" />
                      </label>
                      <label className="relative h-7 w-7 shrink-0 cursor-pointer overflow-hidden rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.15)]" style={{ background: o.accentHex ?? "#ffffff" }} title="Second colour (rim, band, cable head) — optional">
                        <input type="color" value={o.accentHex ?? "#ffffff"} onChange={(e) => updOpt(i, { accentHex: e.target.value })} className="absolute inset-0 cursor-pointer opacity-0" />
                        {!o.accentHex && <span className="absolute inset-0 grid place-items-center text-[10px] text-muted">+</span>}
                      </label>
                      {d.view.mode === "design" && (
                        <ImageSlot small value={o.designUrl ?? null} onChange={(u) => updOpt(i, { designUrl: u })} label="Design" />
                      )}
                      <input value={o.name} onChange={(e) => updOpt(i, { name: e.target.value })} placeholder="Name (e.g. Midnight Blue, 2 m · Black)" className="h-9 min-w-[160px] flex-1 rounded-xl bg-black/[0.04] px-3 text-sm outline-none" maxLength={60} />
                      <span className="flex items-center gap-1 text-[12px] text-muted">
                        + Rs.
                        <input inputMode="numeric" value={o.priceAdd || ""} onChange={(e) => updOpt(i, { priceAdd: Number(e.target.value.replace(/\D/g, "")) || 0 })} placeholder="0" className="h-9 w-16 rounded-xl bg-black/[0.04] px-2 text-sm tabular-nums text-ink outline-none" />
                      </span>
                      <span className="flex items-center gap-1 text-[12px] text-muted">
                        Stock{gadget ? "" : "/phone"}
                        <input inputMode="numeric" value={o.stock} onChange={(e) => updOpt(i, { stock: Number(e.target.value.replace(/\D/g, "")) || 0 })} className={cn("h-9 w-16 rounded-xl bg-black/[0.04] px-2 text-sm tabular-nums outline-none", o.stock === 0 ? "text-danger" : "text-ink")} />
                      </span>
                      <span className="w-20 text-right text-[12.5px] font-semibold tabular-nums">{price ? money(price + o.priceAdd) : "—"}</span>
                      <button onClick={() => setD((x) => ({ ...x, options: x.options.filter((_, k) => k !== i) }))} className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-[#fde8e8] hover:text-danger" aria-label={`Remove ${o.name}`}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                  {d.options.length === 0 && <p className="rounded-2xl border border-dashed border-black/15 p-4 text-center text-sm text-muted">No options yet — add a colour below.</p>}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <button className="chip h-9 bg-ink text-white" onClick={() => setD((x) => ({ ...x, options: [...x.options, { name: "", hex: "#7c3aed", priceAdd: 0, stock: 25 }] }))}>
                    <Plus size={15} /> Add option
                  </button>
                  {optionPresets(d.category, d.material).map((p) => (
                    <button key={p.label} className="chip h-9" onClick={() => setD((x) => ({ ...x, options: [...x.options, ...p.opts.filter((o) => !x.options.some((y) => y.name === o.name))] }))}>
                      <Sparkles size={14} className="text-accent-2" /> {p.label}
                    </button>
                  ))}
                  <span className="mx-1 text-[12px] text-muted">Quick colours:</span>
                  {COLOR_PRESETS.map((c) => (
                    <button
                      key={c.name}
                      title={`Add ${c.name}`}
                      onClick={() => setD((x) => (x.options.some((y) => y.name === c.name) ? x : { ...x, options: [...x.options, { ...c }] }))}
                      className="h-7 w-7 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.15)] transition hover:scale-110"
                      style={{ background: c.hex }}
                    />
                  ))}
                </div>
              </Box>

              {/* 5 view: 3D & photos */}
              <Box id="photos" title="3D & photos" hint="How customers see this product">
                <div className="grid gap-2 sm:grid-cols-2">
                  {VIEW_MODES.filter((m) => m.when(section.slug, gadget)).map((m) => {
                    const on = d.view.mode === m.id;
                    const I = m.icon;
                    return (
                      <button
                        key={m.id}
                        onClick={() => setView({ mode: m.id })}
                        className={cn("flex items-start gap-3 rounded-2xl border p-3 text-left transition", on ? "border-ink bg-white shadow-sm" : "border-transparent bg-black/[0.03] hover:bg-white")}
                      >
                        <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", on ? "bg-ink text-white" : "bg-white text-ink/70")}><I size={18} /></span>
                        <span>
                          <b className="block text-[13.5px]">{m.title}</b>
                          <span className="text-[12px] leading-snug text-muted">{m.text}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                {d.view.mode === "design" && (
                  <div className="mt-4 rounded-2xl bg-[#f5f3ff] p-4">
                    <div className="flex flex-wrap items-start gap-4">
                      <ImageSlot value={d.view.designUrl} onChange={(u) => setView({ designUrl: u })} label="Design for all options" />
                      <div className="min-w-[220px] flex-1 text-[12.5px] text-ink/80">
                        <p className="font-semibold">Upload the flat print file, not a photo of the case.</p>
                        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted">
                          <li>PNG with a transparent background prints over the case colour; JPG fills the whole back</li>
                          <li>Tall images (about 1 : 2) fit phones best · at least 1500 px tall</li>
                          <li>Different print per option? Add a design in each option row above</li>
                        </ul>
                        <p className="mb-1.5 mt-3 font-semibold">How the design sits on the back</p>
                        <div className="flex flex-wrap gap-1.5">
                          {(
                            [
                              ["cover", "Fill the whole back"],
                              ["contain", "Show whole design"],
                              ["logo", "Small logo in the middle"],
                            ] as const
                          ).map(([v, l]) => (
                            <button key={v} onClick={() => setView({ designFit: v })} className={cn("chip h-8 text-[12.5px]", d.view.designFit === v && "bg-ink text-white")}>{l}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {d.view.mode === "model" && (
                  <div className="mt-4 rounded-2xl bg-[#eef6ff] p-4 text-[12.5px]">
                    <ModelUpload value={d.view.modelUrl} bytes={d.view.modelBytes} onChange={(url, bytes) => setView({ modelUrl: url, modelBytes: bytes })} />
                    <ul className="mt-3 list-disc space-y-0.5 pl-4 text-muted">
                      <li>.glb file (glTF binary) from a 3D artist, Blender, or a photo-to-3D service</li>
                      <li>We shrink it automatically (textures ≤1024 px, compressed geometry) — usually under 1.5 MB</li>
                      <li>It loads only after the page is visible, so the page stays fast. If it can&apos;t load, the drawn model is shown</li>
                    </ul>
                  </div>
                )}

                <p className="mb-2 mt-5 text-[13px] font-semibold">
                  Photos <span className="font-normal text-muted">— {d.view.mode === "photos" ? "required" : gadget ? "recommended" : "optional"}; shown in a gallery next to the 3D view, tap to zoom</span>
                </p>
                <PhotosEditor value={d.images} onChange={(v) => set("images", v)} />
                {d.view.mode !== "photos" && d.images.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px]">
                    <span className="font-semibold">Show first:</span>
                    {(
                      [
                        ["3d", "3D view"],
                        ["photos", "First photo"],
                      ] as const
                    ).map(([v, l]) => (
                      <button key={v} onClick={() => setView({ first: v })} className={cn("chip h-8 text-[12.5px]", d.view.first === v && "bg-ink text-white")}>{l}</button>
                    ))}
                    <span className="text-[12px] text-muted">· also decides the picture on the product card</span>
                  </div>
                )}
              </Box>

              {/* 6 details */}
              <Box id="details" title="Features & specs">
                <p className="mb-2 text-[13px] font-semibold">Feature tags <span className="font-normal text-muted">(up to 8, shown as chips) — press Enter to add</span></p>
                <TagInput value={d.features} onChange={(v) => set("features", v)} max={8} placeholder={gadget ? "e.g. 32 h battery" : "e.g. Drop tested"} />
                <div className="mb-2 mt-5 flex items-center justify-between">
                  <p className="text-[13px] font-semibold">Specifications table</p>
                  {(SPEC_TEMPLATES[d.category] ?? SPEC_TEMPLATES[section.slug]) && (
                    <button className="chip h-8 text-[12.5px]" onClick={() => set("specs", [...(SPEC_TEMPLATES[d.category] ?? SPEC_TEMPLATES[section.slug])])}>
                      <Sparkles size={13} className="text-accent-2" /> Use {type?.name ?? section.name} template
                    </button>
                  )}
                </div>
                <div className="space-y-1.5">
                  {d.specs.map((sp, i) => (
                    <div key={i} className="flex gap-1.5">
                      <input value={sp.label} onChange={(e) => set("specs", d.specs.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)))} placeholder="Label" className="h-9 w-44 rounded-xl bg-white px-3 text-sm outline-none" maxLength={40} />
                      <input value={sp.value} onChange={(e) => set("specs", d.specs.map((x, k) => (k === i ? { ...x, value: e.target.value } : x)))} placeholder="Value" className="h-9 flex-1 rounded-xl bg-white px-3 text-sm outline-none" maxLength={200} />
                      <button onClick={() => set("specs", d.specs.filter((_, k) => k !== i))} className="grid h-9 w-9 place-items-center rounded-xl text-muted hover:bg-[#fde8e8] hover:text-danger" aria-label="Remove row"><X size={15} /></button>
                    </div>
                  ))}
                  {d.specs.length < 12 && (
                    <button className="chip h-8 text-[12.5px]" onClick={() => set("specs", [...d.specs, { label: "", value: "" }])}><Plus size={14} /> Add row</button>
                  )}
                </div>
              </Box>

              {/* 7 phones */}
              {!gadget && (
                <Box id="phones" title="Which phones" hint="The product shows up only for the phones you tick">
                  <div className="mb-3 flex gap-1 rounded-full bg-black/[0.04] p-1 text-[13px] font-semibold">
                    <button onClick={() => { setChoosePhones(false); set("modelSlugs", []); }} className={cn("h-8 flex-1 rounded-full", everyPhone ? "bg-white shadow-sm" : "text-ink/60")}>
                      Every phone ({allModels.length})
                    </button>
                    <button
                      onClick={() => { if (everyPhone) set("modelSlugs", allModels.map((m) => m.slug)); setChoosePhones(true); }}
                      className={cn("h-8 flex-1 rounded-full", !everyPhone ? "bg-white shadow-sm" : "text-ink/60")}
                    >
                      Choose phones{!everyPhone ? ` (${d.modelSlugs.length})` : ""}
                    </button>
                  </div>
                  <div className="space-y-2">
                    {brands.map((b) => {
                      const sel = everyPhone ? b.models.length : b.models.filter((m) => d.modelSlugs.includes(m.slug)).length;
                      return (
                        <details key={b.slug} className="group rounded-2xl bg-white p-3" open={!everyPhone && sel > 0}>
                          <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold">
                            <span>{b.name} <span className="font-normal text-muted">· {sel}/{b.models.length}</span></span>
                            <span className="flex items-center gap-2">
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  const base = everyPhone ? allModels.map((m) => m.slug) : d.modelSlugs;
                                  const mine = b.models.map((m) => m.slug);
                                  const next = sel === b.models.length ? base.filter((x) => !mine.includes(x)) : [...new Set([...base, ...mine])];
                                  setChoosePhones(true);
                                  set("modelSlugs", next.length ? next : [mine[0]]);
                                }}
                                className="text-[12px] font-semibold text-accent"
                              >
                                {sel === b.models.length ? "None" : "All"}
                              </button>
                              <ChevronDown size={15} className="text-muted transition group-open:rotate-180" />
                            </span>
                          </summary>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {b.models.map((m) => {
                              const on = everyPhone || d.modelSlugs.includes(m.slug);
                              return (
                                <button
                                  key={m.slug}
                                  onClick={() => {
                                    const base = everyPhone ? allModels.map((x) => x.slug) : d.modelSlugs;
                                    const next = on ? base.filter((x) => x !== m.slug) : [...base, m.slug];
                                    if (next.length) {
                                      setChoosePhones(true);
                                      set("modelSlugs", next);
                                    }
                                  }}
                                  className={cn("chip h-8 text-[12.5px]", on && "bg-ink text-white")}
                                >
                                  {on && <Check size={13} />} {shortModel(m.name)}
                                </button>
                              );
                            })}
                          </div>
                        </details>
                      );
                    })}
                  </div>
                </Box>
              )}
            </div>

            {/* ── live preview ── */}
            <aside className="hidden min-h-0 overflow-y-auto border-l border-line bg-white/50 p-5 lg:block">
              <p className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-muted">Live preview</p>
              <div className="glass relative h-[340px] overflow-hidden rounded-[26px]">
                {d.view.mode === "photos" ? (
                  d.images[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={d.images[0]} alt="" className="h-full w-full object-contain p-5" />
                  ) : (
                    <div className="grid h-full place-items-center text-sm text-muted">Add a photo below</div>
                  )
                ) : gadget ? (
                  <LazyGadgetViewer key={`${d.material}${d.view.mode === "model" ? d.view.modelUrl ?? "" : ""}`} modelUrl={d.view.mode === "model" ? d.view.modelUrl : null} material={d.material} color={colour} accent={opt?.accentHex} autoRotate />
                ) : specFor ? (
                  <LazyViewer key={`${d.material}-${specFor.slug}`} spec={specFor.spec} brand={specFor.brand} material={d.material as Material} color={colour} accent={opt?.accentHex} design={previewDesign} autoRotate view={d.material.startsWith("glass-") ? "front" : "angle"} />
                ) : (
                  <div className="grid h-full place-items-center text-sm text-muted">Loading 3D…</div>
                )}
                {!gadget && specFor && <span className="absolute left-3 top-3 rounded-full bg-white/85 px-2.5 py-1 text-[11.5px] font-semibold">{specFor.name}</span>}
              </div>
              {d.options.length > 1 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {d.options.map((o, i) => (
                    <button key={i} onClick={() => setPreviewOpt(i)} title={o.name} className={cn("h-7 w-7 rounded-full border-2 transition", previewOpt === i ? "scale-110 border-ink" : "border-white shadow-[0_0_0_1px_rgba(0,0,0,0.12)]")} style={{ background: o.hex }} />
                  ))}
                </div>
              )}

              {/* product card as customers see it */}
              <p className="mb-2 mt-5 text-[12px] font-semibold uppercase tracking-wider text-muted">Product card</p>
              <div className="card relative w-[220px] p-3">
                {d.badge && <span className="absolute left-5 top-5 z-10 max-w-[60%] truncate rounded-full bg-gradient-to-r from-[#3f37c9] to-[#4a65ff] px-2.5 py-1 text-[10px] font-bold uppercase text-white">{d.badge}</span>}
                {compare > price && price > 0 && <span className="absolute right-4 top-4 z-10 rounded-full bg-[#e11d74] px-2 py-0.5 text-[10.5px] font-bold text-white">−{pctOff(price, compare)}%</span>}
                <div className="grid aspect-square place-items-center overflow-hidden rounded-[18px] bg-gradient-to-b from-[#f4f5f9] to-[#e9ebf1]">
                  {d.images[0] && (d.view.mode === "photos" || d.view.first === "photos") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={d.images[0]} alt="" className="h-full w-full object-contain p-3" />
                  ) : (
                    <ProductThumb material={d.material} color={colour} accent={opt?.accentHex} design={previewDesign} className={gadget ? "h-[68%] w-auto" : "h-[82%] w-auto"} />
                  )}
                </div>
                <p className="mt-2.5 line-clamp-2 text-[14px] font-bold leading-snug">{d.name || "Product name"}</p>
                <p className="line-clamp-1 text-[11.5px] text-muted">{d.subtitle || materialLabel[d.material]}</p>
                <div className="mt-2 flex items-end gap-2">
                  <span className="text-[15px] font-bold">{price ? money(price) : "Rs.—"}</span>
                  {compare > price && <span className="text-[12px] text-muted line-through">{money(compare)}</span>}
                </div>
              </div>
              <ul className="mt-5 space-y-1.5 text-[12.5px]">
                {[
                  [!problems.some((p) => p.startsWith("Product name")), "Name"],
                  [price > 0, "Price"],
                  [d.options.length > 0, `${d.options.length} option${d.options.length === 1 ? "" : "s"}`],
                  [d.images.length > 0 || (!gadget && d.view.mode !== "photos"), d.images.length ? `${d.images.length} photo${d.images.length === 1 ? "" : "s"}` : gadget ? "Photos (recommended)" : "3D look (no photos needed)"],
                  [!problems.some((p) => /design|model file|photo \(view/.test(p)), VIEW_MODES.find((m) => m.id === d.view.mode)?.title ?? "3D"],
                  [d.specs.length > 0, "Specifications"],
                  [!gadget ? true : true, gadget ? "Fits every phone" : everyPhone ? `All ${allModels.length} phones` : `${d.modelSlugs.length} phones`],
                ].map(([ok, l], i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className={cn("grid h-5 w-5 place-items-center rounded-full", ok ? "bg-[#e9f8ef] text-success" : "bg-black/5 text-muted")}>{ok ? <Check size={12} /> : "·"}</span>
                    {l as string}
                  </li>
                ))}
              </ul>
            </aside>
          </div>
        )}
      </div>
    </div>
  );

  function updOpt(i: number, patch: Partial<Opt>) {
    setD((x) => ({ ...x, options: x.options.map((o, k) => (k === i ? { ...o, ...patch } : o)) }));
  }
}

/* ───────── small pieces ───────── */

function Box({ id, title, hint, children }: { id: string; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section id={`pe-${id}`} className="scroll-mt-4 rounded-[24px] bg-white/80 p-4 shadow-[0_1px_0_rgba(15,23,42,0.04)] sm:p-5">
      <h3 className="text-[15.5px] font-bold">{title}</h3>
      {hint && <p className="mb-3 text-[12.5px] text-muted">{hint}</p>}
      {!hint && <div className="mb-3" />}
      {children}
    </section>
  );
}

function Field({ label, hint, className, children }: { label: string; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={cn("block", className)}>
      <span className="label flex justify-between">
        {label}
        {hint && <span className="font-normal text-muted">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function TagInput({ value, onChange, max, placeholder }: { value: string[]; onChange: (v: string[]) => void; max: number; placeholder: string }) {
  const [t, setT] = useState("");
  const add = () => {
    const v = t.trim().slice(0, 60);
    if (v && !value.includes(v) && value.length < max) onChange([...value, v]);
    setT("");
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-white p-2">
      {value.map((f) => (
        <span key={f} className="flex items-center gap-1 rounded-full bg-[#eef1ff] py-1 pl-3 pr-1.5 text-[12.5px] font-medium text-accent">
          {f}
          <button onClick={() => onChange(value.filter((x) => x !== f))} className="grid h-5 w-5 place-items-center rounded-full hover:bg-white" aria-label={`Remove ${f}`}><X size={12} /></button>
        </span>
      ))}
      {value.length < max && (
        <input
          value={t}
          onChange={(e) => setT(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add();
            }
          }}
          onBlur={add}
          placeholder={placeholder}
          className="h-8 min-w-[140px] flex-1 bg-transparent px-2 text-sm outline-none"
        />
      )}
    </div>
  );
}

/* ───────── view modes ───────── */

const VIEW_MODES: { id: "auto" | "design" | "model" | "photos"; title: string; text: string; icon: typeof Cube; when: (section: string, gadget: boolean) => boolean }[] = [
  { id: "auto", title: "3D from style & colour", text: "Drawn in 3D from the style and option colours — on every phone. Best for plain cases, skins, protectors.", icon: Cube, when: () => true },
  { id: "design", title: "3D + print design", text: "Upload the print file; it's placed on the 3D back of every phone. For printed / pattern cases and skins.", icon: Brush, when: (s) => s === "magsafe-cases" || s === "skins" },
  { id: "model", title: "Own 3D model (.glb)", text: "Upload an exact 3D model of the gadget. Shown instead of the drawn model.", icon: Upload, when: (_s, g) => g },
  { id: "photos", title: "Photos only", text: "No 3D — customers see your photos in a gallery with zoom.", icon: ImageIcon, when: () => true },
];

/** One image (print design) with upload / replace / remove. */
function ImageSlot({ value, onChange, label, small }: { value: string | null; onChange: (url: string | null) => void; label: string; small?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const upload = async (file?: File | null) => {
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${PUBLIC_API_URL}/uploads`, { method: "POST", body: fd });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "Upload failed");
      onChange(body.data.url);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const size = small ? "h-9 w-9 rounded-lg" : "h-36 w-24 rounded-2xl";
  return (
    <div className={cn("relative shrink-0", !small && "text-center")} title={label}>
      <label className={cn("relative grid cursor-pointer place-items-center overflow-hidden border-2 border-dashed bg-white text-[10.5px] text-muted hover:border-accent", size, value ? "border-transparent" : "border-black/15")}>
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt={label} className="h-full w-full object-cover" />
        ) : busy ? (
          "…"
        ) : small ? (
          <Brush size={14} />
        ) : (
          <span className="px-1">+ {label}</span>
        )}
        <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} />
      </label>
      {value && (
        <button onClick={() => onChange(null)} className={cn("absolute grid place-items-center rounded-full bg-black/65 text-white", small ? "-right-1.5 -top-1.5 h-4 w-4 text-[9px]" : "right-1 top-1 h-6 w-6 text-xs")} aria-label={`Remove ${label}`}>×</button>
      )}
      {!small && <p className="mt-1 text-[11px] text-muted">{label}</p>}
      {err && <p className="mt-1 max-w-[160px] text-[11px] text-danger">{err}</p>}
    </div>
  );
}

const mb = (n: number) => `${(n / 1024 / 1024).toFixed(n > 10 * 1024 * 1024 ? 0 : 1)} MB`;

/** .glb upload — the server optimises it and reports the before / after size. */
function ModelUpload({ value, bytes, onChange }: { value: string | null; bytes: number; onChange: (url: string | null, bytes: number) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const upload = async (file?: File | null) => {
    if (!file) return;
    if (!/\.glb$/i.test(file.name)) return setErr("Please choose a .glb file");
    if (file.size > 60 * 1024 * 1024) return setErr("File is larger than 60 MB");
    setErr(null);
    setBusy(`Uploading & optimising ${mb(file.size)}…`);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const token = tokenStore.get();
      const res = await fetch(`${PUBLIC_API_URL}/uploads/model`, { method: "POST", body: fd, headers: token ? { authorization: `Bearer ${token}` } : {} });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "Upload failed");
      onChange(body.data.url, body.data.bytes);
      setInfo(`${mb(body.data.originalBytes)} → ${mb(body.data.bytes)} after optimising`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="btn btn-dark h-10 cursor-pointer px-4 text-sm">
        <Upload size={16} /> {value ? "Replace 3D model" : "Upload 3D model (.glb)"}
        <input type="file" accept=".glb,model/gltf-binary" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} />
      </label>
      {busy && <span className="font-medium text-accent">{busy}</span>}
      {!busy && value && (
        <span className="flex items-center gap-2">
          <Check size={15} className="text-success" /> Model ready{bytes ? ` · ${mb(bytes)}` : ""}{info ? ` (${info})` : ""}
          <button className="text-danger underline" onClick={() => onChange(null, 0)}>Remove</button>
        </span>
      )}
      {err && <span className="text-danger">{err}</span>}
    </div>
  );
}
