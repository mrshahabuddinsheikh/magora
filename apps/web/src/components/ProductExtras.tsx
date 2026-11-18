"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, Check, Link2, MapPin, Plus, Share2, ShoppingBag, Truck } from "lucide-react";
import { api } from "@/lib/client-api";
import { ProductThumb } from "./CaseThumb";
import { ProductCard } from "./ProductCard";
import { cardPhoto, designFor, viewOf } from "@/lib/view";
import { useCart } from "@/stores/cart";
import { useRecent } from "@/stores/recent";
import { cn, money } from "@/lib/format";
import type { Color, Paged, Product, ProductListItem } from "@/lib/types";

/* ─────────── delivery estimate ─────────── */

export interface DeliveryInfo {
  cities: string[];
  etaByCity: Record<string, [number, number]>;
  etaDefault: [number, number];
  freeAbove: number;
  flatRate: number;
}

function arrival(days: number) {
  // count working days (skip Sunday)
  const d = new Date();
  let left = days;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0) left--;
  }
  return d.toLocaleDateString("en-PK", { weekday: "short", day: "numeric", month: "short" });
}

/** "Delivery to Karachi: Fri 14 Nov – Sat 15 Nov" with a city picker the customer's choice is remembered */
export function DeliveryEstimate({ info, madeToOrder = 0 }: { info: DeliveryInfo; madeToOrder?: number }) {
  const city = useRecent((s) => s.city);
  const setCity = useRecent((s) => s.setCity);
  const [ready, setReady] = useState(false);
  const [timeLeft, setTimeLeft] = useState("2h 45m");

  useEffect(() => {
    Promise.resolve(useRecent.persist.rehydrate()).then(() => setReady(true));
    const updateCountdown = () => {
      const now = new Date();
      const cutoff = new Date();
      cutoff.setHours(17, 0, 0, 0);
      let diff = cutoff.getTime() - now.getTime();
      if (diff <= 0) {
        cutoff.setDate(cutoff.getDate() + 1);
        diff = cutoff.getTime() - now.getTime();
      }
      const hrs = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      setTimeLeft(`${hrs}h ${mins}m`);
    };
    queueMicrotask(updateCountdown);
    const interval = setInterval(updateCountdown, 60000);
    return () => clearInterval(interval);
  }, []);

  const c = city && info.cities.includes(city) ? city : "Karachi";
  const [a, b] = info.etaByCity[c] ?? info.etaDefault;
  return (
    <div className="mt-4 rounded-2xl bg-black/[0.03] dark:bg-white/[0.03] p-3 text-[13.5px] space-y-1">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Truck size={17} className="shrink-0 text-accent" />
        <span>Delivery to</span>
        <label className="relative inline-flex items-center gap-1 font-semibold">
          <MapPin size={13} className="text-muted" />
          <select
            aria-label="Your city"
            value={c}
            onChange={(e) => setCity(e.target.value)}
            className="cursor-pointer appearance-none bg-transparent pr-1 font-semibold underline decoration-dotted underline-offset-4 outline-none"
          >
            {info.cities.filter((x) => x !== "Other").map((x) => (
              <option key={x} className="text-black">{x}</option>
            ))}
          </select>
        </label>
        <span className={cn("font-semibold text-success transition-opacity", ready ? "opacity-100" : "opacity-0")}>
          {arrival(a + madeToOrder)} – {arrival(b + madeToOrder)}
        </span>
      </div>
      <div className="flex items-center gap-1.5 text-[12px] text-amber-700 dark:text-amber-400 font-medium pl-6">
        <span className="flex h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping" />
        <span>Order within <b className="font-bold">{timeLeft}</b> for same-day dispatch by TCS!</span>
      </div>
    </div>
  );
}

/* ─────────── back in stock ─────────── */

export function NotifyMe({ productId, colorId, modelSlug, label }: { productId: number; colorId?: number; modelSlug?: string; label: string }) {
  const [phone, setPhone] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    queueMicrotask(() => {
      setState("idle");
      setErr(null);
    });
  }, [productId, colorId, modelSlug]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setState("busy");
    try {
      await api("/stock-alerts", { method: "POST", json: { productId, colorId, modelSlug, phone }, auth: false });
      setState("done");
    } catch (x) {
      setErr((x as Error).message);
      setState("idle");
    }
  };

  if (state === "done")
    return (
      <p className="mt-3 flex items-center gap-2 rounded-2xl bg-[#e8f8ef] px-4 py-3 text-[13.5px] font-medium text-success">
        <Check size={16} /> Done! We’ll WhatsApp you as soon as {label} is back.
      </p>
    );
  return (
    <form onSubmit={submit} className="mt-3 rounded-2xl border border-black/10 bg-white/80 p-3">
      <p className="mb-2 flex items-center gap-2 text-[13.5px] font-semibold">
        <Bell size={15} className="text-accent" /> Get a WhatsApp message when it’s back
      </p>
      <div className="flex gap-2">
        <input
          type="tel"
          inputMode="tel"
          required
          placeholder="03xx xxxxxxx"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="h-11 min-w-0 flex-1 rounded-full border border-black/10 bg-white px-4 text-[15px] outline-none focus:border-accent"
        />
        <button className="btn btn-dark h-11 shrink-0 px-5" disabled={state === "busy"}>
          Notify me
        </button>
      </div>
      {err && <p className="mt-2 text-sm text-danger">{err}</p>}
    </form>
  );
}

