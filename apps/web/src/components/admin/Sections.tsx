"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bike, Check, Plus, RefreshCw, Smartphone, Star, Trash2, Upload, X } from "lucide-react";
import { Stars } from "@/components/ui/Stars";
import { api } from "@/lib/client-api";
import { cn, dateTime, materialLabel, money } from "@/lib/format";
import { Empty, InlineNum, Pill, SearchBox } from "./ui";
import type { ProductView, ReturnRequest } from "@/lib/types";
import { cardPhoto, designFor, viewOf } from "@/lib/view";
import { CATEGORIES } from "@/lib/categories";
import { ProductThumb } from "../CaseThumb";
import { ProductEditor } from "./ProductEditor";

const LiveMap = dynamic(() => import("../LiveMap").then((m) => m.LiveMap), { ssr: false, loading: () => <div className="skeleton h-[420px] rounded-[20px]" /> });

/* ───────────── Live deliveries ───────────── */
type Delivery = { number: string; customerName: string; city: string; total: number; status: string; statusLabel: string; riderName: string | null; riderPhone: string | null; lat: number | null; lng: number | null; lastLocationAt: string | null; courier: string; etaAt: string | null };

export function Deliveries({ openOrder }: { openOrder: (n: string) => void }) {
  const [rows, setRows] = useState<Delivery[]>([]);
  const load = useCallback(() => api<{ data: Delivery[] }>("/admin/deliveries/live").then((r) => setRows(r.data)), []);
  useEffect(() => {
    load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [load]);
  const points = useMemo(
    () => rows.filter((r) => r.lat != null && r.lng != null).map((r) => ({ lat: r.lat!, lng: r.lng!, label: `${r.number} · ${r.riderName ?? "Rider"}`, kind: "rider" as const })),
    [rows],
  );
  return (
    <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
      <div className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold">Riders on the map</h2>
          <span className="text-xs text-muted">auto-refreshes every 15 s</span>
        </div>
        <LiveMap points={points} height={460} />
        {points.length === 0 && <p className="mt-2 text-sm text-muted">No rider is sharing location right now. Riders appear here after they tap “Start delivery” on their link.</p>}
      </div>
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">Active shipments ({rows.length})</h2>
          <button className="chip h-8" onClick={load}><RefreshCw size={13} /></button>
        </div>
        <ul className="mt-3 divide-y divide-line">
          {rows.map((r) => (
            <li key={r.number} className="cursor-pointer py-3 hover:bg-white/60" onClick={() => openOrder(r.number)}>
              <div className="flex items-center justify-between">
                <b>{r.number}</b>
                <Pill s={r.status === "out_for_delivery" ? "out_for_delivery" : "shipped"} label={r.statusLabel} />
              </div>
              <p className="text-sm text-muted">{r.customerName} · {r.city} · {money(r.total)}</p>
              <p className="flex items-center gap-1 text-xs text-muted">
                <Bike size={12} /> {r.riderName ?? r.courier} {r.lastLocationAt && `· GPS ${dateTime(r.lastLocationAt)}`} {r.etaAt && `· ETA ${dateTime(r.etaAt)}`}
              </p>
            </li>
          ))}
          {rows.length === 0 && <Empty>No shipments on the road</Empty>}
        </ul>
      </div>
    </div>
  );
}

/* ───────────── Returns ───────────── */
const RETURN_STEPS = ["requested", "approved", "pickup_scheduled", "received", "refunded", "exchanged", "rejected", "closed"];

export function Returns() {
  const [rows, setRows] = useState<(ReturnRequest & { customerName: string; customerPhone: string; city: string })[]>([]);
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState<ReturnRequest | null>(null);
  const [note, setNote] = useState("");
  const load = useCallback(() => api<{ data: typeof rows }>(`/admin/returns${status ? `?status=${status}` : ""}`).then((r) => setRows(r.data)), [status]);
  useEffect(() => {
    let alive = true;
    api<{ data: (ReturnRequest & { customerName: string; customerPhone: string; city: string })[] }>(`/admin/returns${status ? `?status=${status}` : ""}`)
      .then((r) => {
        if (alive) setRows(r.data);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [status]);
  const openRet = (n: string) => api<{ data: ReturnRequest }>(`/admin/returns/${n}`).then((r) => setOpen(r.data));
  const patch = async (body: Record<string, unknown>) => {
    if (!open) return;
    const r = await api<{ data: ReturnRequest }>(`/admin/returns/${open.number}`, { method: "PATCH", json: body });
    setOpen(r.data);
    setNote("");
    load();
  };
  return (
    <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
      <div className="card h-fit p-4">
        <div className="flex flex-wrap gap-2">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="chip">
            <option value="">All returns</option>
            {RETURN_STEPS.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
          </select>
        </div>
        <table className="mt-3 w-full text-sm">
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.number} className={cn("cursor-pointer hover:bg-white/70", open?.number === r.number && "bg-white")} onClick={() => openRet(r.number)}>
                <td className="py-2.5"><b>{r.number}</b><div className="text-xs text-muted">{r.orderNumber} · {dateTime(r.createdAt)}</div></td>
                <td>{r.customerName}<div className="text-xs text-muted">{r.customerPhone}</div></td>
                <td className="capitalize">{r.resolution}<div className="text-xs text-muted">{r.reason}</div></td>
                <td className="text-right"><Pill s={r.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <Empty>No return requests</Empty>}
      </div>
      {open ? (
        <div className="card space-y-3 p-5">
          <div className="flex items-center justify-between">
            <p className="text-lg font-bold">{open.number}</p>
            <Pill s={open.status} label={open.statusLabel} />
          </div>
          <p className="text-sm">Order <b>{open.orderNumber}</b> · {open.customer?.name} · {open.customer?.phone} · {open.customer?.city}</p>
          <p className="text-sm text-muted">{open.customer?.address}</p>
          <div className="rounded-2xl bg-black/[0.03] p-3 text-sm">
            <p><b className="capitalize">{open.resolution}</b> — {open.reason}</p>
            {open.details && <p className="mt-1 text-muted">{open.details}</p>}
            {open.exchangeNote && <p className="mt-1">Wants: <b>{open.exchangeNote}</b></p>}
            {open.refundMethod && <p className="mt-1">Refund to: <b>{open.refundMethod}</b></p>}
            <ul className="mt-2 space-y-1">
              {open.items.map((i) => (
                <li key={i.orderItemId} className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded" style={{ background: i.colorHex }} /> {i.qty}× {i.productName} — {[i.modelName, i.colorName].filter(Boolean).join(", ")}
                </li>
              ))}
            </ul>
          </div>
          {open.resolution === "refund" && (
            <label className="flex items-center gap-2 text-sm">Refund amount <InlineNum value={open.refundAmount} onSave={(v) => patch({ refundAmount: v })} width="w-28" /></label>
          )}
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Message for the customer (optional)" className="input h-10 text-sm" />
          <div className="flex flex-wrap gap-1.5">
            {RETURN_STEPS.filter((s) => s !== "requested").map((s) => (
              <button key={s} disabled={s === open.status} onClick={() => patch({ status: s, note: note || undefined, adminNote: note || undefined })} className={cn("chip h-8 text-xs capitalize", s === open.status && "!bg-ink !text-white")}>
                {s.replace(/_/g, " ")}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted">“Received” puts the items back in stock. “Refunded” marks the order’s payment as refunded.</p>
          <ol className="space-y-1 border-t border-line pt-3 text-xs text-muted">
            {open.timeline.map((t, i) => <li key={i}>✓ {t.label}{t.note ? ` — ${t.note}` : ""} · {dateTime(t.at)}</li>)}
          </ol>
        </div>
      ) : (
        <div className="card grid h-48 place-items-center text-muted">Select a return</div>
      )}
    </div>
  );
}

/* ───────────── Customers ───────────── */
type Cust = { phone: string; name: string; email: string | null; city: string; orders: number; spent: number; cancelled: number; registered: boolean; lastOrderAt: string };

/** Customer forgot their password → temporary password the admin sends on WhatsApp */
function ResetPassword({ email, phone, name }: { email: string; phone: string; name: string }) {
  const [temp, setTemp] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    queueMicrotask(() => setTemp(null));
  }, [email]);
  const msg = (p: string) =>
    `Assalam o Alaikum ${name.split(" ")[0]}! Aap ke account (${email}) ka naya temporary password: ${p}\nIs se login karein, phir "My account" mein apna password badal lein.`;
  return temp ? (
    <div className="mt-3 rounded-2xl bg-[#eef1ff] p-3 text-sm">
      <p>Temporary password: <b className="font-mono text-[15px]">{temp}</b></p>
      <a href={`https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(msg(temp))}`} target="_blank" rel="noopener noreferrer" className="chip mt-2 h-8 text-xs text-success">
        Send on WhatsApp
      </a>
    </div>
  ) : (
    <button
      disabled={busy}
      className="chip mt-3 h-8 text-xs"
      onClick={async () => {
        if (!confirm(`Give ${email} a new temporary password? Their old password will stop working.`)) return;
        setBusy(true);
        try {
          const r = await api<{ data: { tempPassword: string } }>("/admin/accounts/reset-password", { method: "POST", json: { email } });
          setTemp(r.data.tempPassword);
        } finally {
          setBusy(false);
        }
      }}
    >
      Reset password
    </button>
  );
}

export function Customers({ openOrder }: { openOrder: (n: string) => void }) {
  const [rows, setRows] = useState<Cust[]>([]);
  const [meta, setMeta] = useState<{ registeredAccounts: number } | null>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<{ phone: string; name: string; email: string | null; addresses: string[]; account: { name: string; email: string; createdAt: string } | null; orders: { number: string; status: string; total: number; createdAt: string }[] } | null>(null);
  useEffect(() => {
    const t = setTimeout(() => api<{ data: Cust[]; meta: { registeredAccounts: number } }>(`/admin/customers?q=${encodeURIComponent(q)}`).then((r) => { setRows(r.data); setMeta(r.meta); }), 200);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
      <div className="card h-fit p-4">
        <div className="flex flex-wrap items-center gap-2">
          <SearchBox value={q} onChange={setQ} placeholder="Name, phone or email" />
          {meta && <span className="text-sm text-muted">{meta.registeredAccounts} registered accounts</span>}
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="text-left text-xs uppercase text-muted"><tr><th className="py-2">Customer</th><th>City</th><th className="text-right">Orders</th><th className="text-right">Spent</th><th>Last order</th></tr></thead>
            <tbody className="divide-y divide-line">
              {rows.map((c) => (
                <tr key={c.phone} className="cursor-pointer hover:bg-white/70" onClick={() => api<{ data: NonNullable<typeof open> }>(`/admin/customers/${encodeURIComponent(c.phone)}`).then((r) => setOpen(r.data))}>
                  <td className="py-2.5"><b>{c.name}</b> {c.registered && <span className="ml-1 rounded-full bg-[#eef1ff] px-1.5 text-[10px] font-bold text-accent">ACCOUNT</span>}<div className="text-xs text-muted">{c.phone}{c.email ? ` · ${c.email}` : ""}</div></td>
                  <td>{c.city}</td>
                  <td className="text-right tabular-nums">{c.orders}{c.cancelled > 0 && <span className="text-xs text-danger"> ({c.cancelled}✕)</span>}</td>
                  <td className="text-right tabular-nums">{money(c.spent)}</td>
                  <td className="text-xs text-muted">{dateTime(c.lastOrderAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <Empty>No customers yet</Empty>}
        </div>
      </div>
      {open ? (
        <div className="card h-fit p-5">
          <p className="text-lg font-bold">{open.name}</p>
          <p className="text-sm text-muted">{open.phone}{open.email ? ` · ${open.email}` : ""}</p>
          {open.account ? <p className="mt-1 text-xs text-accent">Has an account since {dateTime(open.account.createdAt)}</p> : <p className="mt-1 text-xs text-muted">Guest customer</p>}
          {open.account && <ResetPassword email={open.account.email} phone={open.phone} name={open.name} />}
          <p className="mt-3 text-sm font-semibold">Addresses</p>
          <ul className="text-sm text-muted">{open.addresses.map((a) => <li key={a}>• {a}</li>)}</ul>
          <p className="mt-3 text-sm font-semibold">Orders</p>
          <ul className="mt-1 divide-y divide-line text-sm">
            {open.orders.map((o) => (
              <li key={o.number} className="flex cursor-pointer items-center justify-between py-2 hover:bg-white/60" onClick={() => openOrder(o.number)}>
                <span><b>{o.number}</b> <span className="text-xs text-muted">{dateTime(o.createdAt)}</span></span>
                <span className="flex items-center gap-2">{money(o.total)} <Pill s={o.status} /></span>
              </li>
            ))}
          </ul>
          <a className="btn btn-glass mt-4 h-10 text-sm text-success" target="_blank" rel="noopener noreferrer" href={`https://wa.me/${open.phone.replace("+", "")}`}>WhatsApp customer</a>
        </div>
      ) : (
        <div className="card grid h-48 place-items-center text-muted">Select a customer</div>
      )}
    </div>
  );
}

/* ───────────── Products ───────────── */
type P = {
  id: number; slug: string; name: string; material: string; category?: string; categorySlug?: string; section?: string; images?: string[]; firstColor?: string;
  firstDesign?: string | null; view?: ProductView;
  basePrice: number; compareAtPrice: number | null; badge: string | null; featured: boolean; active: boolean; soldCount: number; stock: number; variantCount: number;
};
type V = { id: number; sku: string; price: number; stock: number; active: boolean; model: string; color: string; colorHex: string };

const PRODUCT_TABS: [string, string][] = [
  ["", "All"],
  ["magsafe-cases", "Cases"],
  ["skins", "Skins"],
  ["screen-protectors", "Protectors"],
  ["gadgets", "Gadgets"],
];

export function Products() {
  const [rows, setRows] = useState<P[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [status, setStatus] = useState("");
  const [variants, setVariants] = useState<{ pid: number; name: string; list: V[] } | null>(null);
  const [vq, setVq] = useState("");
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(() => {
    const u = new URLSearchParams();
    if (q) u.set("q", q);
    if (cat) u.set("category", cat);
    if (status) u.set("status", status);
    return api<{ data: P[]; meta: { total: number } }>(`/admin/products?${u}`).then((r) => {
      setRows(r.data);
      setTotal(r.meta.total);
    });
  }, [q, cat, status]);
  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const patch = async (id: number, body: Partial<P>) => {
    await api(`/admin/products/${id}`, { method: "PATCH", json: body });
    load();
  };
  const duplicate = async (p: P) => {
    const r = await api<{ data: { id: number } }>(`/admin/products/${p.id}/duplicate`, { method: "POST" });
    await load();
    setToast(`Copied “${p.name}” — it's hidden until you switch it on`);
    setEditing(r.data.id);
  };
  const openVariants = (p: { id: number; name: string }) => api<{ data: V[] }>(`/admin/products/${p.id}/variants`).then((r) => setVariants({ pid: p.id, name: p.name, list: r.data }));
  const patchVariant = async (id: number, body: Partial<V>) => {
    await api(`/admin/variants/${id}`, { method: "PATCH", json: body });
    if (variants) openVariants({ id: variants.pid, name: variants.name });
  };
  const bulkStock = async (n: number) => {
    if (!variants || !confirm(`Set stock to ${n} for all ${filtered.length} options shown?`)) return;
    for (const v of filtered) await api(`/admin/variants/${v.id}`, { method: "PATCH", json: { stock: n } });
    openVariants({ id: variants.pid, name: variants.name });
  };
  const filtered = (variants?.list ?? []).filter((v) => `${v.model} ${v.color}`.toLowerCase().includes(vq.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-full bg-black/[0.04] p-1" role="tablist" aria-label="Category">
            {PRODUCT_TABS.map(([v, l]) => (
              <button key={v} role="tab" aria-selected={cat === v} onClick={() => setCat(v)} className={cn("h-8 rounded-full px-3.5 text-[13px] font-semibold transition", cat === v ? "bg-white shadow-sm" : "text-ink/60 hover:text-ink")}>
                {l}
              </button>
            ))}
          </div>
          {cat === "gadgets" || CATEGORIES[3].styles.some((s) => s.cat === cat) ? (
            <select value={cat} onChange={(e) => setCat(e.target.value)} className="h-10 rounded-full bg-black/[0.04] px-3 text-sm outline-none" aria-label="Gadget type">
              <option value="gadgets">All gadget types</option>
              {CATEGORIES[3].styles.map((s) => <option key={s.cat} value={s.cat}>{s.name}</option>)}
            </select>
          ) : null}
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 rounded-full bg-black/[0.04] px-3 text-sm outline-none" aria-label="Status">
            <option value="">Live + hidden</option>
            <option value="live">Live only</option>
            <option value="hidden">Hidden only</option>
            <option value="low">Low stock</option>
          </select>
          <SearchBox value={q} onChange={setQ} placeholder="Search products" />
          <button className="btn btn-primary h-10 text-sm" onClick={() => setEditing("new")}><Plus size={15} /> New product</button>
        </div>
        <p className="mt-2 text-xs text-muted">{total} product{total === 1 ? "" : "s"}</p>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="text-left text-xs uppercase text-muted">
              <tr><th className="py-2">Product</th><th>Price</th><th>Compare at</th><th>Stock</th><th>Sold</th><th>Featured</th><th>Live</th><th /></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((p) => (
                <tr key={p.id} className={cn(!p.active && "opacity-60")}>
                  <td className="py-2.5">
                    <button onClick={() => setEditing(p.id)} className="flex items-center gap-3 text-left">
                      <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-[#f1f2f6]">
                        {cardPhoto(p.images, viewOf(p.view)) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={cardPhoto(p.images, viewOf(p.view))!} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <ProductThumb material={p.material} color={p.firstColor ?? "#ccc"} design={designFor(viewOf(p.view), { designUrl: p.firstDesign })} className="h-10 w-auto" />
                        )}
                      </span>
                      <span>
                        <b className="block hover:text-accent">{p.name}</b>
                        <span className="text-xs text-muted">{p.category} · {materialLabel[p.material] ?? p.material} · {p.variantCount} variants{p.badge ? ` · ${p.badge}` : ""}</span>
                      </span>
                    </button>
                  </td>
                  <td><InlineNum value={p.basePrice} onSave={(v) => patch(p.id, { basePrice: v })} /></td>
                  <td><InlineNum value={p.compareAtPrice ?? 0} onSave={(v) => patch(p.id, { compareAtPrice: v || null })} /></td>
                  <td className={cn("tabular-nums", p.stock < 20 && "font-semibold text-danger")}>{p.stock}</td>
                  <td className="tabular-nums">{p.soldCount}</td>
                  <td><input type="checkbox" checked={p.featured} onChange={(e) => patch(p.id, { featured: e.target.checked })} aria-label="Featured" /></td>
                  <td><input type="checkbox" checked={p.active} onChange={(e) => patch(p.id, { active: e.target.checked })} aria-label="Live" /></td>
                  <td className="whitespace-nowrap text-right">
                    <button className="chip h-8 bg-ink text-xs text-white" onClick={() => setEditing(p.id)}>Edit</button>{" "}
                    <button className="chip h-8 text-xs" onClick={() => openVariants(p)}>Stock & prices</button>{" "}
                    <button className="chip h-8 text-xs" onClick={() => duplicate(p)} title="Make a copy to create a similar product fast">Duplicate</button>{" "}
                    <button
                      className="chip h-8 text-xs text-danger hover:bg-rose-50"
                      onClick={async () => {
                        if (!confirm(`Are you sure you want to delete "${p.name}"? This will delete all its variants.`)) return;
                        try {
                          await api(`/admin/products/${p.id}`, { method: "DELETE" });
                          load();
                          setToast(`Deleted "${p.name}"`);
                        } catch (e) {
                          alert((e as Error).message);
                        }
                      }}
                      title="Delete product"
                    >
                      Delete
                    </button>{" "}
                    <a className="chip h-8 text-xs" href={`/product/${p.slug}`} target="_blank" rel="noreferrer">View</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <Empty>No products here yet — click “New product”.</Empty>}
        </div>
      </div>
      {variants && (
        <div className="card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-bold">{variants.name} — stock & price per phone × option</h3>
            <div className="flex gap-2">
              <input value={vq} onChange={(e) => setVq(e.target.value)} placeholder="Filter e.g. 16 pro" className="h-9 w-44 rounded-full bg-black/[0.04] px-3 text-sm outline-none" />
              <button className="chip h-9 text-xs" onClick={() => { const n = Number(prompt("Set stock for all shown options to:", "20")); if (Number.isFinite(n)) bulkStock(n); }}>Bulk stock</button>
              <button className="chip h-9 text-xs" onClick={() => setVariants(null)}>Close</button>
            </div>
          </div>
          <div className="mt-3 max-h-[480px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white text-left text-xs uppercase text-muted"><tr><th className="py-2">Phone</th><th>Option</th><th>SKU</th><th>Price</th><th>Stock</th><th>On sale</th></tr></thead>
              <tbody className="divide-y divide-line">
                {filtered.map((v) => (
                  <tr key={v.id}>
                    <td className="py-2">{v.model}</td>
                    <td><span className="mr-1.5 inline-block h-3 w-3 rounded-full align-middle" style={{ background: v.colorHex }} />{v.color}</td>
                    <td className="text-xs text-muted">{v.sku}</td>
                    <td><InlineNum value={v.price} onSave={(x) => patchVariant(v.id, { price: x })} /></td>
                    <td><InlineNum value={v.stock} onSave={(x) => patchVariant(v.id, { stock: x })} /></td>
                    <td><input type="checkbox" checked={v.active} onChange={(e) => patchVariant(v.id, { active: e.target.checked })} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {editing !== null && (
        <ProductEditor
          key={String(editing)}
          productId={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={(msg) => {
            setEditing(null);
            setToast(msg);
            load();
          }}
        />
      )}
      {toast && (
        <div className="fixed bottom-5 left-1/2 z-[80] -translate-x-1/2 rounded-full bg-ink px-5 py-3 text-sm font-medium text-white shadow-xl" role="status">
          ✓ {toast}
        </div>
      )}
    </div>
  );
}

/* ───────────── Coupons ───────────── */
type Coupon = { code: string; type: string; value: number; minSubtotal: number; maxDiscount: number | null; usageLimit: number | null; usedCount: number; expiresAt: string | null; active: boolean };

export function Coupons() {
  const [rows, setRows] = useState<Coupon[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const load = () => api<{ data: Coupon[] }>("/admin/coupons").then((r) => setRows(r.data));
  useEffect(() => {
    load();
  }, []);
  return (
    <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
      <div className="card p-4">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted"><tr><th className="py-2">Code</th><th>Discount</th><th>Min order</th><th>Used</th><th>Expires</th><th>Active</th></tr></thead>
          <tbody className="divide-y divide-line">
            {rows.map((c) => (
              <tr key={c.code}>
                <td className="py-2.5 font-mono font-bold">{c.code}</td>
                <td>{c.type === "percent" ? `${c.value}%${c.maxDiscount ? ` (max ${money(c.maxDiscount)})` : ""}` : c.type === "fixed" ? money(c.value) : "Free delivery"}</td>
                <td>{c.minSubtotal ? money(c.minSubtotal) : "—"}</td>
                <td>{c.usedCount}{c.usageLimit ? ` / ${c.usageLimit}` : ""}</td>
                <td className="text-xs">{c.expiresAt ? dateTime(c.expiresAt) : "—"}</td>
                <td><input type="checkbox" checked={c.active} onChange={async (e) => { await api(`/admin/coupons/${c.code}`, { method: "PATCH", json: { active: e.target.checked } }); load(); }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form
        className="card grid h-fit gap-3 p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
          try {
            await api("/admin/coupons", {
              method: "POST",
              json: {
                code: f.code, type: f.type, value: Number(f.value || 0), minSubtotal: Number(f.minSubtotal || 0),
                ...(f.maxDiscount ? { maxDiscount: Number(f.maxDiscount) } : {}), ...(f.usageLimit ? { usageLimit: Number(f.usageLimit) } : {}),
                ...(f.expiresAt ? { expiresAt: new Date(f.expiresAt).toISOString() } : {}), active: true,
              },
            });
            (e.target as HTMLFormElement).reset();
            setErr(null);
            load();
          } catch (e) {
            setErr((e as Error).message);
          }
        }}
      >
        <h3 className="font-bold">New coupon</h3>
        <input name="code" required placeholder="CODE e.g. EID20" className="input uppercase" />
        <select name="type" className="input"><option value="percent">% off</option><option value="fixed">Fixed Rs. off</option><option value="free_shipping">Free delivery</option></select>
        <div className="grid grid-cols-2 gap-2">
          <input name="value" type="number" placeholder="Value (20 or 300)" className="input" />
          <input name="minSubtotal" type="number" placeholder="Min order Rs." className="input" />
          <input name="maxDiscount" type="number" placeholder="Max discount Rs." className="input" />
          <input name="usageLimit" type="number" placeholder="Usage limit" className="input" />
        </div>
        <label><span className="label">Expires (optional)</span><input name="expiresAt" type="datetime-local" className="input" /></label>
        {err && <p className="text-sm text-danger">{err}</p>}
        <button className="btn btn-primary h-11">Create coupon</button>
      </form>
    </div>
  );
}

/* ───────────── Phone models & 3D Flagship Manager ───────────── */
type M = {
  id: number;
  slug: string;
  name: string;
  year: number;
  brand: string;
  aliases: string;
  priceAdjust: number;
  popular: boolean;
  isHero: boolean;
  model3dUrl?: string | null;
  active: boolean;
  heightMm: number;
  widthMm: number;
  depthMm: number;
  cornerRadiusMm?: number;
  bodyHex?: string;
};

const CAMERA_PRESETS: Record<string, { label: string; spec: object; r: number }> = {
  samsung_ultra: {
    label: "Samsung Galaxy Ultra (Floating 5-Lens Array)",
    r: 4.2,
    spec: {
      type: "floating",
      rise: 1.4,
      lenses: [
        { x: 18, y: 20, d: 12 },
        { x: 18, y: 36, d: 12 },
        { x: 18, y: 52, d: 12 },
        { x: 33, y: 28, d: 7, kind: "sensor" },
        { x: 33, y: 42, d: 6, kind: "flash" },
      ],
    },
  },
  iphone_pro_bar: {
    label: "iPhone Pro Bar (Cross-Width Horizontal Bump)",
    r: 12.5,
    spec: {
      type: "bar",
      x: 0,
      y: 14,
      w: 78,
      h: 32,
      r: 12,
      rise: 1.5,
      lenses: [
        { x: 17, y: 30, d: 13 },
        { x: 39, y: 30, d: 13 },
        { x: 61, y: 30, d: 13 },
        { x: 49, y: 21, d: 5.5, kind: "flash" },
      ],
    },
  },
  iphone_plateau: {
    label: "iPhone Classic (Square Rounded Island)",
    r: 10.0,
    spec: {
      type: "plateau",
      x: 6,
      y: 8,
      w: 38,
      h: 40,
      r: 9,
      rise: 1.8,
      lenses: [
        { x: 16, y: 18, d: 12 },
        { x: 16, y: 38, d: 12 },
        { x: 33, y: 28, d: 12 },
        { x: 33, y: 16, d: 6, kind: "flash" },
      ],
    },
  },
  google_pixel: {
    label: "Google Pixel Visor (Edge-to-Edge Visor Bar)",
    r: 11.5,
    spec: {
      type: "bar",
      x: 0,
      y: 22,
      w: 77,
      h: 22,
      r: 11,
      rise: 2.2,
      lenses: [
        { x: 26, y: 33, d: 10.5 },
        { x: 39, y: 33, d: 10.5 },
        { x: 52, y: 33, d: 10.5 },
        { x: 67, y: 33, d: 5, kind: "flash" },
      ],
    },
  },
};

export function Models() {
  const [rows, setRows] = useState<M[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [uploadingForId, setUploadingForId] = useState<number | null>(null);

  // New phone form state
  const [newBrand, setNewBrand] = useState("samsung");
  const [newName, setNewName] = useState("Samsung Galaxy S27 Ultra");
  const [newYear, setNewYear] = useState(2027);
  const [newH, setNewH] = useState(163.0);
  const [newW, setNewW] = useState(77.8);
  const [newD, setNewD] = useState(8.3);
  const [newR, setNewR] = useState(4.2);
  const [newPreset, setNewPreset] = useState("samsung_ultra");
  const [newBodyHex, setNewBodyHex] = useState("#1f2937");
  const [newAliases, setNewAliases] = useState("s27 s27u s27ultra");
  const [newSurcharge, setNewSurcharge] = useState(300);
  const [newIsHero, setNewIsHero] = useState(true);
  const [newAddToAll, setNewAddToAll] = useState(true);
  const [newModel3dUrl, setNewModel3dUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api<{ data: M[] }>("/admin/phone-models")
      .then((r) => setRows(r.data))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let alive = true;
    api<{ data: M[] }>("/admin/phone-models")
      .then((r) => {
        if (alive) setRows(r.data);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const patch = async (id: number, body: Partial<M>) => {
    await api(`/admin/phone-models/${id}`, { method: "PATCH", json: body });
    load();
  };

  const setHero = async (id: number) => {
    await api(`/admin/phone-models/${id}/set-hero`, { method: "POST" });
    load();
  };

  const deleteModel = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to delete ${name}? All variants for this model will also be removed.`)) return;
    await api(`/admin/phone-models/${id}`, { method: "DELETE" });
    load();
  };

  const handleGlbUpload = async (id: number, file: File) => {
    if (!file.name.endsWith(".glb")) {
      alert("Please choose a valid .glb file (binary glTF)");
      return;
    }
    setUploadingForId(id);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api<{ data: { url: string; bytes: number } }>("/uploads/model", {
        method: "POST",
        body: fd,
      });
      if (res.data?.url) {
        await patch(id, { model3dUrl: res.data.url });
      }
    } catch (e) {
      alert("Upload failed: " + (e as Error).message);
    } finally {
      setUploadingForId(null);
    }
  };

  const handleCreatePhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return setFormErr("Phone name is required");
    setSubmitting(true);
    setFormErr(null);

    const preset = CAMERA_PRESETS[newPreset] ?? CAMERA_PRESETS.samsung_ultra;

    try {
      await api("/admin/phone-models", {
        method: "POST",
        json: {
          brandSlug: newBrand,
          name: newName.trim(),
          year: Number(newYear),
          heightMm: Number(newH),
          widthMm: Number(newW),
          depthMm: Number(newD),
          cornerRadiusMm: Number(newR),
          camera: preset.spec,
          bodyHex: newBodyHex,
          aliases: newAliases.trim(),
          priceAdjust: Number(newSurcharge),
          popular: true,
          isHero: newIsHero,
          model3dUrl: newModel3dUrl.trim() || undefined,
          addToAllProducts: newAddToAll,
          stock: 25,
        },
      });
      setShowAdd(false);
      load();
    } catch (e) {
      setFormErr((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const currentHero = rows.find((m) => m.isHero);
  const filtered = rows.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.brand.toLowerCase().includes(search.toLowerCase()) ||
      String(m.year).includes(search),
  );

  return (
    <div className="space-y-4">
      {/* ───── Flagship Hero Spotlight Card ───── */}
      <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-purple-500/10 to-indigo-500/10 p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-bold text-amber-700">
                <Star size={13} className="fill-amber-500 text-amber-500" /> Storefront Flagship Hero
              </span>
              <span className="text-xs text-muted">Auto-syncs across Home, Cases, Skins &amp; Protectors</span>
            </div>
            <h3 className="text-xl font-extrabold text-ink">
              {currentHero ? (
                <>
                  {currentHero.name} <span className="text-xs font-semibold text-muted">({currentHero.brand} · {currentHero.year})</span>
                </>
              ) : (
                "No Flagship Hero Selected (Falling back to iPhone 18 Pro Max)"
              )}
            </h3>
            <p className="text-xs text-muted max-w-xl">
              Future-Proof Engine: Jab bhi koi naya flagship phone launch ho (jaise Samsung Galaxy S27 Ultra ya iPhone 19 Pro Max),
              aap use 1 click mein &ldquo;Storefront Flagship&rdquo; bana sakte hain. Website ka 3D hero aur case customizer khud ba khud update ho jayega.
            </p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="btn btn-primary flex items-center gap-2 self-start rounded-xl px-4 py-2.5 text-xs font-bold shadow-md"
          >
            <Plus size={16} /> Add Future Phone Model
          </button>
        </div>
      </div>

      {/* ───── Main Models Table ───── */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Smartphone size={18} className="text-accent" />
            <h4 className="text-base font-bold text-ink">Active Phone Models ({rows.length})</h4>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search model, brand or year..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input h-8 w-64 text-xs"
            />
            <button
              onClick={load}
              disabled={loading}
              title="Refresh"
              className="grid h-8 w-8 place-items-center rounded-lg border border-black/10 bg-white text-muted hover:text-ink"
            >
              <RefreshCw size={14} className={cn(loading && "animate-spin")} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px] text-sm">
            <thead className="border-b border-line text-left text-xs uppercase text-muted">
              <tr>
                <th className="py-2.5">Model &amp; Brand</th>
                <th>Hero Flagship</th>
                <th>3D Asset Source</th>
                <th>Dimensions (mm)</th>
                <th>Surcharge</th>
                <th>Aliases</th>
                <th>Popular</th>
                <th>Active</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map((m) => (
                <tr key={m.id} className={cn("transition-colors", m.isHero && "bg-amber-500/[0.04]")}>
                  {/* Model & Brand */}
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      {m.isHero && <Star size={15} className="fill-amber-500 text-amber-500 shrink-0" />}
                      <div>
                        <b className="font-bold text-ink block">{m.name}</b>
                        <span className="text-xs text-muted">
                          {m.brand} · {m.year} · <code className="text-[11px] text-muted">{m.slug}</code>
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Hero Flagship Switcher */}
                  <td>
                    {m.isHero ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2.5 py-1 text-xs font-bold text-amber-800">
                        <Check size={13} /> Active Hero
                      </span>
                    ) : (
                      <button
                        onClick={() => setHero(m.id)}
                        className="chip text-[11px] hover:!bg-amber-500 hover:!text-white transition"
                        title="Set as Storefront Hero Flagship"
                      >
                        ⭐ Make Flagship
                      </button>
                    )}
                  </td>

                  {/* 3D Asset Source (Procedural vs Uploaded GLB) */}
                  <td>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {m.model3dUrl ? (
                        <div className="flex items-center gap-1">
                          <span
                            title={m.model3dUrl}
                            className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 px-2 py-0.5 text-[11px] font-semibold text-blue-700 max-w-[100px] truncate"
                          >
                            Custom .GLB
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Remove custom 3D model for ${m.name} and revert to built-in procedural 3D?`)) {
                                patch(m.id, { model3dUrl: null });
                              }
                            }}
                            className="text-[10.5px] text-danger hover:underline"
                            title="Remove GLB and revert to built-in 3D model"
                          >
                            Reset
                          </button>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                          Built-in 3D
                        </span>
                      )}

                      <label
                        className={cn(
                          "cursor-pointer rounded-lg border border-black/10 bg-black/[0.03] px-2 py-1 text-[11px] font-medium text-ink hover:bg-black/[0.08] transition flex items-center gap-1",
                          uploadingForId === m.id && "opacity-50 pointer-events-none",
                        )}
                        title="Upload a new 3D .glb binary file"
                      >
                        <Upload size={12} />
                        {uploadingForId === m.id ? "Uploading..." : "Update .glb"}
                        <input
                          type="file"
                          accept=".glb"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleGlbUpload(m.id, f);
                          }}
                        />
                      </label>

                      <button
                        type="button"
                        onClick={() => {
                          const url = prompt("Enter 3D model .glb URL (e.g. from CDN or S3):", m.model3dUrl || "");
                          if (url !== null) patch(m.id, { model3dUrl: url.trim() || null });
                        }}
                        className="rounded-lg border border-black/10 bg-black/[0.02] px-1.5 py-1 text-[10.5px] text-muted hover:text-ink transition"
                        title="Paste direct 3D URL"
                      >
                        URL
                      </button>
                    </div>
                  </td>

                  {/* Dimensions */}
                  <td className="text-xs text-muted">
                    {m.heightMm} × {m.widthMm} × {m.depthMm} mm
                  </td>

                  {/* Price Surcharge */}
                  <td>
                    <InlineNum value={m.priceAdjust} onSave={(v) => patch(m.id, { priceAdjust: v })} />
                  </td>

                  {/* Aliases */}
                  <td>
                    <input
                      defaultValue={m.aliases}
                      onBlur={(e) => e.target.value !== m.aliases && patch(m.id, { aliases: e.target.value })}
                      className="h-8 w-44 rounded-lg bg-black/[0.04] px-2 text-xs"
                      title="Search aliases"
                    />
                  </td>

                  {/* Popular */}
                  <td>
                    <input
                      type="checkbox"
                      checked={m.popular}
                      onChange={(e) => patch(m.id, { popular: e.target.checked })}
                      className="cursor-pointer"
                    />
                  </td>

                  {/* Active */}
                  <td>
                    <input
                      type="checkbox"
                      checked={m.active}
                      onChange={(e) => patch(m.id, { active: e.target.checked })}
                      className="cursor-pointer"
                    />
                  </td>

                  {/* Delete */}
                  <td className="text-right">
                    <button
                      onClick={() => deleteModel(m.id, m.name)}
                      className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-danger/10 hover:text-danger"
                      title="Delete phone model"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ───── Add New Phone Model Modal / Dialog ───── */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="card max-h-[92vh] w-full max-w-2xl overflow-y-auto p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h3 className="text-lg font-bold text-ink">Add Future Phone Model</h3>
                <p className="text-xs text-muted">Naye phone ke physical specs aur 3D setup yahan define karein.</p>
              </div>
              <button
                onClick={() => setShowAdd(false)}
                className="grid h-8 w-8 place-items-center rounded-full hover:bg-black/10"
              >
                <X size={16} />
              </button>
            </div>

            {formErr && <div className="mt-3 rounded-xl bg-danger/10 p-2.5 text-xs text-danger font-medium">{formErr}</div>}

            <form onSubmit={handleCreatePhone} className="mt-4 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-ink mb-1">Brand</label>
                  <select
                    value={newBrand}
                    onChange={(e) => setNewBrand(e.target.value)}
                    className="input h-9 text-xs"
                  >
                    <option value="samsung">Samsung</option>
                    <option value="apple">Apple</option>
                    <option value="google">Google</option>
                    <option value="xiaomi">Xiaomi</option>
                    <option value="oneplus">OnePlus</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-ink mb-1">Model Name</label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Samsung Galaxy S27 Ultra"
                    className="input h-9 text-xs"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-ink mb-1">Launch Year</label>
                  <input
                    type="number"
                    value={newYear}
                    onChange={(e) => setNewYear(Number(e.target.value))}
                    className="input h-9 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-ink mb-1">Camera Layout Preset</label>
                  <select
                    value={newPreset}
                    onChange={(e) => {
                      const p = e.target.value;
                      setNewPreset(p);
                      if (p === "samsung_ultra") {
                        setNewH(163.0); setNewW(77.8); setNewD(8.3); setNewR(4.2);
                      } else if (p === "iphone_pro_bar") {
                        setNewH(163.5); setNewW(78.0); setNewD(8.75); setNewR(12.5);
                      } else if (p === "iphone_plateau") {
                        setNewH(149.6); setNewW(71.5); setNewD(7.8); setNewR(10.0);
                      } else if (p === "google_pixel") {
                        setNewH(162.8); setNewW(76.6); setNewD(8.5); setNewR(11.5);
                      }
                    }}
                    className="input h-9 text-xs"
                  >
                    {Object.entries(CAMERA_PRESETS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Physical Dimensions in mm */}
              <div className="rounded-xl border border-black/5 bg-black/[0.02] p-3">
                <span className="block text-xs font-bold text-ink mb-2">Physical Dimensions (mm)</span>
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <span className="text-[11px] text-muted block">Height (mm)</span>
                    <input
                      type="number"
                      step="0.1"
                      value={newH}
                      onChange={(e) => setNewH(Number(e.target.value))}
                      className="input h-8 text-xs"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] text-muted block">Width (mm)</span>
                    <input
                      type="number"
                      step="0.1"
                      value={newW}
                      onChange={(e) => setNewW(Number(e.target.value))}
                      className="input h-8 text-xs"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] text-muted block">Depth (mm)</span>
                    <input
                      type="number"
                      step="0.1"
                      value={newD}
                      onChange={(e) => setNewD(Number(e.target.value))}
                      className="input h-8 text-xs"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] text-muted block">Corner Radius (mm)</span>
                    <input
                      type="number"
                      step="0.1"
                      value={newR}
                      onChange={(e) => setNewR(Number(e.target.value))}
                      className="input h-8 text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-bold text-ink mb-1">Body Colour (Hex)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={newBodyHex}
                      onChange={(e) => setNewBodyHex(e.target.value)}
                      className="h-9 w-9 rounded-lg border border-black/10 cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={newBodyHex}
                      onChange={(e) => setNewBodyHex(e.target.value)}
                      className="input h-9 text-xs flex-1"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-ink mb-1">Search Aliases</label>
                  <input
                    type="text"
                    value={newAliases}
                    onChange={(e) => setNewAliases(e.target.value)}
                    placeholder="e.g. s27 s27u s27ultra"
                    className="input h-9 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-ink mb-1">Price Surcharge (Rs.)</label>
                  <input
                    type="number"
                    value={newSurcharge}
                    onChange={(e) => setNewSurcharge(Number(e.target.value))}
                    className="input h-9 text-xs"
                  />
                </div>
              </div>

              {/* Custom 3D Model GLB File Upload (Optional) */}
              <div className="rounded-xl border border-black/5 bg-black/[0.02] p-3 space-y-2">
                <span className="block text-xs font-bold text-ink">Custom 3D Model File (.glb) (Optional)</span>
                <p className="text-[11px] text-muted">
                  Agar aapke paas phone ka custom 3D file (.glb) hai, toh yahan upload karein. Agar nahi hai, toh hamara built-in procedural engine dimensions se bilkul perfect 3D model bana dega.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    accept=".glb"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const fd = new FormData();
                      fd.append("file", f);
                      try {
                        const res = await api<{ data: { url: string } }>("/api/v1/uploads/model", {
                          method: "POST",
                          body: fd,
                        });
                        if (res.data?.url) setNewModel3dUrl(res.data.url);
                      } catch (err) {
                        alert("3D file upload failed: " + (err as Error).message);
                      }
                    }}
                    className="text-xs"
                  />
                  {newModel3dUrl && (
                    <span className="text-[11px] text-success font-bold">✓ 3D Model Uploaded</span>
                  )}
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-2 pt-1">
                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newIsHero}
                    onChange={(e) => setNewIsHero(e.target.checked)}
                    className="rounded"
                  />
                  <span>⭐ Storefront Flagship Hero banayein (Homepage, Cases aur Skins par sab se pehle dikhayen)</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newAddToAll}
                    onChange={(e) => setNewAddToAll(e.target.checked)}
                    className="rounded"
                  />
                  <span>📦 Tamam live products ke liye is model ke variants khud ba khud generate karein (Initial stock: 25)</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 border-t border-line pt-4">
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="btn btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary text-xs font-bold"
                >
                  {submitting ? "Creating Phone Model..." : "Create & Save Phone Model 🚀"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────────── Reviews ───────────── */
type R = {
  id: number; product: string; productSlug: string; name: string; rating: number; title: string | null; body: string; approved: boolean; verified: boolean;
  photos: string[]; adminReply: string | null; orderNumber: string | null; createdAt: string;
};

export function Reviews() {
  const [rows, setRows] = useState<R[]>([]);
  const [filter, setFilter] = useState<"waiting" | "live" | "all">("waiting");
  const [reply, setReply] = useState<Record<number, string>>({});
  const load = () => api<{ data: R[] }>(`/admin/reviews${filter === "all" ? "" : `?approved=${filter === "live"}`}`).then((r) => setRows(r.data));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);
  const patch = async (id: number, json: Record<string, unknown>) => {
    await api(`/admin/reviews/${id}`, { method: "PATCH", json });
    load();
  };
  return (
    <div className="space-y-3">
      <div className="card flex flex-wrap items-center gap-2 p-3">
        {([["waiting", "Waiting for approval"], ["live", "On the website"], ["all", "All"]] as const).map(([f, l]) => (
          <button key={f} onClick={() => setFilter(f)} className={cn("rounded-full px-4 py-2 text-sm font-medium", filter === f ? "bg-ink text-white" : "bg-black/[0.04]")}>{l}</button>
        ))}
        <p className="ml-auto max-w-md text-[12.5px] text-muted">
          Reviews tabhi website par aate hain jab aap approve karein. Kam stars wale reviews bhi approve karein aur neeche jawab dein, isi se customer ko bharosa hota hai.
        </p>
      </div>
      <div className="card p-4">
        <ul className="divide-y divide-line">
          {rows.length === 0 && <Empty>{filter === "waiting" ? "Koi naya review nahi. Order desk → Delivered se customers ko review ka link bhejein." : "No reviews yet"}</Empty>}
          {rows.map((r) => (
            <li key={r.id} className="grid gap-3 py-4 lg:grid-cols-[1fr_auto]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Stars value={r.rating} size={15} animate={false} />
                  {r.title && <b dir="auto">{r.title}</b>}
                  {r.verified && <span className="rounded-full bg-[#e9f8ef] px-2 py-0.5 text-[11px] font-semibold text-success">Verified buyer</span>}
                  {r.approved && <span className="rounded-full bg-[#eef1ff] px-2 py-0.5 text-[11px] font-semibold text-accent">Live</span>}
                </div>
                <p dir="auto" className="mt-1 whitespace-pre-line text-[14px] text-ink/80">{r.body}</p>
                {!!r.photos?.length && (
                  <div className="mt-2 flex gap-2">
                    {r.photos.map((u) => (
                      <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="h-16 w-16 overflow-hidden rounded-xl bg-black/5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={u} alt="" className="h-full w-full object-cover" />
                      </a>
                    ))}
                  </div>
                )}
                <p className="mt-1.5 text-xs text-muted">
                  <span dir="auto">{r.name}</span> · <a href={`/product/${r.productSlug}#reviews`} target="_blank" className="hover:text-accent">{r.product}</a>
                  {r.orderNumber && <> · order <b className="font-mono">#{r.orderNumber}</b></>} · {dateTime(r.createdAt)}
                </p>
                <div className="mt-2 flex gap-2">
                  <input
                    dir="auto"
                    value={reply[r.id] ?? r.adminReply ?? ""}
                    onChange={(e) => setReply({ ...reply, [r.id]: e.target.value })}
                    placeholder="Store ka jawab (website par review ke neeche dikhega)"
                    className="input h-9 min-w-0 flex-1 text-[13px]"
                  />
                  {reply[r.id] !== undefined && reply[r.id] !== (r.adminReply ?? "") && (
                    <button
                      className="chip h-9 text-xs"
                      onClick={async () => {
                        await patch(r.id, { adminReply: reply[r.id] || null });
                        setReply((curr) => {
                          const next = { ...curr };
                          delete next[r.id];
                          return next;
                        });
                      }}
                    >
                      Save reply
                    </button>
                  )}
                </div>
              </div>
              <div className="flex gap-2 lg:flex-col">
                <button className={cn("chip h-8 text-xs", r.approved && "!bg-success !text-white")} onClick={() => patch(r.id, { approved: !r.approved })}>
                  {r.approved ? "✓ Approved (hide)" : "Approve"}
                </button>
                <button className="chip h-8 text-xs text-danger" onClick={async () => { if (confirm("Delete this review?")) { await api(`/admin/reviews/${r.id}`, { method: "DELETE" }); load(); } }}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
