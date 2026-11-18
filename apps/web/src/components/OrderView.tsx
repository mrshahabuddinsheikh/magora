"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { Check, Circle, Clock, ExternalLink, MapPin, Phone, RotateCcw, Truck, X, PackageCheck, Warehouse, Bike } from "lucide-react";
import { cn, dateTime, money } from "@/lib/format";
import { api } from "@/lib/client-api";
import type { Order, ReturnRequest } from "@/lib/types";
import { VanDeliveryAnimation } from "./VanDeliveryAnimation";

const LiveMap = dynamic(() => import("./LiveMap").then((m) => m.LiveMap), { ssr: false, loading: () => <div className="skeleton h-[260px] rounded-[20px]" /> });

const FLOW = ["pending", "confirmed", "processing", "shipped", "out_for_delivery", "delivered"];
const LABEL: Record<string, string> = { pending: "Placed", confirmed: "Confirmed", processing: "Packed", shipped: "Shipped", out_for_delivery: "On the way", delivered: "Delivered" };

const ago = (s: string | null) => {
  if (!s) return "";
  const m = Math.round((Date.now() - new Date(s).getTime()) / 60000);
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
};

function etaText(eta: string | null, status: string) {
  if (status === "delivered") return null;
  if (!eta) return null;
  const d = new Date(eta);
  const today = new Date();
  const tomorrow = new Date(Date.now() + 864e5);
  const time = d.toLocaleTimeString("en-PK", { hour: "numeric", minute: "2-digit" });
  if (d.toDateString() === today.toDateString()) return `Today, by ${time}`;
  if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow, by ${time}`;
  return d.toLocaleDateString("en-PK", { weekday: "long", day: "numeric", month: "short" });
}

/**
 * Full order view: progress, live delivery tracking (map when the rider is on the
 * way), items, address, returns. `refresh` is polled while the rider is live.
 */
export function OrderView({ order: o, token, phone, refresh, admin = false }: { order: Order; token?: string | null; phone?: string; refresh?: () => Promise<void> | void; admin?: boolean }) {
  const closed = o.status === "cancelled" || o.status === "returned";
  const idx = FLOW.indexOf(o.status);
  const sh = o.shipment;
  const live = !!sh?.rider?.live;
  const [returnOpen, setReturnOpen] = useState(false);

  useEffect(() => {
    if (!refresh || !sh || ["delivered", "returned_to_sender"].includes(sh.status)) return;
    const t = setInterval(() => refresh(), live ? 15_000 : 60_000);
    return () => clearInterval(t);
  }, [refresh, sh, live]);

  const points = useMemo(
    () => (sh?.rider?.lat != null && sh.rider.lng != null ? [{ lat: sh.rider.lat, lng: sh.rider.lng, label: `${sh.rider.name ?? "Rider"} · ${ago(sh.rider.updatedAt)}`, kind: "rider" as const }] : []),
    [sh],
  );
  const eta = sh ? etaText(sh.eta, sh.status) : null;

  return (
    <div className="space-y-4">
      {/* Delightful Delivery Van Dispatch Animation */}
      <VanDeliveryAnimation orderNumber={o.number} customerName={o.customer?.name} />

      {/* status */}
      <div className="card p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm text-muted">Order · {dateTime(o.createdAt)}</p>
            <p className="text-xl font-bold tracking-tight">{o.number}</p>
          </div>
          <span className={cn("rounded-full px-3 py-1.5 text-sm font-semibold", closed ? "bg-[#fde8e8] text-danger" : o.status === "delivered" ? "bg-[#e9f8ef] text-success" : "bg-[#eef1ff] text-accent")}>
            {o.statusLabel}
          </span>
        </div>

        {!closed ? (
          <ol className="mt-6 grid grid-cols-6 gap-0.5">
            {FLOW.map((s, i) => (
              <li key={s} className="flex flex-col items-center text-center">
                <div className="flex w-full items-center">
                  <span className={cn("h-0.5 flex-1", i === 0 ? "opacity-0" : i <= idx ? "bg-accent" : "bg-black/10")} />
                  <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full transition", i <= idx ? "bg-accent text-white" : "bg-black/[0.06] text-muted", i === idx && i < FLOW.length - 1 && "ring-4 ring-accent/20")}>
                    {i <= idx ? <Check size={15} /> : <Circle size={10} />}
                  </span>
                  <span className={cn("h-0.5 flex-1", i === FLOW.length - 1 ? "opacity-0" : i < idx ? "bg-accent" : "bg-black/10")} />
                </div>
                <span className={cn("mt-1.5 text-[10.5px] font-medium leading-tight sm:text-[12.5px]", i <= idx ? "text-ink" : "text-muted")}>{LABEL[s]}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-4 flex items-center gap-2 text-sm text-danger">
            <X size={16} /> This order was {o.status}.
          </p>
        )}
      </div>

      {/* delivery tracking */}
      {sh && (
        <div className="card overflow-hidden p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-muted">
                <Truck size={16} /> {sh.courierName}
                {sh.trackingNumber && (
                  <>
                    {" · "}
                    {sh.trackingUrl ? (
                      <a href={sh.trackingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent">
                        {sh.trackingNumber} <ExternalLink size={12} />
                      </a>
                    ) : (
                      sh.trackingNumber
                    )}
                  </>
                )}
              </p>
              <p className="mt-1 text-[22px] font-bold tracking-tight">{sh.statusLabel}</p>
              {sh.currentLocation && sh.status !== "delivered" && (
                <p className="flex items-center gap-1 text-sm text-muted">
                  <MapPin size={14} /> {sh.currentLocation}
                </p>
              )}
            </div>
            {eta && (
              <div className="rounded-2xl bg-[#eef1ff] px-4 py-3 text-right">
                <p className="flex items-center justify-end gap-1 text-[12px] font-semibold uppercase tracking-wide text-accent">
                  <Clock size={13} /> Expected
                </p>
                <p className="text-[17px] font-bold">{eta}</p>
              </div>
            )}
          </div>

          {sh.status === "out_for_delivery" && sh.rider && (
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-black/[0.03] p-3">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-b from-[#4a65ff] to-[#2f49f0] text-white">
                <Bike size={20} />
              </span>
              <div className="flex-1">
                <p className="font-semibold">{sh.rider.name ?? "Your rider"} is on the way</p>
                <p className="text-xs text-muted">{live ? `Live location · updated ${ago(sh.rider.updatedAt)}` : "Live location appears when the rider shares it"}</p>
              </div>
              {sh.rider.phone && (
                <a href={`tel:${sh.rider.phone}`} className="btn btn-glass h-10 px-4 text-sm">
                  <Phone size={15} /> Call rider
                </a>
              )}
            </div>
          )}

          {(live || (admin && points.length > 0)) && (
            <div className="mt-4">
              <LiveMap points={points} />
            </div>
          )}

          {/* shipment journey */}
          <ol className="relative mt-5 space-y-4 border-l-2 border-black/[0.07] pl-5">
            {sh.events.map((e, i) => (
              <li key={i} className="relative">
                <span className={cn("absolute -left-[29px] grid h-[18px] w-[18px] place-items-center rounded-full border-2 border-white", i === 0 ? "bg-accent" : "bg-black/20")}>
                  {e.status === "delivered" ? <PackageCheck size={10} className="text-white" /> : e.status === "at_hub" ? <Warehouse size={10} className="text-white" /> : null}
                </span>
                <p className={cn("text-[14px] font-semibold", i === 0 ? "text-ink" : "text-ink/70")}>{e.label}</p>
                <p className="text-[12.5px] text-muted">
                  {dateTime(e.at)}
                  {e.location ? ` · ${e.location}` : ""}
                  {e.note ? ` · ${e.note}` : ""}
                </p>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-[1.3fr_1fr]">
        <div className="card p-5 sm:p-6">
          <h3 className="font-bold">Items</h3>
          <ul className="mt-3 divide-y divide-line">
            {o.items.map((i) => (
              <li key={i.id} className="flex items-center gap-3 py-3">
                <span className="h-9 w-9 shrink-0 rounded-xl border border-black/10" style={{ background: i.colorHex }} />
                <div className="min-w-0 flex-1">
                  <Link href={`/product/${i.productSlug}`} className="block truncate font-medium hover:text-accent">
                    {i.productName}
                  </Link>
                  <p className="text-xs text-muted">
                    {[i.modelName, i.colorName].filter(Boolean).join(" · ")} · ×{i.qty}
                    {i.custom?.coverage && ` · ${i.custom.coverage === "back_sides" ? "Back + sides" : "Back only"}`}
                  </p>
                  {i.custom?.imageUrl && (
                    <a href={i.custom.imageUrl} target="_blank" rel="noopener noreferrer" download className="mt-1 inline-flex items-center gap-2 rounded-xl bg-[#f2f4ff] py-1 pl-1 pr-2.5 text-xs font-semibold text-accent">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={i.custom.imageUrl} alt="" className="h-8 w-6 rounded-md object-cover" />
                      {admin ? "Download print file" : "Your photo"}
                    </a>
                  )}
                </div>
                <span className="font-semibold tabular-nums">{money(i.lineTotal)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-2 space-y-1 border-t border-line pt-3 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{money(o.totals.subtotal)}</dd></div>
            {o.totals.discount > 0 && <div className="flex justify-between text-success"><dt>Discount {o.couponCode && `(${o.couponCode})`}</dt><dd>−{money(o.totals.discount)}</dd></div>}
            <div className="flex justify-between"><dt className="text-muted">Delivery</dt><dd>{o.totals.shipping ? money(o.totals.shipping) : "FREE"}</dd></div>
            <div className="flex justify-between pt-1 text-base font-bold"><dt>{o.paymentMethod === "cod" && o.paymentStatus !== "paid" ? "Pay on delivery" : "Total"}</dt><dd>{money(o.totals.total)}</dd></div>
          </dl>
        </div>
        <div className="card p-5 text-sm sm:p-6">
          <h3 className="font-bold">Delivery to</h3>
          <p className="mt-2 font-medium">{o.customer.name}</p>
          <p className="text-muted">{o.customer.phone}</p>
          <p className="mt-2 text-muted">{o.address.line1}{o.address.area ? `, ${o.address.area}` : ""}, {o.address.city}</p>
          <h3 className="mt-5 font-bold">Payment</h3>
          <p className="mt-1 text-muted">{o.paymentMethod === "cod" ? "Cash on Delivery" : o.paymentMethod} · {o.paymentStatus === "paid" ? "Paid" : o.paymentStatus === "refunded" ? "Refunded" : "Not paid yet"}</p>
          {!admin && (
            <>
              <h3 className="mt-5 font-bold">Order timeline</h3>
              <ul className="mt-2 space-y-1.5 text-[12.5px]">
                {[...o.timeline].reverse().map((t, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span>{t.label}</span>
                    <span className="shrink-0 text-muted">{dateTime(t.at)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      {/* returns */}
      {(o.returns.length > 0 || o.canReturn) && !admin && (
        <div className="card p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 font-bold"><RotateCcw size={17} /> Returns & exchange</h3>
              {o.canReturn && o.returnDeadline && (
                <p className="text-sm text-muted">You can return or exchange until {new Date(o.returnDeadline).toLocaleDateString("en-PK", { day: "numeric", month: "long" })}.</p>
              )}
            </div>
            {o.canReturn && (
              <button className="btn btn-dark h-11" onClick={() => setReturnOpen((v) => !v)}>
                {returnOpen ? "Close" : "Return or exchange"}
              </button>
            )}
          </div>
          {o.returns.length > 0 && (
            <ul className="mt-3 divide-y divide-line">
              {o.returns.map((r) => (
                <li key={r.number} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <span>
                    <b>{r.number}</b> · {r.resolution === "exchange" ? "Exchange" : "Refund"} · <span className="text-muted">{r.reason}</span>
                  </span>
                  <span className="rounded-full bg-[#eef1ff] px-2.5 py-1 text-xs font-semibold text-accent">{r.statusLabel}</span>
                </li>
              ))}
            </ul>
          )}
          {returnOpen && <ReturnForm order={o} token={token} phone={phone} onDone={async () => { setReturnOpen(false); await refresh?.(); }} />}
        </div>
      )}
    </div>
  );
}

function ReturnForm({ order, token, phone, onDone }: { order: Order; token?: string | null; phone?: string; onDone: () => void }) {
  const [reasons, setReasons] = useState<string[]>([]);
  const [qty, setQty] = useState<Record<number, number>>(Object.fromEntries(order.items.map((i) => [i.id, i.qty])));
  const [resolution, setResolution] = useState<"exchange" | "refund">("exchange");
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [extra, setExtra] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<ReturnRequest | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ data: string[] }>("/returns/reasons", { auth: false }).then((r) => setReasons(r.data)).catch(() => {});
  }, []);

  if (done)
    return (
      <div className="mt-4 rounded-2xl bg-[#e9f8ef] p-4 text-sm text-[#0b6b3a]">
        <b>Request {done.number} received.</b> We’ll call you within 24 hours to arrange the pickup.
        <button className="ml-2 underline" onClick={onDone}>OK</button>
      </div>
    );

  const items = order.items.filter((i) => (qty[i.id] ?? 0) > 0).map((i) => ({ orderItemId: i.id, qty: qty[i.id] }));
  const refund = order.items.reduce((a, i) => a + i.unitPrice * (qty[i.id] ?? 0), 0);

  return (
    <form
      className="mt-4 space-y-4 rounded-[22px] bg-black/[0.03] p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!items.length) return setErr("Select at least one item");
        if (!reason) return setErr("Please choose a reason");
        setBusy(true);
        setErr(null);
        try {
          const r = await api<{ data: ReturnRequest }>(`/orders/${order.number}/returns`, {
            method: "POST",
            json: { token: token ?? undefined, phone, resolution, reason, details: details || undefined, items, ...(resolution === "exchange" ? { exchangeNote: extra || undefined } : { refundMethod: extra || undefined }) },
          });
          setDone(r.data);
        } catch (e) {
          setErr((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div>
        <p className="label">1. Which items?</p>
        <div className="space-y-2">
          {order.items.map((i) => (
            <label key={i.id} className="flex items-center gap-3 rounded-2xl bg-white/80 p-3 text-sm">
              <span className="h-7 w-7 rounded-lg border border-black/10" style={{ background: i.colorHex }} />
              <span className="flex-1">
                <b>{i.productName}</b>
                <span className="block text-xs text-muted">{[i.modelName, i.colorName].filter(Boolean).join(" · ")}</span>
              </span>
              <select className="input h-9 w-20 px-2" value={qty[i.id] ?? 0} onChange={(e) => setQty({ ...qty, [i.id]: Number(e.target.value) })} aria-label="Quantity to return">
                {Array.from({ length: i.qty + 1 }, (_, n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          ))}
        </div>
      </div>
      <div>
        <p className="label">2. What would you like?</p>
        <div className="grid grid-cols-2 gap-2">
          {(["exchange", "refund"] as const).map((r) => (
            <button type="button" key={r} onClick={() => setResolution(r)} className={cn("rounded-2xl border p-3 text-left text-sm", resolution === r ? "border-accent bg-[#f2f4ff]" : "border-black/10 bg-white/80")}>
              <b>{r === "exchange" ? "Exchange" : "Refund"}</b>
              <span className="block text-xs text-muted">{r === "exchange" ? "Different model or colour" : `Get ${money(refund)} back`}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <span className="label">3. Reason</span>
          <select className="input" value={reason} onChange={(e) => setReason(e.target.value)} required>
            <option value="">Choose a reason</option>
            {reasons.map((r) => <option key={r}>{r}</option>)}
          </select>
        </label>
        <label>
          <span className="label">{resolution === "exchange" ? "Exchange for (model / colour)" : "Refund to (JazzCash / Easypaisa / bank)"}</span>
          <input className="input" value={extra} onChange={(e) => setExtra(e.target.value)} placeholder={resolution === "exchange" ? "e.g. iPhone 16 Pro, Midnight" : "e.g. JazzCash 0300 1234567"} />
        </label>
        <label className="sm:col-span-2">
          <span className="label">Details (optional)</span>
          <textarea className="input h-auto py-3" rows={2} value={details} onChange={(e) => setDetails(e.target.value)} />
        </label>
      </div>
      {err && <p className="text-sm text-danger">{err}</p>}
      <button className="btn btn-primary h-11" disabled={busy}>{busy ? "Sending…" : "Submit request"}</button>
    </form>
  );
}