/* ─────────── share ─────────── */

export function ShareProduct({ name }: { name: string }) {
  const [copied, setCopied] = useState(false);
  const url = () => window.location.href;
  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: name, url: url() });
        return;
      } catch {
        /* cancelled → fall through to WhatsApp */
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${name} ${url()}`)}`, "_blank", "noopener");
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url());
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };
  return (
    <div className="flex items-center gap-1.5">
      <button onClick={share} className="flex h-9 items-center gap-1.5 rounded-full bg-[#25d366]/10 px-3 text-[12.5px] font-semibold text-[#128c4b] hover:bg-[#25d366]/20" aria-label="Share on WhatsApp">
        <Share2 size={14} /> Share
      </button>
      <button onClick={copy} className="grid h-9 w-9 place-items-center rounded-full bg-black/[0.04] hover:bg-black/[0.08]" aria-label="Copy link" title="Copy link">
        {copied ? <Check size={15} className="text-success" /> : <Link2 size={15} />}
      </button>
    </div>
  );
}

/* ─────────── frequently bought together ─────────── */

const BUNDLE_SECTIONS = ["magsafe-cases", "skins", "screen-protectors"];
const BUNDLE_PCT = 10; // keep in sync with store.bundle.percent in the API

interface Pick {
  item: ProductListItem;
  variantId: number;
  price: number;
  color: Color;
}

const Row = ({ name, sub, price, children, on, toggle }: { name: string; sub: string; price: number; children: React.ReactNode; on: boolean; toggle?: () => void }) => (
  <label className={cn("flex items-center gap-3 rounded-2xl p-2 transition", toggle && "cursor-pointer hover:bg-black/[0.03]", !on && "opacity-50")}>
    <input type="checkbox" checked={on} disabled={!toggle} onChange={toggle} className="h-4 w-4 shrink-0 accent-[#4a65ff]" />
    <span className="grid h-14 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-b from-[#f4f5f9] to-[#e9ebf1]">{children}</span>
    <span className="min-w-0 flex-1 leading-tight">
      <b className="block truncate text-[13.5px]">{name}</b>
      <span className="text-[12px] text-muted">{sub}</span>
    </span>
    <span className="text-[13.5px] font-semibold tabular-nums">{money(price)}</span>
  </label>
);

