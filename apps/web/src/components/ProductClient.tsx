"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote, Check, ChevronDown, Magnet, Minus, Plus, RotateCcw, ShoppingBag, Truck, Zap, Hand, Smartphone } from "lucide-react";
import { LazyViewer } from "./viewer/LazyViewer";
import { Lightbox } from "./Lightbox";
import { designFor, viewOf } from "@/lib/view";
import { Box as Box3d } from "lucide-react";
import type { ViewAngle } from "./viewer/PhoneCaseViewer";
import { ModelPicker } from "./ModelPicker";
import { WishlistButton } from "./WishlistButton";
import { viewModeOf } from "./viewer/geometry";
import { PUBLIC_API_URL, WHATSAPP } from "@/lib/config";
import { ImagePlus, Layers, ShieldCheck, Sparkles } from "lucide-react";
import { Stars } from "./ui/Stars";
import { BoughtTogether, DeliveryEstimate, NotifyMe, ShareProduct, type DeliveryInfo } from "./ProductExtras";
import { useCart } from "@/stores/cart";
import { usePrefs } from "@/stores/prefs";
import { cn, money, pctOff } from "@/lib/format";
import type { Product, ProductModel } from "@/lib/types";

const SKIN_SIDES = 300; // keep in sync with store.skinSidesPrice in the API

function initialModel(p: Product, fromUrl?: string | null, savedSlug?: string): ProductModel {
  return (
    p.models.find((m) => m.slug === fromUrl) ??
    p.models.find((m) => m.slug === savedSlug) ??
    p.models.find((m) => m.popular) ??
    p.models[0]
  );
}

