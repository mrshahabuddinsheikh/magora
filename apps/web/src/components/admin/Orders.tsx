"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Download, ExternalLink, MessageCircle, Printer, RefreshCw, Truck, Zap } from "lucide-react";
import { api, tokenStore } from "@/lib/client-api";
import { PUBLIC_API_URL, SITE_URL } from "@/lib/config";
import { cn, dateTime, money } from "@/lib/format";
import { OrderView } from "../OrderView";
import { RiskBadge } from "./Engage";
import { Empty, ORDER_STATUSES, Pill, SearchBox } from "./ui";
import type { Order } from "@/lib/types";

type Row = { number: string; status: string; paymentMethod: string; paymentStatus: string; customerName: string; customerPhone: string; city: string; total: number; source: string; createdAt: string };

const SHIP_STATUSES: [string, string][] = [
  ["picked_up", "Picked up"],
  ["in_transit", "In transit"],
  ["at_hub", "At hub / warehouse"],
  ["out_for_delivery", "Out for delivery"],
  ["delivered", "Delivered"],
  ["failed_attempt", "Failed attempt"],
  ["returned_to_sender", "Returned to sender"],
];

export async function downloadCsv(params = "") {
  const res = await fetch(`${PUBLIC_API_URL}/admin/orders/export${params}`, { headers: { authorization: `Bearer ${tokenStore.get()}` } });
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function SourceBadge({ source }: { source?: string }) {
  if (!source || source === "web") return <span className="text-muted">Web</span>;
  if (source === "facebook_ad") {
    return <span className="inline-flex items-center rounded bg-blue-100 px-1.5 py-0.5 text-[10.5px] font-bold text-blue-700">Meta FB Ad</span>;
  }
  if (source === "tiktok_ad") {
    return <span className="inline-flex items-center rounded bg-fuchsia-100 px-1.5 py-0.5 text-[10.5px] font-bold text-fuchsia-700">TikTok Ad</span>;
  }
  if (source === "google_ad") {
    return <span className="inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-[10.5px] font-bold text-amber-800">Google Ad</span>;
  }
  return <span className="inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 text-[10.5px] font-semibold text-gray-700">{source}</span>;
}

export function Orders({ initial }: { initial?: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState(initial && !initial.startsWith("#") ? initial : "");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
  const [open, setOpen] = useState<Order | null>(null);
  const [note, setNote] = useState("");

  const load = useCallback(() => {
    const u = new URLSearchParams({ page: String(page) });
    if (status) u.set("status", status);
    if (q) u.set("q", q);
    api<{ data: Row[]; meta: { hasMore: boolean } }>(`/admin/orders?${u}`).then((r) => {
      setRows(r.data);
      setMore(r.meta.hasMore);
    });
  }, [status, q, page]);
  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  const openOrder = useCallback((n: string) => api<{ data: Order }>(`/admin/orders/${n}`).then((r) => setOpen(r.data)), []);
  useEffect(() => {
    if (initial?.startsWith("#")) openOrder(initial.slice(1));
  }, [initial, openOrder]);

  const update = async (s: string) => {
    if (!open) return;
    if ((s === "cancelled" || s === "returned") && !confirm(`Mark ${open.number} as ${s}? Stock will be put back.`)) return;
    const r = await api<{ data: Order }>(`/admin/orders/${open.number}`, { method: "PATCH", json: { status: s, note: note || undefined } });
    setOpen(r.data);
    setNote("");
    load();
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 2xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <div className="card h-fit min-w-0 p-4">
        <div className="flex flex-wrap gap-2">
          <SearchBox value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Order no, name or phone" />
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="chip">
            <option value="">All statuses</option>
            {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
          </select>
          <button className="chip" onClick={load} aria-label="Refresh"><RefreshCw size={14} /></button>
          <button className="chip" onClick={() => downloadCsv(status ? `?status=${status}` : "")}><Download size={14} /> Excel (CSV)</button>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs uppercase text-muted">
              <tr><th className="py-2">Order</th><th>Customer</th><th>City</th><th className="text-right">Total</th><th className="text-right">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((o) => (
                <tr key={o.number} className={cn("cursor-pointer hover:bg-white/70", open?.number === o.number && "bg-white")} onClick={() => openOrder(o.number)}>
                  <td className="py-2.5"><b>{o.number}</b><div className="flex items-center gap-1.5 text-xs text-muted">{dateTime(o.createdAt)} · <SourceBadge source={o.source} /></div></td>
                  <td>{o.customerName}<div className="text-xs text-muted">{o.customerPhone}</div></td>
                  <td>{o.city}</td>
                  <td className="text-right tabular-nums">{money(o.total)}<div className="text-xs uppercase text-muted">{o.paymentMethod} · {o.paymentStatus}</div></td>
                  <td className="text-right"><Pill s={o.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <Empty>No orders</Empty>}
        </div>
        <div className="mt-3 flex items-center justify-between text-sm">
          <button className="chip h-8" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Prev</button>
          <span className="text-muted">Page {page}</span>
          <button className="chip h-8" disabled={!more} onClick={() => setPage((p) => p + 1)}>Next →</button>
        </div>
      </div>

      <div>
        {open ? (
          <div className="space-y-3">
            <div className="card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex flex-wrap items-center gap-1.5 font-bold">
                  {open.number} <Pill s={open.status} /> <SourceBadge source={open.source} /> <RiskBadge risk={(open as { risk?: Parameters<typeof RiskBadge>[0]["risk"] }).risk} />
                </p>
                <div className="flex gap-2">
                  <Link href={`/admin/labels?numbers=${open.number}`} target="_blank" className="chip h-8 text-xs"><Printer size={13} /> Parcel label</Link>
                  <Link href={`/admin/invoice/${open.number}`} target="_blank" className="chip h-8 text-xs"><Printer size={13} /> Invoice / slip</Link>
                  <a
                    href={`https://wa.me/${open.customer.phone.replace("+", "")}?text=${encodeURIComponent(`Assalam o Alaikum ${open.customer.name}! Aapka order ${open.number} (${money(open.totals.total)}) confirm karne ke liye message kar rahe hain.`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="chip h-8 text-xs text-success"
                  >
                    <MessageCircle size={13} /> WhatsApp
                  </a>
                </div>
              </div>
              <p className="mt-3 text-sm font-semibold">Order status</p>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional) — shown to the customer" className="input mt-2 h-10 text-sm" />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {ORDER_STATUSES.map((s) => (
                  <button key={s} onClick={() => update(s)} disabled={s === open.status} className={cn("chip h-8 text-xs capitalize", s === open.status && "!bg-ink !text-white")}>
                    {s.replace(/_/g, " ")}
                  </button>
                ))}
              </div>

              {/* Payment Verification & Status Controls */}
              <div className="mt-4 pt-3 border-t border-line flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-muted">Payment Verification</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={cn(
                      "rounded-full px-2.5 py-0.5 text-xs font-bold",
                      open.paymentStatus === "paid" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                    )}>
                      {open.paymentStatus === "paid" ? "✓ Paid / Verified" : "⚠️ Unverified / Awaiting Bank Receipt"}
                    </span>
                    <span className="text-xs text-muted">({open.paymentMethod})</span>
                  </div>
                </div>
                {open.paymentStatus !== "paid" ? (
                  <button
                    onClick={async () => {
                      await api(`/admin/orders/${open.number}`, { method: "PATCH", json: { paymentStatus: "paid", status: "confirmed", note: "Payment verified by admin" } });
                      openOrder(open.number);
                      load();
                    }}
                    className="chip h-8 text-xs font-bold text-success border-success/40 hover:bg-success/10 flex items-center gap-1"
                  >
                    <Check size={13} /> Verify & Mark as Paid
                  </button>
                ) : (
                  <button
                    onClick={async () => {
                      await api(`/admin/orders/${open.number}`, { method: "PATCH", json: { paymentStatus: "unpaid", note: "Payment status reset to unpaid" } });
                      openOrder(open.number);
                      load();
                    }}
                    className="chip h-8 text-xs text-muted hover:text-danger"
                  >
                    Mark as Unpaid
                  </button>
                )}
              </div>
            </div>
            <ShipmentPanel order={open} onChange={(o) => { setOpen(o); load(); }} />
            <OrderView order={open} admin refresh={() => openOrder(open.number)} />
          </div>
        ) : (
          <div className="card grid h-48 place-items-center text-muted">Select an order</div>
        )}
      </div>
    </div>
  );
}

function ShipmentPanel({ order, onChange }: { order: Order; onChange: (o: Order) => void }) {
  const sh = order.shipment;
  const [couriers, setCouriers] = useState<{ id: string; name: string; apiConnected: boolean }[]>([]);
  const [form, setForm] = useState({ courier: sh?.courier ?? "postex", trackingNumber: sh?.trackingNumber ?? "", riderName: sh?.rider?.name ?? "", riderPhone: sh?.rider?.phone ?? "", etaAt: sh?.eta ? sh.eta.slice(0, 16) : "" });
  const [ev, setEv] = useState({ status: "in_transit", location: "", note: "" });
  const [err, setErr] = useState<string | null>(null);
  const [bookingLoading, setBookingLoading] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api<{ data: typeof couriers }>("/couriers", { auth: false }).then((r) => setCouriers(r.data));
  }, []);
  useEffect(() => {
    queueMicrotask(() => {
      setForm({ courier: sh?.courier ?? "postex", trackingNumber: sh?.trackingNumber ?? "", riderName: sh?.rider?.name ?? "", riderPhone: sh?.rider?.phone ?? "", etaAt: sh?.eta ? toLocalInput(sh.eta) : "" });
    });
  }, [order.number, sh?.courier, sh?.trackingNumber, sh?.rider?.name, sh?.rider?.phone, sh?.eta]);

  const run = async (fn: () => Promise<{ data: Order }>) => {
    setErr(null);
    try {
      onChange((await fn()).data);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const handle1ClickBook = async (courierId: string) => {
    setErr(null);
    setBookingLoading(courierId);
    try {
      const res = await api<{ data: Order; booking: { trackingNumber: string; trackingUrl: string } }>(
        `/admin/orders/${order.number}/book-courier`,
        {
          method: "POST",
          json: { courier: courierId },
        },
      );
      if (res?.data) {
        onChange(res.data);
      }
    } catch (e: any) {
      setErr(e.message || "Failed to book courier");
    } finally {
      setBookingLoading(null);
    }
  };

  if (["cancelled", "returned"].includes(order.status) && !sh) return null;
  const riderLink = sh?.riderToken ? `${SITE_URL}/rider/${sh.riderToken}` : null;
  const customerWa = order.customer.phone.replace(/^0/, "92").replace(/\D/g, "");
  const trackingLink = sh?.trackingNumber
    ? sh.courier === "postex"
      ? `https://postex.pk/tracking?cn=${sh.trackingNumber}`
      : sh.courier === "trax"
      ? `https://trax.pk/tracking/?tracking_number=${sh.trackingNumber}`
      : sh.courier === "leopards"
      ? `https://www.leopardscourier.com/tracking?cn=${sh.trackingNumber}`
      : sh.courier === "tcs"
      ? `https://www.tcsexpress.com/track/${sh.trackingNumber}`
      : null
    : null;

  return (
    <div className="card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 font-bold text-ink">
          <Truck size={17} className="text-accent" /> Shipping & Courier Automation
        </p>
        {sh?.trackingNumber && (
          <span className="rounded-full bg-success/10 text-success px-2.5 py-0.5 text-xs font-bold flex items-center gap-1">
            ✓ Booked ({sh.courier.toUpperCase()})
          </span>
        )}
      </div>

      {/* ── 1-Click Fast Courier Booking Buttons ── */}
      <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] p-3">
        <div className="flex items-center gap-1.5 text-xs font-bold text-ink mb-2">
          <Zap size={14} className="text-amber-500 fill-amber-500" />
          <span>1-Click Fast Courier Booking:</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            type="button"
            disabled={!!bookingLoading}
            onClick={() => handle1ClickBook("postex")}
            className="btn btn-secondary h-9 text-xs font-bold hover:border-[#1e3a8a] hover:text-[#1e3a8a]"
          >
            {bookingLoading === "postex" ? "Booking..." : "⚡ Book PostEx"}
          </button>
          <button
            type="button"
            disabled={!!bookingLoading}
            onClick={() => handle1ClickBook("trax")}
            className="btn btn-secondary h-9 text-xs font-bold hover:border-[#b91c1c] hover:text-[#b91c1c]"
          >
            {bookingLoading === "trax" ? "Booking..." : "⚡ Book Trax"}
          </button>
          <button
            type="button"
            disabled={!!bookingLoading}
            onClick={() => handle1ClickBook("leopards")}
            className="btn btn-secondary h-9 text-xs font-bold hover:border-[#c2410c] hover:text-[#c2410c]"
          >
            {bookingLoading === "leopards" ? "Booking..." : "⚡ Book Leopards"}
          </button>
          <button
            type="button"
            disabled={!!bookingLoading}
            onClick={() => handle1ClickBook("tcs")}
            className="btn btn-secondary h-9 text-xs font-bold hover:border-[#dc2626] hover:text-[#dc2626]"
          >
            {bookingLoading === "tcs" ? "Booking..." : "⚡ Book TCS"}
          </button>
        </div>
      </div>

      {/* ── Active Tracking & Dispatch Tools ── */}
      {sh?.trackingNumber && (
        <div className="rounded-2xl border border-accent/20 bg-accent/5 p-3.5 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted block">Tracking CN</span>
              <span className="font-mono text-base font-bold text-ink">{sh.trackingNumber}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {trackingLink && (
                <a
                  href={trackingLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-glass h-8 px-2.5 text-xs font-semibold flex items-center gap-1"
                >
                  <ExternalLink size={12} /> Track Online
                </a>
              )}
              <Link
                href={`/admin/labels?numbers=${order.number}`}
                target="_blank"
                className="btn btn-dark h-8 px-3 text-xs font-bold flex items-center gap-1 shadow-sm"
              >
                <Printer size={13} /> Print Airway Bill (4x6)
              </Link>
            </div>
          </div>

          <div className="pt-2 border-t border-accent/15 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-muted">Customer ko WhatsApp par live tracking link bhejein:</span>
            <a
              target="_blank"
              rel="noopener noreferrer"
              href={`https://wa.me/${customerWa}?text=${encodeURIComponent(
                `Assalam o Alaikum ${order.customer.name}!\n\nAap ka Magora Order #${order.number} courier (${sh.courier.toUpperCase()}) ke zariye dispatch ho chuka hai.\n\n📦 Tracking CN: ${sh.trackingNumber}\n🔗 Live Tracking: ${trackingLink || `${SITE_URL}/track`}\n💰 COD Amount: Rs. ${order.totals.total}\n\nJald aap tak parcel pahunch jaye ga! Shukriya.`
              )}`}
              className="btn btn-secondary h-8 px-3 text-xs font-bold text-[#25D366] hover:bg-[#25D366]/10 flex items-center gap-1"
            >
              <MessageCircle size={13} /> Send WhatsApp Tracking
            </a>
          </div>
        </div>
      )}

      {/* ── Manual Courier Configuration ── */}
      <div className="pt-2 border-t border-line">
        <span className="text-xs font-bold text-muted uppercase tracking-wider">Manual Shipment Details:</span>
        <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
          <label className="text-xs">
            <span className="label">Courier</span>
            <select className="input h-10 text-sm" value={form.courier} onChange={(e) => setForm({ ...form, courier: e.target.value })}>
              {couriers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.apiConnected ? " · API" : ""}</option>)}
            </select>
          </label>
          <label className="text-xs">
            <span className="label">Tracking / CN number</span>
            <input className="input h-10 text-sm" value={form.trackingNumber} onChange={(e) => setForm({ ...form, trackingNumber: e.target.value })} placeholder={form.courier === "own" ? "optional" : "e.g. 7720123456"} />
          </label>
          <label className="text-xs">
            <span className="label">Rider name</span>
            <input className="input h-10 text-sm" value={form.riderName} onChange={(e) => setForm({ ...form, riderName: e.target.value })} />
          </label>
          <label className="text-xs">
            <span className="label">Rider mobile</span>
            <input className="input h-10 text-sm" value={form.riderPhone} onChange={(e) => setForm({ ...form, riderPhone: e.target.value })} inputMode="tel" />
          </label>
          <label className="text-xs sm:col-span-2">
            <span className="label">Expected delivery (ETA)</span>
            <input type="datetime-local" className="input h-10 text-sm" value={form.etaAt} onChange={(e) => setForm({ ...form, etaAt: e.target.value })} />
          </label>
        </div>
        <button
          className="btn btn-secondary mt-3 h-9 text-xs font-bold"
          onClick={() => run(() => api(`/admin/orders/${order.number}/shipment`, { method: "PUT", json: { ...form, etaAt: form.etaAt ? new Date(form.etaAt).toISOString() : null } }))}
        >
          {sh ? "Update shipment details" : "Save shipment"}
        </button>
      </div>

      {sh && (
        <div className="pt-2 border-t border-line space-y-3">
          {riderLink && (
            <div className="rounded-2xl bg-black/[0.03] p-3 text-sm">
              <p className="font-semibold">Rider link (live GPS)</p>
              <p className="text-xs text-muted">Send this to the rider — they open it on their phone, tap “Start delivery” and the customer sees them on the map.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button className="chip h-8 text-xs" onClick={async () => { await navigator.clipboard.writeText(riderLink); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
                  <Copy size={13} /> {copied ? "Copied!" : "Copy link"}
                </button>
                {form.riderPhone && (
                  <a className="chip h-8 text-xs text-success" target="_blank" rel="noopener noreferrer" href={`https://wa.me/${form.riderPhone.replace(/^0/, "92").replace(/\D/g, "")}?text=${encodeURIComponent(`Delivery ${order.number} — ${order.customer.name}, ${order.address.city}. Open: ${riderLink}`)}`}>
                    <MessageCircle size={13} /> Send to rider
                  </a>
                )}
                <a className="chip h-8 text-xs" href={riderLink} target="_blank" rel="noopener noreferrer">Open</a>
              </div>
            </div>
          )}
          <p className="text-sm font-semibold">Add tracking update</p>
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr]">
            <select className="input h-10 text-sm" value={ev.status} onChange={(e) => setEv({ ...ev, status: e.target.value })}>
              {SHIP_STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <input className="input h-10 text-sm" value={ev.location} onChange={(e) => setEv({ ...ev, location: e.target.value })} placeholder="Location e.g. Lahore hub" />
            <input className="input h-10 text-sm sm:col-span-2" value={ev.note} onChange={(e) => setEv({ ...ev, note: e.target.value })} placeholder="Note (optional)" />
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-dark h-9 text-xs font-bold" onClick={() => run(() => api(`/admin/orders/${order.number}/shipment/events`, { method: "POST", json: { ...ev, location: ev.location || undefined, note: ev.note || undefined } }))}>
              Add update
            </button>
            {sh.trackingNumber && sh.courier !== "own" && (
              <button className="btn btn-glass h-9 text-xs font-bold" onClick={() => run(() => api(`/admin/orders/${order.number}/shipment/sync`, { method: "POST" }))}>
                <RefreshCw size={13} /> Sync from courier
              </button>
            )}
          </div>
        </div>
      )}
      {err && <p className="mt-2 text-sm text-danger font-medium">{err}</p>}
    </div>
  );
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