/** Case + protector + skin for the same phone, with the bundle discount shown up-front */
export function BoughtTogether({
  product: p,
  model,
  current,
}: {
  product: Product;
  model: { id: number; slug: string; name: string };
  current: { variantId?: number; price: number; color: Color; soldOut: boolean; needsPhoto: boolean };
}) {
  const add = useCart((s) => s.add);
  const busy = useCart((s) => s.busy);
  const cart = useCart((s) => s.cart);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [off, setOff] = useState<Set<number>>(new Set());
  const [done, setDone] = useState(false);
  const section = p.category?.section;
  const others = BUNDLE_SECTIONS.filter((x) => x !== section);

  useEffect(() => {
    if (!BUNDLE_SECTIONS.includes(section)) return;
    let alive = true;
    setDone(false);
    (async () => {
      try {
        const list = await api<Paged<ProductListItem>>(`/products?category=${others.join(",")}&model=${model.slug}&limit=12`, { auth: false });
        const bySection = new Map<string, ProductListItem>();
        for (const x of list.data) if (x.material !== "skin-custom" && x.section && !bySection.has(x.section)) bySection.set(x.section, x);
        const found = await Promise.all(
          [...bySection.values()].map(async (item) => {
            const d = await api<{ data: Product }>(`/products/${item.slug}`, { auth: false });
            const v = d.data.variants.find((v) => v.modelId === model.id && v.stock > 0);
            if (!v) return null;
            return { item, variantId: v.id, price: v.price, color: d.data.colors.find((c) => c.id === v.colorId) ?? d.data.colors[0] };
          }),
        );
        if (alive) setPicks(found.filter(Boolean) as Pick[]);
      } catch {
        if (alive) setPicks([]);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.slug, model.slug]);

  const chosen = useMemo(() => picks.filter((x) => !off.has(x.variantId)), [picks, off]);
  const sum = current.price + chosen.reduce((a, x) => a + x.price, 0);
  const save = chosen.length ? Math.round((sum * BUNDLE_PCT) / 100) : 0;

  const isBundleInCart = useMemo(() => {
    if (!chosen.length || !cart?.items?.length) return false;
    const currentIn = current.variantId ? cart.items.some((i) => i.variantId === current.variantId) : true;
    const allExtrasIn = chosen.every((x) => cart.items.some((i) => i.variantId === x.variantId));
    return currentIn && allExtrasIn;
  }, [chosen, cart?.items, current.variantId]);

  if (!picks.length || current.soldOut) return null;

  const addAll = async () => {
    if (current.needsPhoto || !current.variantId) {
      // custom skins need a photo first → add only the extras
    } else if (!(await add(current.variantId, 1, { name: p.name, model: model.name, color: current.color.name, hex: current.color.hex }))) return;
    for (const x of chosen) await add(x.variantId, 1, { name: x.item.name, model: model.name, color: x.color.name, hex: x.color.hex });
    setDone(true);
  };



  return (
    <section className="card mt-4 p-4 sm:p-5" aria-label="Frequently bought together">
      <h2 className="mb-1 text-[16px] font-bold">Complete the protection for your {model.name}</h2>
      <p className="mb-3 text-[13px] text-muted">
        Buy together and save <b className="text-success">{BUNDLE_PCT}%</b> on the set — applied automatically in your bag.
      </p>
      <Row name={`${p.name} (this item)`} sub={current.color.name} price={current.price} on>
        <ProductThumb material={p.material} color={current.color.hex} accent={current.color.accentHex} design={designFor(viewOf(p.view), current.color)} modelSlug={model.slug} className="h-[86%] w-auto" />
      </Row>
      {picks.map((x) => {
        const on = !off.has(x.variantId);
        const photo = cardPhoto(x.item.images, viewOf(x.item.view));
        return (
          <div key={x.variantId} className="flex items-center">
            <Plus size={13} className="-ml-0.5 mr-0.5 shrink-0 text-muted" />
            <div className="min-w-0 flex-1">
              <Row
                name={x.item.name}
                sub={x.color.name}
                price={x.price}
                on={on}
                toggle={() => setOff((s) => { const n = new Set(s); if (n.has(x.variantId)) n.delete(x.variantId); else n.add(x.variantId); return n; })}
              >
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo} alt="" className="h-full w-full object-contain p-1" loading="lazy" />
                ) : (
                  <ProductThumb material={x.item.material} color={x.color.hex} accent={x.color.accentHex} design={designFor(viewOf(x.item.view), x.color)} modelSlug={model.slug} className="h-[86%] w-auto" />
                )}
              </Row>
            </div>
          </div>
        );
      })}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
        <div className="leading-tight">
          <span className="text-[12.5px] text-muted">Set price</span>
          <div className="flex items-baseline gap-2">
            <b className="text-[18px] tabular-nums">{money(sum - save)}</b>
            {save > 0 && <span className="text-[13px] text-muted line-through tabular-nums">{money(sum)}</span>}
          </div>
        </div>
        {isBundleInCart || done ? (
          <button
            type="button"
            className="btn btn-primary h-11 bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-bold shadow-sm"
            onClick={() => useCart.getState().setOpen(true)}
          >
            <Check size={17} /> Added to bag · View Bag
          </button>
        ) : (
          <button className="btn btn-primary h-11" disabled={busy || !chosen.length} onClick={addAll}>
            <ShoppingBag size={17} /> Add {chosen.length + (current.needsPhoto ? 0 : 1)} to bag
          </button>
        )}
      </div>
      {current.needsPhoto && <p className="mt-2 text-[12px] text-muted">Your photo skin is added separately after you upload your photo.</p>}
    </section>
  );
}

/* ─────────── recently viewed ─────────── */

export function RecentlyViewed({ current }: { current?: string }) {
  const slugs = useRecent((s) => s.slugs);
  const seen = useRecent((s) => s.seen);
  const [items, setItems] = useState<ProductListItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.resolve(useRecent.persist.rehydrate()).then(() => {
      if (current) seen(current);
      setReady(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  const show = slugs.filter((x) => x !== current).slice(0, 8);
  const key = show.join(",");
  useEffect(() => {
    if (!ready || !key) {
      setItems([]);
      return;
    }
    let alive = true;
    api<Paged<ProductListItem>>(`/products?slugs=${key}&limit=8`, { auth: false })
      .then((r) => alive && setItems(show.map((s) => r.data.find((x) => x.slug === s)).filter(Boolean) as ProductListItem[]))
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ready]);

  if (!items.length) return null;
  return (
    <section className="mt-12" aria-label="Recently viewed">
      <h2 className="mb-5 text-[22px] font-bold tracking-tight">Recently viewed</h2>
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:gap-4">
        {items.map((x) => (
          <div key={x.id} className="w-[46%] shrink-0 snap-start sm:w-[30%] lg:w-[23%]">
            <ProductCard p={x} />
          </div>
        ))}
      </div>
    </section>
  );
}

