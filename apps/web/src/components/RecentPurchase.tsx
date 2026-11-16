"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BadgeCheck, X } from "lucide-react";
import { api } from "@/lib/client-api";
import { ProductThumb } from "./CaseThumb";

type Sale = { city: string; product: string; slug: string; material: string | null; colorHex: string; model: string | null; at: string };

const HIDE_ON = ["/admin", "/checkout", "/review", "/rider", "/cart", "/account"];

function ago(iso: string) {
  if (!iso) return "recently";
  if (iso.includes("ago") || iso.includes("just now") || iso.includes("yesterday") || iso.includes("min") || iso.includes("hour")) return iso;
  const m = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (isNaN(m)) return iso;
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} ${h === 1 ? "hour" : "hours"} ago`;
  const d = Math.round(h / 24);
  return `${d} ${d === 1 ? "day" : "days"} ago`;
}

/**
 * Small "Someone in Lahore bought …" card, bottom-left.
 * Fully configurable from the Admin panel: real orders, custom highlights, timing & frequency.
 */
export function RecentPurchase() {
  const path = usePathname();
  const [sales, setSales] = useState<Sale[]>([]);
  const [settings, setSettings] = useState<{
    enabled: boolean;
    mode: "hybrid" | "custom" | "real";
    initialDelaySec: number;
    intervalSec: number;
    durationSec: number;
  }>({
    enabled: true,
    mode: "hybrid",
    initialDelaySec: 6,
    intervalSec: 28,
    durationSec: 6,
  });
  const [cur, setCur] = useState<Sale | null>(null);
  const [show, setShow] = useState(false);
  const [off, setOff] = useState(false);
  const idx = useRef(0);
  const hidden = HIDE_ON.some((p) => path.startsWith(p));

  useEffect(() => {
    try {
      if (sessionStorage.getItem("mg-proof-off")) {
        queueMicrotask(() => setOff(true));
      }
    } catch {}
    const t = setTimeout(() => {
      api<{ data: Sale[]; settings?: typeof settings }>("/social-proof", { auth: false })
        .then((r) => {
          setSales(r.data);
          if (r.settings) setSettings(r.settings);
        })
        .catch(() => {});
    }, 2000); // after the page is ready — never slows the first load
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!sales.length || off || hidden || settings.enabled === false) return;
    let t1: ReturnType<typeof setTimeout>;
    let t2: ReturnType<typeof setTimeout>;
    const durationMs = Math.max(2, settings.durationSec || 6) * 1000;
    const intervalMs = Math.max(5, settings.intervalSec || 28) * 1000;
    const initialMs = Math.max(1, settings.initialDelaySec || 6) * 1000;

    const next = (wait: number) => {
      t1 = setTimeout(() => {
        if (document.hidden) return next(5000);
        setCur(sales[idx.current % sales.length]);
        idx.current++;
        setShow(true);
        t2 = setTimeout(() => {
          setShow(false);
          next(intervalMs);
        }, durationMs);
      }, wait);
    };
    next(initialMs);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      setShow(false);
    };
  }, [sales, off, hidden, settings]);

  if (!cur || off || hidden) return null;
  const onProduct = path.startsWith("/product");
  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed left-3 z-[60] w-[calc(100%-6rem)] max-w-[330px] transition-all duration-500 sm:left-5 ${onProduct ? "bottom-24 sm:bottom-5" : "bottom-5"} ${
        show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
      }`}
    >
      <div className="glass relative flex items-center gap-3 rounded-[20px] !bg-white/95 p-2.5 pr-8 shadow-[0_18px_40px_-18px_rgba(15,23,42,.45)]">
        <Link href={`/product/${cur.slug}`} className="grid h-14 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-b from-[#f4f5f9] to-[#e9ebf1]">
          <ProductThumb material={cur.material ?? "clear"} color={cur.colorHex} className="h-[86%] w-auto" />
        </Link>
        <Link href={`/product/${cur.slug}`} className="min-w-0 text-[12.5px] leading-snug">
          <span className="text-muted">Someone in <b className="text-ink">{cur.city}</b> bought</span>
          <b className="block truncate text-[13.5px]">{cur.product}</b>
          <span className="flex items-center gap-1 text-[11.5px] text-muted">
            {ago(cur.at)} · <BadgeCheck size={12} className="text-success" /> real order
          </span>
        </Link>
        <button
          onClick={() => {
            setOff(true);
            try { sessionStorage.setItem("mg-proof-off", "1"); } catch {}
          }}
          className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full text-muted hover:bg-black/5"
          aria-label="Hide"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
}
