"use client";

import Link from "next/link";
import { useState } from "react";
import { Minus, Plus, Trash2, Tag, X } from "lucide-react";
import { useCart } from "@/stores/cart";
import { money, cn } from "@/lib/format";
import { ProductThumb } from "./CaseThumb";
import type { Cart } from "@/lib/types";

export function CartItems({ cart, compact = false }: { cart: Cart; compact?: boolean }) {
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const close = useCart((s) => s.setOpen);
  return (
    <ul className="flex flex-col gap-2.5">
      {cart.items.map((i) => (
        <li key={i.id} className="flex gap-3 rounded-[22px] bg-white/75 p-2.5 pr-3">
          <Link href={`/product/${i.product.slug}?${i.model ? `model=${i.model.slug}&` : ""}color=${i.color.id}`} onClick={() => close(false)} className="grid h-[88px] w-[64px] shrink-0 place-items-center rounded-2xl bg-[#f1f2f6]">
            {i.product.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={i.product.image} alt="" className="h-[78px] w-auto rounded-lg object-contain" />
              ) : (
                <ProductThumb material={i.product.material} color={i.color.hex} imageUrl={i.custom?.imageUrl} design={i.product.design ? { url: i.product.design } : null} className="h-[78px] w-auto" />
              )}
          </Link>
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-start justify-between gap-2">
              <Link href={`/product/${i.product.slug}?${i.model ? `model=${i.model.slug}&` : ""}color=${i.color.id}`} onClick={() => close(false)} className="line-clamp-1 text-[14.5px] font-semibold">
                {i.product.name}
              </Link>
              <button onClick={() => remove(i.id)} className="text-muted hover:text-danger" aria-label={`Remove ${i.product.name}`}>
                <Trash2 size={16} />
              </button>
            </div>
            <p className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-muted">
              <span className="inline-block h-2.5 w-2.5 rounded-full border border-black/10" style={{ background: i.color.hex }} />
              {[i.color.name, i.model?.name].filter(Boolean).join(" · ")}
            </p>
            {i.custom && (
              <p className="mt-0.5 text-[12px] font-medium text-accent">
                {i.custom.coverage === "back_sides" ? "Back + sides" : i.custom.coverage === "back" ? "Back only" : ""}
                {i.custom.imageUrl ? `${i.custom.coverage ? " · " : ""}Your photo ✓` : ""}
              </p>
            )}
            {i.issue && (
              <p className="mt-1 text-xs font-medium text-danger">
                {i.issue === "out_of_stock" ? "Sold out — please remove" : i.issue === "missing_photo" ? "Photo missing — please remove and add again" : `Only ${i.stock} left`}
              </p>
            )}
            <div className="mt-auto flex items-center justify-between pt-1.5">
              <div className="flex items-center rounded-full bg-[#f1f2f6]">
                <button className="grid h-8 w-8 place-items-center" onClick={() => setQty(i.id, i.qty - 1)} aria-label="Decrease quantity">
                  <Minus size={14} />
                </button>
                <span className="w-6 text-center text-sm font-semibold tabular-nums">{i.qty}</span>
                <button className="grid h-8 w-8 place-items-center disabled:opacity-30" disabled={i.qty >= Math.min(i.stock, 20)} onClick={() => setQty(i.id, i.qty + 1)} aria-label="Increase quantity">
                  <Plus size={14} />
                </button>
              </div>
              <span className={cn("font-semibold tabular-nums", compact ? "text-[14.5px]" : "text-[15px]")}>{money(i.lineTotal)}</span>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function FreeShippingBar({ cart }: { cart: Cart }) {
  const left = cart.totals.freeShippingRemaining;
  const target = cart.totals.subtotal - cart.totals.discount + left;
  const pct = left <= 0 ? 100 : Math.min(100, ((target - left) / target) * 100);
  return (
    <div className="rounded-2xl bg-white/70 p-3">
      <p className="text-[13px]">
        {left > 0 ? (
          <>
            Add <b>{money(left)}</b> more for <b>FREE delivery</b> 🚚
          </>
        ) : (
          <>🎉 You’ve unlocked <b>FREE delivery</b></>
        )}
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/5">
        <div className="h-full rounded-full bg-gradient-to-r from-[#4a65ff] to-[#7c3aed] transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      {cart.bundles?.map((b) => (
        <p key={b.model} className="mt-2 text-[12.5px] font-medium text-success">✓ Bundle for {b.model}: you save {money(b.discount)}</p>
      ))}
    </div>
  );
}

export function CouponBox({ cart }: { cart: Cart }) {
  const apply = useCart((s) => s.applyCoupon);
  const removeCoupon = useCart((s) => s.removeCoupon);
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (cart.coupon)
    return (
      <div className="flex items-center justify-between rounded-2xl bg-[#e9f8ef] px-3 py-2.5 text-sm text-[#0b6b3a]">
        <span className="flex items-center gap-2 font-medium">
          <Tag size={15} /> {cart.coupon.code} applied
        </span>
        <button onClick={() => removeCoupon()} aria-label="Remove coupon">
          <X size={16} />
        </button>
      </div>
    );
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!code.trim()) return;
        setBusy(true);
        setErr(await apply(code.trim()));
        setBusy(false);
      }}
    >
      <div className="flex gap-2">
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Coupon code" className="input h-11 flex-1 uppercase" aria-label="Coupon code" />
        <button className="btn btn-glass h-11 px-4" disabled={busy}>
          Apply
        </button>
      </div>
      {err && <p className="mt-1.5 text-xs text-danger">{err}</p>}
    </form>
  );
}

export function Totals({ cart, showTotalLabel = "Total" }: { cart: Cart; showTotalLabel?: string }) {
  const t = cart.totals;
  return (
    <dl className="space-y-1.5 text-[14.5px]">
      <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd className="tabular-nums">{money(t.subtotal)}</dd></div>
      {(t.bundleDiscount ?? 0) > 0 && (
        <div className="flex justify-between text-success"><dt>Bundle discount</dt><dd className="tabular-nums">−{money(t.bundleDiscount!)}</dd></div>
      )}
      {t.discount - (t.bundleDiscount ?? 0) > 0 && (
        <div className="flex justify-between text-success"><dt>{cart.coupon ? `Coupon ${cart.coupon.code}` : "Discount"}</dt><dd className="tabular-nums">−{money(t.discount - (t.bundleDiscount ?? 0))}</dd></div>
      )}
      <div className="flex justify-between"><dt className="text-muted">Delivery</dt><dd className="tabular-nums">{t.shipping === 0 ? <span className="font-medium text-success">FREE</span> : money(t.shipping)}</dd></div>
      <div className="flex justify-between border-t border-line pt-2.5 text-[17px] font-bold"><dt>{showTotalLabel}</dt><dd className="tabular-nums">{money(t.total)}</dd></div>
      {t.savings > 0 && <p className="text-right text-xs font-medium text-success">You save {money(t.savings)}</p>}
    </dl>
  );
}
