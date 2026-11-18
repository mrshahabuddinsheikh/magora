"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote, Box, Check, ChevronDown, Hand, Minus, Plus, RotateCcw, ShieldCheck, ShoppingBag, Truck, Wrench, Zap } from "lucide-react";
import { LazyGadgetViewer } from "./viewer/LazyViewer";
import { Lightbox } from "./Lightbox";
import { viewOf } from "@/lib/view";
import type { GadgetView } from "./viewer/GadgetViewer";
import { WishlistButton } from "./WishlistButton";
import { Stars } from "./ui/Stars";
import { DeliveryEstimate, NotifyMe, ShareProduct, type DeliveryInfo } from "./ProductExtras";
import { useCart } from "@/stores/cart";
import { cn, money, pctOff } from "@/lib/format";
import { WHATSAPP } from "@/lib/config";
import { track } from "@/lib/track";
import { triggerFlyToBag } from "./FlyToBagAnimation";
import type { Product } from "@/lib/types";

/** Product page for universal gadgets: no phone step — pick an option, see it in 3D, buy. */
export function GadgetProductClient({ product: p, delivery }: { product: Product; delivery?: DeliveryInfo | null }) {
  const add = useCart((s) => s.add);
  const busy = useCart((s) => s.busy);
  const cartError = useCart((s) => s.error);
  const router = useRouter();

  const [colorId, setColorId] = useState(p.colors[0]?.id);
  const [qty, setQty] = useState(1);
  const [view, setView] = useState<GadgetView>("angle");
  const [nonce, setNonce] = useState(0);
  const pv = viewOf(p.view);
  const photosOnly = pv.mode === "photos" && p.images.length > 0;
  // -1 = 3D, otherwise photo index; photos-first products open on a photo
  const [slide, setSlide] = useState<number>(() => (p.images.length && (photosOnly || pv.first === "photos") ? 0 : -1));
  const [zoomAt, setZoomAt] = useState<number | null>(null);
  const [added, setAdded] = useState(false);
  const [ready, setReady] = useState(false);
  const [showBar, setShowBar] = useState(false);
  const ctaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const c = Number(new URLSearchParams(window.location.search).get("color"));
    queueMicrotask(() => {
      if (c && p.colors.some((x) => x.id === c)) setColorId(c);
      setReady(true);
    });
  }, [p.colors]);

  useEffect(() => {
    if (!ready || !colorId) return;
    const u = new URL(window.location.href);
    u.searchParams.set("color", String(colorId));
    window.history.replaceState(window.history.state, "", u);
  }, [colorId, ready]);

  useEffect(() => {
    if (!ctaRef.current) return;
    const io = new IntersectionObserver(([e]) => setShowBar(!e.isIntersecting && e.boundingClientRect.top < 0));
    io.observe(ctaRef.current);
    return () => io.disconnect();
  }, []);

  const color = p.colors.find((c) => c.id === colorId) ?? p.colors[0];
  const variant = useMemo(() => p.variants.find((v) => v.colorId === color.id), [p.variants, color.id]);
  const base = p.variants.find((v) => v.colorId === p.colors[0]?.id);
  const price = variant?.price ?? p.minPrice;
  const compare = variant?.compareAtPrice ?? null;
  const off = pctOff(price, compare);
  const stock = variant?.stock ?? 0;
  const soldOut = !variant || stock <= 0;
  const worksWith = p.specs.find((s) => /works with|connector/i.test(s.label));
  // option names like "1 m · Black" — options that differ in price show it
  const optionLabel = p.colors.some((c) => /\d\s?m\b|pack/i.test(c.name)) ? "Option" : "Colour";

  const addToBag = async (thenCheckout = false) => {
    if (!variant) return;
    const ok = await add(variant.id, qty, { name: p.name, model: "", color: color.name, hex: color.hex });
    if (ok) {
      setAdded(true);
      triggerFlyToBag(null, { name: p.name, colorHex: color.hex, emoji: "⚡" });
      track("add_to_cart", {
        value: variant.price * qty,
        items: [{ id: variant.id, name: p.name, price: variant.price, qty, category: "gadgets" }],
      });
      setTimeout(() => setAdded(false), 1800);
      if (thenCheckout) {
        useCart.getState().setOpen(false);
        router.push("/checkout");
      }
    }
  };

  const goView = (v: GadgetView) => {
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
            <div className="relative h-[400px] sm:h-[520px] lg:h-[600px]">
              {slide >= 0 && p.images[slide] ? (
                <button className="block h-full w-full cursor-zoom-in" onClick={() => setZoomAt(slide)} aria-label="Open photo full screen">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.images[slide]} alt={`${p.name} photo ${slide + 1}`} className="h-full w-full object-contain p-6" />
                </button>
              ) : (
                <LazyGadgetViewer
                  key={`${p.material}${pv.modelUrl ?? ""}`}
                  modelUrl={pv.mode === "model" ? pv.modelUrl : null}
                  material={p.material}
                  color={color.hex}
                  accent={color.accentHex}
                  autoRotate
                  view={view}
                  viewNonce={nonce}
                />
              )}
            </div>
            <div className="absolute left-4 top-4 rounded-full bg-white/80 px-3 py-1.5 text-[12.5px] font-medium backdrop-blur">
              <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: color.hex, boxShadow: "0 0 0 1px rgba(0,0,0,.15)" }} />
              {color.name}
            </div>
            <div className="absolute right-4 top-4 hidden items-center gap-1 rounded-full bg-white/70 px-3 py-1.5 text-[12px] text-muted backdrop-blur sm:flex">
              <Hand size={13} /> Drag to rotate · scroll to zoom
            </div>
            <div className="absolute inset-x-0 bottom-4 flex justify-center px-3">
              <div className="glass no-scrollbar flex max-w-full gap-1 overflow-x-auto rounded-full p-1">
                {!photosOnly && (
                  [
                    ["angle", "3D"],
                    ["front", "Front"],
                    ["side", "Side"],
                    ["back", "Back"],
                  ] as [GadgetView, string][]
                ).map(([v, l]) => (
                  <button
                    key={v}
                    onClick={() => goView(v)}
                    className={cn(
                      "h-9 shrink-0 rounded-full px-4 text-[13px] font-semibold transition",
                      slide < 0 && view === v
                        ? "bg-ink text-white dark:bg-white dark:text-neutral-950 font-bold shadow-sm"
                        : "hover:bg-white/80 text-ink/70 dark:text-neutral-300 dark:hover:bg-white/15 dark:hover:text-white",
                    )}
                  >
                    {l}
                  </button>
                ))}
                {p.images.map((src, i) => (
                  <button key={src} onClick={() => (slide === i ? setZoomAt(i) : setSlide(i))} className={cn("h-9 w-9 shrink-0 overflow-hidden rounded-full border-2 transition", slide === i ? "border-ink" : "border-transparent")} aria-label={`Photo ${i + 1}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
                {!photosOnly && (
                  <button onClick={() => goView("angle")} className="grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-white/80" aria-label="Reset view">
                    <RotateCcw size={15} />
                  </button>
                )}
              </div>
            </div>
          </div>
          {zoomAt !== null && <Lightbox images={p.images} index={zoomAt} alt={p.name} onClose={() => setZoomAt(null)} />}
        </section>

        {/* ── details ── */}
        <section className="min-w-0">
          <div className="card p-5 sm:p-7">
            <div className="flex flex-wrap items-center gap-2">
              {p.badge && <span className="rounded-full bg-[#eef1ff] px-3 py-1 text-[12px] font-bold uppercase tracking-wide text-accent">{p.badge}</span>}
              <span className="flex items-center gap-1 rounded-full bg-black/[0.04] px-3 py-1 text-[12px] font-semibold">
                <Wrench size={13} /> 6-month warranty
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

            {worksWith && (
              <div className="mt-4 flex items-start gap-2 rounded-2xl bg-[#eef6ff] px-3.5 py-2.5 text-[13.5px]">
                <Check size={16} className="mt-0.5 shrink-0 text-accent" />
                <span>
                  <b>{worksWith.label}:</b> {worksWith.value}
                </span>
              </div>
            )}

            {/* option */}
            <div className={cn("mt-6", p.colors.length < 2 && "hidden")}>
              <h2 className="mb-2.5 text-[15px] font-bold">
                {optionLabel}: <span className="font-medium text-muted">{color.name}</span>
              </h2>
              <div className="flex flex-wrap gap-2">
                {p.colors.map((c) => {
                  const v = p.variants.find((x) => x.colorId === c.id);
                  const out = !v || v.stock <= 0;
                  const diff = v && base ? v.price - base.price : 0;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setColorId(c.id)}
                      aria-pressed={c.id === color.id}
                      className={cn(
                        "flex items-center gap-2.5 rounded-2xl border py-2 pl-2.5 pr-4 text-left transition",
                        c.id === color.id
                          ? "border-ink bg-ink text-white dark:border-white dark:bg-white dark:text-neutral-950 font-bold shadow-sm"
                          : "border-black/10 bg-white/80 hover:border-black/25 text-ink dark:border-white/15 dark:bg-white/10 dark:text-neutral-200",
                        out && "opacity-50",
                      )}
                    >
                      <span className="h-7 w-7 shrink-0 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.15)]" style={{ background: c.accentHex && c.accentHex !== c.hex ? `linear-gradient(135deg, ${c.hex} 55%, ${c.accentHex} 55%)` : c.hex }} />
                      <span>
                        <b className="block text-[13.5px] leading-tight">{c.name}</b>
                        <span className={cn("text-[11.5px]", c.id === color.id ? "text-white/70 dark:text-neutral-700" : "text-muted")}>{out ? "Sold out" : diff > 0 ? `+${money(diff)}` : money(v?.price ?? price)}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <p className={cn("mt-5 flex items-center gap-2 text-[13.5px] font-medium", soldOut ? "text-danger" : stock <= 5 ? "text-[#c25a00]" : "text-success")}>
              <span className={cn("h-2 w-2 rounded-full", soldOut ? "bg-danger" : stock <= 5 ? "bg-[#f59e0b]" : "bg-success")} />
              {soldOut ? `${color.name} is sold out` : stock <= 5 ? `Only ${stock} left — order soon` : "In stock · dispatched within 24 hours"}
            </p>
            {soldOut && <NotifyMe productId={p.id} colorId={color.id} label={`${p.name} (${color.name})`} />}

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
                {added ? <Check size={18} /> : <ShoppingBag size={18} />} {added ? "Added" : "Add to bag"}
              </button>
            </div>
            <button className="btn btn-primary mt-2.5 h-[52px] w-full text-[15.5px]" disabled={soldOut || busy} onClick={() => addToBag(true)}>
              <Zap size={18} /> Buy now · Cash on Delivery
            </button>
            <a
              href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(
                `Assalam o Alaikum! Mujhe order karna hai:\n• Product: ${p.name}\n• Color: ${color?.name ?? ""}\n• Price: ${money(price)}\n• Payment: Cash on Delivery`,
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
            {delivery && !soldOut && <DeliveryEstimate info={delivery} />}

            <div className="mt-5 grid grid-cols-2 gap-2 text-[12.5px]">
              {[
                [Banknote, "Cash on Delivery", "Pay at your door"],
                [Truck, "Free delivery", "On orders over Rs.3,000"],
                [ShieldCheck, "6-month warranty", "Free replacement"],
                [Box, "7-day returns", "Sealed & unused"],
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
              </dl>
            </Accordion>
            <Accordion title="Delivery, warranty & returns">
              <ul className="list-disc space-y-1.5 pl-5 text-[14px] text-muted">
                <li>Delivered in 2–4 working days across Pakistan.</li>
                <li>Pay in cash when the rider arrives — no advance payment.</li>
                <li>Free delivery on orders over Rs.3,000, otherwise Rs.200.</li>
                <li>6-month replacement warranty against manufacturing faults.</li>
                <li>Changed your mind? Return within 7 days, sealed and unused.</li>
              </ul>
            </Accordion>
          </div>
        </section>
      </div>

      <div className={cn("fixed inset-x-2 bottom-2 z-40 transition-all duration-300 lg:hidden", showBar ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-24 opacity-0")}>
        <div className="glass-strong flex items-center gap-3 rounded-[24px] p-2 pl-4">
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-[12px] text-muted">{color.name}</div>
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