export function ProductClient({ product: p, delivery }: { product: Product; delivery?: DeliveryInfo | null }) {
  const setPhone = usePrefs((s) => s.setPhone);
  const add = useCart((s) => s.add);
  const busy = useCart((s) => s.busy);
  const cartError = useCart((s) => s.error);
  const router = useRouter();

  const [model, setModel] = useState<ProductModel>(() => p.models.find((m) => m.popular) ?? p.models[0]);
  const [colorId, setColorId] = useState(p.colors[0]?.id);
  const [qty, setQty] = useState(1);
  const mode = viewModeOf(p.material);
  const isCustom = p.material === "skin-custom";
  const [view, setView] = useState<ViewAngle>(p.material.startsWith("glass-") ? "front" : "angle");
  const [coverage, setCoverage] = useState<"back" | "back_sides">("back");
  const [photo, setPhoto] = useState<{ file: File; preview: string; url?: string; w: number; h: number } | null>(null);
  const [photoErr, setPhotoErr] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [nonce, setNonce] = useState(0);
  const photos = p.images ?? [];
  const photosOnly = viewOf(p.view).mode === "photos" && photos.length > 0;
  // -1 = 3D; ≥0 = that photo. Photos-first products open on the first photo.
  const [slide, setSlide] = useState(() => (photos.length && (photosOnly || viewOf(p.view).first === "photos") ? 0 : -1));
  const [zoomAt, setZoomAt] = useState<number | null>(null);
  const [added, setAdded] = useState(false);
  const [ready, setReady] = useState(false);
  const [showBar, setShowBar] = useState(false);
  const [detectedModel, setDetectedModel] = useState<string | null>(null);
  const [engravingEnabled, setEngravingEnabled] = useState(false);
  const [engravingText, setEngravingText] = useState("");
  const [engravingFont, setEngravingFont] = useState<"sans" | "serif" | "script">("sans");
  const ctaRef = useRef<HTMLDivElement>(null);

  // hydrate selection from URL / remembered phone (client only, avoids SSR mismatch)
  useEffect(() => {
    let alive = true;
    const params = new URLSearchParams(window.location.search); // read before the URL-sync effect rewrites it
    Promise.resolve(usePrefs.persist.rehydrate()).then(() => {
      if (!alive) return;
      setModel(initialModel(p, params.get("model"), usePrefs.getState().phone?.slug));
      const c = Number(params.get("color"));
      if (c && p.colors.some((x) => x.id === c)) setColorId(c);
      
      // Auto detect user device
      if (typeof window !== "undefined") {
        const ua = navigator.userAgent;
        let detected = "iPhone 16 Pro Max";
        if (/iPhone/.test(ua)) {
          if (/iPhone16,2|iPhone17/i.test(ua) || (window.screen.height >= 932)) {
            detected = "iPhone 16 Pro Max";
          } else if (window.screen.height >= 852) {
            detected = "iPhone 16 Pro";
          } else {
            detected = "iPhone 15 Pro Max";
          }
        } else if (/Samsung|SM-S928|SM-S938/i.test(ua)) {
          detected = "Galaxy S24 Ultra";
        }
        setDetectedModel(detected);
      }

      setReady(true);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.slug]);

  // keep URL shareable without a navigation
  useEffect(() => {
    if (!ready) return;
    const u = new URL(window.location.href);
    u.searchParams.set("model", model.slug);
    if (colorId) u.searchParams.set("color", String(colorId));
    window.history.replaceState(window.history.state, "", u);
  }, [model.slug, colorId, ready]);

  useEffect(() => {
    if (!ctaRef.current) return;
    const io = new IntersectionObserver(([e]) => setShowBar(!e.isIntersecting && e.boundingClientRect.top < 0));
    io.observe(ctaRef.current);
    return () => io.disconnect();
  }, []);

  const color = p.colors.find((c) => c.id === colorId) ?? p.colors[0];
  const pv = viewOf(p.view);
  const design = designFor(pv, color);
  const variant = useMemo(() => p.variants.find((v) => v.modelId === model.id && v.colorId === color.id), [p.variants, model.id, color.id]);
  const extra = mode === "skin" && coverage === "back_sides" ? SKIN_SIDES : 0;
  const price = (variant?.price ?? model.price) + extra;
  const compare = variant?.compareAtPrice ? variant.compareAtPrice + extra : null;
  const off = pctOff(price, compare);
  const stock = variant?.stock ?? 0;
  const soldOut = !variant || stock <= 0;

  const choose = (m: ProductModel) => {
    setModel(m);
    setPhone({ slug: m.slug, name: m.name, brand: m.brand.slug });
  };

  const pickPhoto = (file?: File | null) => {
    setPhotoErr(null);
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return setPhotoErr("Please choose a JPG, PNG or WebP photo");
    if (file.size > 15 * 1024 * 1024) return setPhotoErr("Photo is larger than 15 MB");
    const preview = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => setPhoto({ file, preview, w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => setPhotoErr("Couldn't read this photo — try another");
    img.src = preview;
  };

  const uploadPhoto = async () => {
    if (!photo) return null;
    if (photo.url) return photo.url;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", photo.file);
      const res = await fetch(`${PUBLIC_API_URL}/uploads`, { method: "POST", body: fd });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "Upload failed");
      setPhoto({ ...photo, url: body.data.url });
      return body.data.url as string;
    } catch (e) {
      setPhotoErr((e as Error).message);
      return null;
    } finally {
      setUploading(false);
    }
  };

  const addToBag = async (thenCheckout = false) => {
    if (!variant) return;
    let custom: { coverage?: "back" | "back_sides"; imageUrl?: string; imageName?: string; engravingText?: string; engravingFont?: string } | undefined;
    if (mode === "skin") custom = { coverage };
    if (isCustom) {
      if (!photo) {
        setPhotoErr("Please upload your photo first");
        document.getElementById("photo-step")?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      const url = await uploadPhoto();
      if (!url) return;
      custom = { coverage, imageUrl: url, imageName: photo.file.name.slice(0, 100) };
    }
    if (engravingEnabled && engravingText.trim()) {
      custom = { ...custom, engravingText: engravingText.trim(), engravingFont };
    }
    const ok = await add(variant.id, qty, { name: p.name, model: model.name, color: color.name, hex: color.hex }, custom);
    if (ok) {
      setAdded(true);
      setTimeout(() => setAdded(false), 1800);
      if (thenCheckout) {
        useCart.getState().setOpen(false);
        router.push("/checkout");
      }
    }
  };

  const goView = (v: ViewAngle) => {
    setSlide(-1);
    setView(v);
    setNonce((n) => n + 1);
  };

  return (
    <>
      <div className="grid gap-5 lg:grid-cols-[1.12fr_1fr] lg:gap-8">
        {/* ── 3D stage + photos ── */}
        <section className="lg:sticky lg:top-[92px] lg:self-start">
          <div className="glass relative overflow-hidden rounded-[32px]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_45%,rgba(255,255,255,0.95),transparent_70%)]" />
            <div className="relative h-[440px] sm:h-[540px] lg:h-[620px]">
              {slide >= 0 && photos[slide] ? (
                <button className="block h-full w-full cursor-zoom-in" onClick={() => setZoomAt(slide)} aria-label="Open photo full screen">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photos[slide]} alt={`${p.name} photo ${slide + 1}`} className="h-full w-full object-contain p-6" />
                </button>
              ) : (
                <LazyViewer
                  key={p.material}
                  spec={model.spec}
                  brand={model.brand.slug}
                  material={p.material}
                  color={color.hex}
                  accent={color.accentHex}
                  coverage={coverage}
                  imageUrl={photo?.preview ?? null}
                  design={design}
                  autoRotate
                  view={view}
                  viewNonce={nonce}
                />
              )}
            </div>
            <div className="absolute left-4 top-4 rounded-full bg-white/80 px-3 py-1.5 text-[12.5px] font-medium backdrop-blur">
              <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: color.hex, boxShadow: "0 0 0 1px rgba(0,0,0,.15)" }} />
              {isCustom ? (photo ? "Your photo" : "Upload a photo") : color.name} · {model.name}
            </div>
            {slide < 0 && (
              <div className="absolute right-4 top-4 hidden items-center gap-1 rounded-full bg-white/70 px-3 py-1.5 text-[12px] text-muted backdrop-blur sm:flex">
                <Hand size={13} /> Drag to rotate · scroll to zoom
              </div>
            )}
            {engravingEnabled && engravingText.trim() && slide < 0 && (
              <div className="absolute bottom-16 left-1/2 -translate-x-1/2 pointer-events-none z-10 animate-pulse">
                <div className="rounded-xl bg-black/75 backdrop-blur-md px-3.5 py-1.5 border border-white/30 text-white shadow-2xl flex items-center gap-1.5">
                  <Sparkles size={13} className="text-amber-400" />
                  <span className={cn(
                    "tracking-widest uppercase font-bold text-xs",
                    engravingFont === "serif" ? "font-serif" : engravingFont === "script" ? "italic font-semibold" : "font-mono"
                  )}>
                    {engravingText}
                  </span>
                  <span className="text-[9px] text-amber-300 font-normal border-l border-white/20 pl-1.5">Laser Print</span>
                </div>
              </div>
            )}
            {!photosOnly && (
              <div className="absolute inset-x-0 bottom-4 flex justify-center px-2">
                <div className="glass no-scrollbar flex max-w-full gap-1 overflow-x-auto rounded-full p-1">
                  {(
                    [
                      ["back", "Back"],
                      ["angle", "3/4"],
                      ["side", "Side"],
                      ["front", "Front"],
                      ["bottom", "Bottom"],
                    ] as [ViewAngle, string][]
                  ).map(([v, l]) => (
                    <button
                      key={v}
                      onClick={() => goView(v)}
                      className={cn(
                        "h-9 shrink-0 rounded-full px-3 text-[13px] font-semibold transition sm:px-4",
                        slide < 0 && view === v
                          ? "bg-ink text-white dark:bg-white dark:text-neutral-950 font-bold shadow-sm"
                          : "hover:bg-white/80 text-ink/70 dark:text-neutral-300 dark:hover:bg-white/15 dark:hover:text-white",
                      )}
                    >
                      {l}
                    </button>
                  ))}
                  <button onClick={() => goView("angle")} className="grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-white/80" aria-label="Reset view">
                    <RotateCcw size={15} />
                  </button>
                </div>
              </div>
            )}
          </div>
          {/* photo strip */}
          {photos.length > 0 && (
            <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
              {!photosOnly && (
                <button
                  onClick={() => goView(view)}
                  className={cn("grid h-16 w-16 shrink-0 place-items-center rounded-2xl border-2 bg-white/80 text-[12px] font-bold", slide < 0 ? "border-ink" : "border-transparent")}
                  aria-label="Show 3D"
                >
                  <Box3d size={20} />
                  3D
                </button>
              )}
              {photos.map((src, i) => (
                <button key={src} onClick={() => (slide === i ? setZoomAt(i) : setSlide(i))} className={cn("h-16 w-16 shrink-0 overflow-hidden rounded-2xl border-2 bg-white", slide === i ? "border-ink" : "border-transparent")} aria-label={`Photo ${i + 1}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          )}
          {zoomAt !== null && <Lightbox images={photos} index={zoomAt} alt={p.name} onClose={() => setZoomAt(null)} />}
        </section>

        {/* ── details ── */}
        <section className="min-w-0">
          <div className="card p-5 sm:p-7">
            <div className="flex flex-wrap items-center gap-2">
              {p.badge && <span className="rounded-full bg-[#eef1ff] px-3 py-1 text-[12px] font-bold uppercase tracking-wide text-accent">{p.badge}</span>}
              <span className="flex items-center gap-1 rounded-full bg-black/[0.04] px-3 py-1 text-[12px] font-semibold">
                {mode === "case" ? <><Magnet size={13} /> MagSafe compatible</> : mode === "skin" ? <><Layers size={13} /> Laser-cut vinyl · bubble-free</> : <><ShieldCheck size={13} /> 9H tempered glass</>}
              </span>
            </div>
            <div className="mt-3 flex items-start justify-between gap-3">
              <h1 className="text-[26px] font-bold leading-tight tracking-tight sm:text-[32px]">{p.name}</h1>
              <WishlistButton productId={p.id} />
            </div>
            <p className="mt-1 text-muted">{p.subtitle}</p>
            <div className="mt-2 flex items-center justify-between gap-3">
              <a href="#reviews" className="inline-block">
                <Stars value={p.ratingAvg} count={p.ratingCount} />
              </a>
              <ShareProduct name={p.name} />
            </div>

            <div className="mt-4 flex items-end gap-3">
              <span className="text-[30px] font-bold tabular-nums tracking-tight">{money(price)}</span>
              {compare && compare > price && (
                <>
                  <span className="pb-1.5 text-lg text-muted line-through tabular-nums">{money(compare)}</span>
                  <span className="mb-2 rounded-full bg-[#ffe4ef] px-2.5 py-0.5 text-[12.5px] font-bold text-[#c2185b]">Save {off}%</span>
                </>
              )}
            </div>

            {/* Magora Coins Loyalty Reward */}
            <div className="mt-2 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 text-xs font-bold text-amber-700 dark:text-amber-400">
                <span>🪙</span>
                <span>Earn {Math.round(price * 0.05)} Magora Coins (Rs. {Math.round(price * 0.05)} discount on your next order)</span>
              </span>
            </div>

            {/* step 1 */}
            <div className="mt-6">
              {detectedModel && (
                <div className="mb-3 flex items-center gap-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-2 text-xs text-emerald-800 dark:text-emerald-300 font-medium">
                  <Sparkles size={15} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Detected your device: <b className="text-ink">{detectedModel}</b> — Showing precision compatible fit</span>
                </div>
              )}
              <div className="mb-2.5 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-[15px] font-bold">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-ink text-[12px] text-white">1</span> Choose your phone
                </h2>
                <span className="flex items-center gap-1 text-[13px] font-medium text-accent">
                  <Smartphone size={14} /> {model.name}
                </span>
              </div>
              <ModelPicker models={p.models} value={model.slug} onChange={(m) => choose(m as ProductModel)} />
            </div>

            {/* step 2 */}
            <div className={cn("mt-6", p.colors.length < 2 && "hidden")}>
              <h2 className="mb-2.5 flex items-center gap-2 text-[15px] font-bold">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-ink text-[12px] text-white">2</span> {mode === "protector" ? (p.material === "lens" ? "Ring colour:" : "Pack:") : mode === "skin" || p.colors.some((c) => pv.mode === "design" && c.designUrl) ? "Design:" : "Colour:"}
                <span className="font-medium text-muted">{color.name}</span>
              </h2>
              {mode === "protector" && p.material !== "lens" ? (
                <div className="flex flex-wrap gap-2">
                  {p.colors.map((c) => {
                    const v = p.variants.find((x) => x.modelId === model.id && x.colorId === c.id);
                    const base = p.variants.find((x) => x.modelId === model.id && x.colorId === p.colors[0].id);
                    const diff = v && base ? v.price - base.price : 0;
                    return (
                      <button
                        key={c.id}
                        onClick={() => setColorId(c.id)}
                        aria-pressed={c.id === color.id}
                        className={cn(
                          "rounded-2xl border px-4 py-2.5 text-left transition",
                          c.id === color.id
                            ? "border-ink bg-ink text-white dark:border-white dark:bg-white dark:text-neutral-950 font-bold shadow-sm"
                            : "border-black/10 bg-white/80 hover:border-black/25 text-ink dark:border-white/15 dark:bg-white/10 dark:text-neutral-200",
                        )}
                      >
                        <b className="block text-[14px]">{c.name}</b>
                        <span className={cn("text-[12px]", c.id === color.id ? "text-white/70 dark:text-neutral-700" : "text-muted")}>{diff > 0 ? `+${money(diff)}` : "Best value per piece"}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
              <div className="flex flex-wrap gap-2.5">
                {p.colors.map((c) => {
                  const v = p.variants.find((x) => x.modelId === model.id && x.colorId === c.id);
                  const out = !v || v.stock <= 0;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setColorId(c.id)}
                      aria-label={`${c.name}${out ? " (sold out)" : ""}`}
                      aria-pressed={c.id === color.id}
                      title={c.name}
                      className={cn(
                        "relative h-11 w-11 rounded-full border-[3px] transition",
                        c.id === color.id ? "scale-105 border-ink" : "border-white shadow-[0_0_0_1px_rgba(0,0,0,0.12)] hover:scale-105",
                      )}
                      style={
                        pv.mode === "design" && c.designUrl
                          ? { backgroundImage: `url(${c.designUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
                          : { background: p.material === "clear" ? `linear-gradient(135deg, ${c.hex}, #ffffff)` : c.hex }
                      }
                    >
                      {out && <span className="absolute inset-0 m-auto h-[2px] w-full rotate-45 bg-danger" />}
                    </button>
                  );
                })}
              </div>
              )}
            </div>

            {/* 3D Custom Name / Initials Engraving */}
            {mode === "case" && (
              <div className="mt-6 rounded-2xl border border-line bg-black/[0.02] dark:bg-white/[0.02] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-ink text-[12px] text-white">✨</span>
                    <div>
                      <h3 className="text-sm font-bold text-ink">Custom Name / Monogram Engraving</h3>
                      <p className="text-[11px] text-muted">Precision laser printed directly onto your 3D case</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEngravingEnabled(!engravingEnabled)}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-bold transition",
                      engravingEnabled ? "bg-accent text-white" : "bg-black/10 dark:bg-white/10 text-ink hover:bg-black/20"
                    )}
                  >
                    {engravingEnabled ? "Enabled (FREE)" : "+ Add Engraving"}
                  </button>
                </div>

                {engravingEnabled && (
                  <div className="pt-2 space-y-2.5">
                    <div>
                      <label className="text-[11px] font-medium text-muted block mb-1">Your Name or Initials (Max 12 letters)</label>
                      <input
                        type="text"
                        maxLength={12}
                        placeholder="e.g. SHERRY or M.A"
                        value={engravingText}
                        onChange={(e) => setEngravingText(e.target.value.toUpperCase())}
                        className="input w-full uppercase tracking-widest font-mono text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-muted block mb-1">Font Style</label>
                      <div className="grid grid-cols-3 gap-2">
                        {(
                          [
                            ["sans", "Bold Sans", "font-sans font-bold tracking-wider"],
                            ["serif", "Luxury Serif", "font-serif tracking-widest"],
                            ["script", "Signature Script", "italic tracking-wide"],
                          ] as const
                        ).map(([f, label, cl]) => (
                          <button
                            key={f}
                            type="button"
                            onClick={() => setEngravingFont(f)}
                            className={cn(
                              "rounded-xl border p-2 text-xs transition",
                              engravingFont === f
                                ? "border-ink bg-ink text-white dark:border-white dark:bg-white dark:text-neutral-950 font-bold shadow-sm"
                                : "border-line bg-white/70 hover:border-ink/50 text-ink dark:border-white/15 dark:bg-white/10 dark:text-neutral-200",
                              cl
                            )}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* skins: photo upload */}
            {isCustom && (
              <div id="photo-step" className="mt-6 scroll-mt-28">
                <h2 className="mb-2.5 flex items-center gap-2 text-[15px] font-bold">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-ink text-[12px] text-white">2</span> Upload your photo
                </h2>
                <label
                  className={cn(
                    "flex cursor-pointer items-center gap-4 rounded-[22px] border-2 border-dashed p-4 transition",
                    photo ? "border-accent/40 bg-[#f2f4ff]" : "border-black/15 bg-white/70 hover:border-accent/50",
                  )}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    pickPhoto(e.dataTransfer.files?.[0]);
                  }}
                >
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => pickPhoto(e.target.files?.[0])} />
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo.preview} alt="Your photo" className="h-20 w-14 shrink-0 rounded-xl object-cover shadow" />
                  ) : (
                    <span className="grid h-20 w-14 shrink-0 place-items-center rounded-xl bg-gradient-to-b from-[#c7d2fe] to-[#fecdd3] text-ink/60">
                      <ImagePlus size={22} />
                    </span>
                  )}
                  <span className="min-w-0 flex-1 text-sm">
                    <b className="block text-[15px]">{photo ? "Looks great! Spin the phone to check it" : "Choose or drop a photo"}</b>
                    <span className="text-muted">{photo ? `${photo.file.name.slice(0, 40)} · ${photo.w}×${photo.h}px — tap to change` : "JPG, PNG or WebP · up to 15 MB · portrait photos fit best"}</span>
                  </span>
                </label>
                {photo && photo.h < 1200 && <p className="mt-2 text-xs text-[#c25a00]">This photo is small ({photo.w}×{photo.h}px) — it may print a little soft. A photo at least 1500px tall looks sharpest.</p>}
                {photoErr && <p className="mt-2 text-sm text-danger">{photoErr}</p>}
                <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
                  <Sparkles size={13} className="text-accent-2" /> We print it in HD and laser-cut it for your {model.name} — exactly as you see it here.
                </p>
              </div>
            )}

            {/* skins: coverage */}
            {mode === "skin" && (
              <div className="mt-6">
                <h2 className="mb-2.5 flex items-center gap-2 text-[15px] font-bold">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-ink text-[12px] text-white">3</span> Coverage
                </h2>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      ["back", "Back only", "Back panel, camera cut-out", 0],
                      ["back_sides", "Back + sides", "Wraps the edges too", SKIN_SIDES],
                    ] as const
                  ).map(([v, l, d, add]) => (
                    <button
                      key={v}
                      onClick={() => setCoverage(v)}
                      aria-pressed={coverage === v}
                      className={cn(
                        "rounded-2xl border p-3 text-left transition",
                        coverage === v
                          ? "border-ink bg-ink text-white dark:border-white dark:bg-white dark:text-neutral-950 font-bold shadow-sm"
                          : "border-black/10 bg-white/80 hover:border-black/25 text-ink dark:border-white/15 dark:bg-white/10 dark:text-neutral-200",
                      )}
                    >
                      <b className="block text-[14px]">{l}</b>
                      <span className={cn("text-[12px]", coverage === v ? "text-white/70 dark:text-neutral-700" : "text-muted")}>{d}{add ? ` · +${money(add)}` : ""}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* stock */}
            <p className={cn("mt-5 flex items-center gap-2 text-[13.5px] font-medium", soldOut ? "text-danger" : stock <= 5 ? "text-[#c25a00]" : "text-success")}>
              <span className={cn("h-2 w-2 rounded-full", soldOut ? "bg-danger" : stock <= 5 ? "bg-[#f59e0b]" : "bg-success")} />
              {soldOut ? `Sold out for ${model.name} in ${color.name}` : stock <= 5 ? `Only ${stock} left — order soon` : "In stock · dispatched within 24 hours"}
            </p>
            {soldOut && <NotifyMe productId={p.id} colorId={color.id} modelSlug={model.slug} label={`${p.name} for ${model.name} (${color.name})`} />}

            {/* CTA */}
            <div ref={ctaRef} className="mt-4 flex gap-2.5">
              <div className="flex h-[52px] items-center rounded-full bg-black/[0.05]">
                <button className="grid h-[52px] w-11 place-items-center" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease quantity">
                  <Minus size={16} />
                </button>
                <span className="w-6 text-center font-semibold tabular-nums">{qty}</span>
                <button className="grid h-[52px] w-11 place-items-center" onClick={() => setQty((q) => Math.min(Math.min(stock, 10) || 1, q + 1))} aria-label="Increase quantity">
                  <Plus size={16} />
                </button>
              </div>
              <button className="btn btn-dark h-[52px] flex-1 text-[15.5px]" disabled={soldOut || busy} onClick={() => addToBag(false)}>
                {added ? <Check size={18} /> : <ShoppingBag size={18} />} {uploading ? "Uploading photo…" : added ? "Added" : "Add to bag"}
              </button>
            </div>
            <button className="btn btn-primary mt-2.5 h-[52px] w-full text-[15.5px]" disabled={soldOut || busy} onClick={() => addToBag(true)}>
              <Zap size={18} /> Buy now · Cash on Delivery
            </button>
            <a
              href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(
                `Assalam o Alaikum! Mujhe order karna hai:\n• Product: ${p.name}\n• Phone: ${model?.name ?? ""}\n• Color: ${color?.name ?? ""}\n• Price: ${money(price)}\n• Payment: Cash on Delivery`,
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 flex h-[46px] w-full items-center justify-center gap-2 rounded-2xl bg-[#25d366]/15 text-[#15803d] font-bold text-[14px] hover:bg-[#25d366]/25 transition"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.4-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 4.9 4.3.7.3 1.2.5 1.7.6.7.2 1.3.2 1.8.1.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.6-.3M12 21.8h0c-1.8 0-3.5-.5-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4C2.7 15.6 2.2 13.8 2.2 12 2.2 6.6 6.6 2.2 12 2.2c2.6 0 5.1 1 6.9 2.9 1.8 1.8 2.9 4.3 2.9 6.9 0 5.4-4.4 9.8-9.8 9.8M20.4 3.6C18.2 1.3 15.2 0 12 0 5.4 0 0 5.4 0 12c0 2.1.6 4.2 1.6 6L0 24l6.2-1.6c1.8 1 3.8 1.5 5.8 1.5 6.6 0 12-5.4 12-12 0-3.2-1.2-6.2-3.6-8.3" />
              </svg>
              WhatsApp Par Order Karein (1-Click)
            </a>
            {cartError && <p className="mt-2 text-sm text-danger">{cartError}</p>}
            {delivery && !soldOut && <DeliveryEstimate info={delivery} madeToOrder={isCustom ? 2 : 0} />}

            <div className="mt-5 grid grid-cols-2 gap-2 text-[12.5px]">
              {[
                [Banknote, "Cash on Delivery", "Pay at your door"],
                [Truck, "Free delivery", "On orders over Rs.3,000"],
                isCustom ? [Sparkles, "Made for you", "Printed in 2–3 days"] : [RotateCcw, "7-day returns", "Easy exchange"],
                mode === "case" ? [Magnet, "N52 magnets", "Snaps to every MagSafe"] : mode === "skin" ? [Layers, "Bubble-free", "Air-release adhesive"] : [ShieldCheck, "9H hardness", "Alignment frame included"],
              ].map(([Icon, t, s], i) => {
                const I = Icon as typeof Truck;
                return (
                  <div key={i} className="flex items-center gap-2.5 rounded-2xl bg-black/[0.03] p-3">
                    <I size={18} className="shrink-0 text-accent" />
                    <span>
                      <b className="block text-[13px]">{t as string}</b>
                      <span className="text-muted">{s as string}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <BoughtTogether
            product={p}
            model={model}
            current={{ variantId: variant?.id, price, color, soldOut, needsPhoto: isCustom }}
          />

          <div className="card mt-4 divide-y divide-line px-5 sm:px-7">
            <Accordion title="Description" open>
              <p className="leading-relaxed text-muted">{p.description}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {p.features.map((f) => (
                  <span key={f} className="flex items-center gap-1 rounded-full bg-[#eef1ff] px-3 py-1 text-[12.5px] font-medium text-accent">
                    <Check size={13} /> {f}
                  </span>
                ))}
              </div>
            </Accordion>
            <Accordion title="Specifications">
              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-[14px]">
                {p.specs.map((s) => (
                  <div key={s.label} className="contents">
                    <dt className="text-muted">{s.label}</dt>
                    <dd className="font-medium">{s.value}</dd>
                  </div>
                ))}
                <dt className="text-muted">Fits</dt>
                <dd className="font-medium">{model.name} only — ({model.spec.heightMm} × {model.spec.widthMm} mm)</dd>
              </dl>
            </Accordion>
            <Accordion title="Delivery & Cash on Delivery">
              <ul className="list-disc space-y-1.5 pl-5 text-[14px] text-muted">
                <li>Delivered in {delivery ? `${delivery.etaByCity.Karachi?.[0] ?? 1}–${delivery.etaDefault[1]}` : "2–4"} working days across Pakistan.</li>
                <li>Pay in cash when the rider arrives — no advance payment.</li>
                <li>Free delivery on orders over {money(delivery?.freeAbove ?? 3000)}, otherwise {money(delivery?.flatRate ?? 200)}.</li>
                {isCustom ? (
                  <li>Custom photo skins are made to order (printed in 2–3 days) and can be returned only if faulty.</li>
                ) : (
                  <li>Wrong model? Exchange within 7 days in original packaging.</li>
                )}
              </ul>
            </Accordion>
          </div>
        </section>
      </div>

      {/* mobile sticky buy bar */}
      <div className={cn("fixed inset-x-2 bottom-2 z-40 transition-all duration-300 lg:hidden", showBar ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-24 opacity-0")}>
        <div className="glass-strong flex items-center gap-3 rounded-[24px] p-2 pl-4">
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-[12px] text-muted">{model.name} · {color.name}</div>
            <div className="font-bold tabular-nums">{money(price)}</div>
          </div>
          <button className="btn btn-primary h-12" disabled={soldOut || busy} onClick={() => addToBag(false)}>
            {added ? <Check size={17} /> : <ShoppingBag size={17} />} {added ? "Added" : "Add to bag"}
          </button>
        </div>
      </div>
    </>
  );
}

function Accordion({ title, open = false, children }: { title: string; open?: boolean; children: React.ReactNode }) {
  return (
    <details className="group py-4" open={open}>
      <summary className="flex cursor-pointer list-none items-center justify-between text-[15.5px] font-bold">
        {title}
        <ChevronDown size={18} className="text-muted transition group-open:rotate-180" />
      </summary>
      <div className="pt-3">{children}</div>
    </details>
  );
}
