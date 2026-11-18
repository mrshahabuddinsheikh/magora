"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box, Check, ChevronRight, MessageCircle, PackageCheck, PackageX, Printer, RefreshCw, ScanLine, Search, Truck, Undo2, X, Zap,
} from "lucide-react";
import { api } from "@/lib/client-api";
import { cn, dateTime, money } from "@/lib/format";
import { SITE_URL, STORE_NAME } from "@/lib/config";
import { Empty } from "./ui";

/* ───────────── types ───────────── */

type Row = {
  number: string; status: string; createdAt: string; name: string; phone: string; city: string; address: string;
  notes: string | null; total: number; codDue: number; paymentMethod: string; openParcel: boolean; pieces: number; weightGrams: number;
  items: { name: string; model: string; color: string; qty: number; sku: string }[];
  labelPrintedAt: string | null; packedAt: string | null; shippedAt: string | null; deliveredAt: string | null; returnedAt: string | null;
  returnType: string | null; returnReason: string | null; returnCost: number;
  reviewRequestedAt: string | null; reviewToken: string | null; reviewsGiven: number;
  courier: string | null; courierName: string | null; trackingNumber: string | null; shipmentStatus: string | null;
};
type Options = { couriers: { id: string; name: string }[]; cities: string[]; returnReasons: string[]; openParcelDefault: boolean };

const STAGES: { id: string; label: string; hint: string }[] = [
  { id: "to_pack", label: "To pack", hint: "Confirmed orders — pick, pack, print the label" },
  { id: "packed", label: "Packed", hint: "Packed & labelled — waiting for the courier" },
  { id: "shipped", label: "With courier", hint: "On the way — mark delivered or returned" },
  { id: "delivered", label: "Delivered", hint: "Cash collected (COD)" },
  { id: "returned", label: "Returned", hint: "Came back — with the reason" },
  { id: "new", label: "Not confirmed", hint: "Still to confirm on WhatsApp / call" },
  { id: "cancelled", label: "Cancelled", hint: "" },
];

const STAGE_OF: Record<string, string[]> = {
  new: ["pending"], to_pack: ["confirmed"], packed: ["processing"], shipped: ["shipped", "out_for_delivery"],
  delivered: ["delivered"], returned: ["returned"], cancelled: ["cancelled"],
};

/** WhatsApp text with the customer's personal "rate your order" link */
const reviewMessage = (r: Row) =>
  `Assalam o Alaikum ${r.name.split(" ")[0]}! 😊\n${STORE_NAME} se aap ka order #${r.number} mil gaya hoga.\n` +
  `Kya aap 1 minute mein bata sakte hain ke kaisa laga? Aap ki asli raye (achhi ya buri) doosre customers ki madad karti hai:\n` +
  `${SITE_URL}/review/${r.number}?t=${r.reviewToken}\n\nShukriya!`;

const localPhone = (p: string) => {
  const d = p.replace(/\D/g, "");
  const n = d.startsWith("92") ? "0" + d.slice(2) : d;
  return n.length === 11 ? `${n.slice(0, 4)} ${n.slice(4)}` : p;
};

/* ───────────── main ───────────── */

export function Desk({ openOrder }: { openOrder: (n: string) => void }) {
  const [stage, setStage] = useState("to_pack");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [opts, setOpts] = useState<Options | null>(null);
  const [q, setQ] = useState("");
  const [courier, setCourier] = useState("");
  const [city, setCity] = useState("");
  const [printed, setPrinted] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [panel, setPanel] = useState<null | "courier" | "return">(null);
  /** orders to keep ticked after moving to another stage */
  const keep = useRef<string[] | null>(null);

  const flash = (t: string) => {
    setToast(t);
    setTimeout(() => setToast(null), 2600);
  };

  const load = useCallback(async () => {
    const p = new URLSearchParams({ stage });
    if (q.trim()) p.set("q", q.trim());
    if (courier) p.set("courier", courier);
    if (city) p.set("city", city);
    if (printed) p.set("printed", printed);
    const r = await api<{ data: Row[]; meta: { counts: Record<string, number> } }>(`/admin/desk?${p}`);
    setRows(r.data);
    setCounts(r.meta.counts);
    const want = keep.current;
    keep.current = null;
    setSel((s) => new Set([...(want ?? s)].filter((n) => r.data.some((x) => x.number === n))));
  }, [stage, q, courier, city, printed]);

  useEffect(() => {
    api<{ data: Options }>("/admin/desk/options").then((r) => setOpts(r.data));
  }, []);
  useEffect(() => {
    queueMicrotask(() => setRows(null));
    const t = setTimeout(load, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, q]);
  useEffect(() => {
    queueMicrotask(() => {
      if (!keep.current) setSel(new Set());
      setPanel(null);
    });
  }, [stage]);

  const chosen = useMemo(() => (rows ?? []).filter((r) => sel.has(r.number)), [rows, sel]);
  const all = !!rows?.length && sel.size === rows.length;
  const toggle = (n: string) => setSel((s) => { const x = new Set(s); if (x.has(n)) x.delete(n); else x.add(n); return x; });

  const bulk = async (action: string, extra: Record<string, unknown> = {}, numbers = [...sel]) => {
    if (!numbers.length) return;
    setBusy(true);
    try {
      const r = await api<{ data: { done: string[]; skipped: { number: string; why: string }[] } }>("/admin/desk/bulk", { method: "POST", json: { action, numbers, ...extra } });
      const sk = r.data.skipped;
      flash(`✓ ${r.data.done.length} done${sk.length ? ` · ${sk.length} skipped (${sk[0].number}: ${sk[0].why})` : ""}`);
      await load();
    } catch (e) {
      flash((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const printLabels = (view: "labels" | "pick" = "labels", numbers = [...sel]) => {
    if (!numbers.length) return;
    window.open(`/admin/labels?numbers=${encodeURIComponent(numbers.join(","))}&view=${view}`, "_blank");
  };

  const bulkBookCourier = async (courier: string) => {
    if (!sel.size) return;
    setBusy(true);
    try {
      await api("/admin/orders/bulk-book-courier", {
        method: "POST",
        json: { numbers: [...sel], courier },
      });
      await load();
    } catch (e: any) {
      alert(e.message || "Bulk courier booking failed");
    } finally {
      setBusy(false);
    }
  };

  const codTotal = chosen.reduce((a, r) => a + r.codDue, 0);
  const st = STAGES.find((s) => s.id === stage)!;

  return (
    <div className="space-y-3">
      <Scanner
        onFound={(n, status) => {
          const s = Object.entries(STAGE_OF).find(([, v]) => v.includes(status))?.[0];
          if (s) setStage(s);
          setQ(n);
        }}
        onAction={async (action, n) => { await bulk(action, {}, [n]); }}
      />

      {/* stage tabs */}
      <div className="card flex gap-1.5 overflow-x-auto p-2">
        {STAGES.map((s) => (
          <button
            key={s.id}
            onClick={() => setStage(s.id)}
            className={cn("flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition", stage === s.id ? "bg-ink text-white" : "hover:bg-black/[0.04]")}
          >
            {s.label}
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", stage === s.id ? "bg-white/20" : "bg-black/[0.06]")}>{counts[s.id] ?? 0}</span>
          </button>
        ))}
      </div>

      {/* filters */}
      <div className="card flex flex-wrap items-center gap-2 p-3">
        <label className="relative min-w-[220px] flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Order #, name, phone or tracking no." className="input h-10 w-full pl-9" />
        </label>
        <select value={city} onChange={(e) => setCity(e.target.value)} className="input h-10 w-auto" aria-label="City">
          <option value="">All cities</option>
          {opts?.cities.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select value={courier} onChange={(e) => setCourier(e.target.value)} className="input h-10 w-auto" aria-label="Courier">
          <option value="">All couriers</option>
          {opts?.couriers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {["to_pack", "packed"].includes(stage) && (
          <select value={printed} onChange={(e) => setPrinted(e.target.value)} className="input h-10 w-auto" aria-label="Label printed">
            <option value="">Label: any</option>
            <option value="no">Label not printed</option>
            <option value="yes">Label printed</option>
          </select>
        )}
        <button onClick={load} className="btn btn-ghost h-10 px-3 text-sm" aria-label="Refresh"><RefreshCw size={14} /></button>
      </div>

      {st.hint && <p className="px-1 text-[12.5px] text-muted">{st.hint}</p>}

      {/* bulk bar */}
      {sel.size > 0 && (
        <div className="card sticky top-2 z-10 flex flex-wrap items-center gap-2 border-2 border-accent/30 p-3">
          <b className="text-sm">{sel.size} selected</b>
          {codTotal > 0 && <span className="text-[12.5px] text-muted">· COD to collect {money(codTotal)}</span>}
          <span className="flex-1" />
          <button disabled={busy} onClick={() => printLabels("labels")} className="btn btn-dark h-9 px-3 text-[13px]"><Printer size={15} /> Print labels</button>
          <button disabled={busy} onClick={() => printLabels("pick")} className="btn btn-ghost h-9 px-3 text-[13px]"><Box size={15} /> Pick list</button>
          <button disabled={busy} onClick={() => bulkBookCourier("postex")} className="btn btn-secondary h-9 px-3 text-[13px] font-bold"><Zap size={14} className="text-amber-500 fill-amber-500" /> Book PostEx</button>
          <button disabled={busy} onClick={() => bulkBookCourier("trax")} className="btn btn-secondary h-9 px-3 text-[13px] font-bold"><Zap size={14} className="text-amber-500 fill-amber-500" /> Book Trax</button>
          {["new", "to_pack"].includes(stage) && (
            <button disabled={busy} onClick={() => bulk("pack")} className="btn btn-ghost h-9 px-3 text-[13px]"><PackageCheck size={15} /> Mark packed</button>
          )}
          {["to_pack", "packed"].includes(stage) && (
            <>
              <button disabled={busy} onClick={() => setPanel(panel === "courier" ? null : "courier")} className="btn btn-ghost h-9 px-3 text-[13px]"><Truck size={15} /> Courier & tracking</button>
              <button disabled={busy} onClick={() => bulk("ship")} className="btn btn-primary h-9 px-3 text-[13px]"><Truck size={15} /> Handed to courier</button>
            </>
          )}
          {stage === "shipped" && (
            <button disabled={busy} onClick={() => bulk("deliver")} className="btn h-9 bg-success px-3 text-[13px] text-white"><Check size={15} /> Delivered</button>
          )}
          {["shipped", "delivered", "packed"].includes(stage) && (
            <button disabled={busy} onClick={() => setPanel(panel === "return" ? null : "return")} className="btn h-9 bg-[#fde8e8] px-3 text-[13px] text-danger"><Undo2 size={15} /> Returned</button>
          )}
          {["new", "to_pack", "packed"].includes(stage) && (
            <>
              <button disabled={busy} onClick={() => bulk("open_parcel", { openParcel: true })} className="chip h-9 text-[12px]">Open parcel ✔</button>
              <button disabled={busy} onClick={() => bulk("open_parcel", { openParcel: false })} className="chip h-9 text-[12px]">Open parcel ✘</button>
              <button disabled={busy} onClick={() => { if (confirm(`Cancel ${sel.size} order(s)? Stock goes back.`)) bulk("cancel"); }} className="chip h-9 text-[12px] text-danger"><X size={13} /> Cancel</button>
            </>
          )}
          <button onClick={() => setSel(new Set())} className="grid h-9 w-9 place-items-center rounded-full hover:bg-black/5" aria-label="Clear selection"><X size={15} /></button>
        </div>
      )}

      {panel === "courier" && opts && (
        <CourierPanel
          rows={chosen}
          couriers={opts.couriers}
          onDone={(m) => {
            flash(m);
            setPanel(null);
            // booking a courier counts as "packed" → follow the orders there, still ticked
            keep.current = chosen.map((r) => r.number);
            if (stage === "to_pack") setStage("packed");
            else load();
          }}
        />
      )}
      {panel === "return" && opts && <ReturnPanel rows={chosen} reasons={opts.returnReasons} delivered={stage === "delivered"} onDone={(m) => { flash(m); setPanel(null); setSel(new Set()); load(); }} />}

      {/* list */}
      {!rows ? (
        <div className="skeleton h-72 rounded-[24px]" />
      ) : !rows.length ? (
        <div className="card"><Empty>Is stage mein koi order nahi.</Empty></div>
      ) : (
        <div className="card overflow-hidden">
          <div className="flex items-center gap-3 border-b border-line px-4 py-2.5 text-[12px] font-semibold uppercase tracking-wide text-muted">
            <input type="checkbox" checked={all} onChange={() => setSel(all ? new Set() : new Set(rows.map((r) => r.number)))} className="h-4 w-4 accent-[#4a65ff]" aria-label="Select all" />
            <span className="flex-1">{rows.length} orders</span>
            <span className="hidden sm:block">COD / Total</span>
          </div>
          <ul className="divide-y divide-line">
            {rows.map((r) => (
              <li key={r.number} className={cn("flex gap-3 px-4 py-3 transition", sel.has(r.number) && "bg-accent/[0.05]")}>
                <input type="checkbox" checked={sel.has(r.number)} onChange={() => toggle(r.number)} className="mt-1 h-4 w-4 shrink-0 accent-[#4a65ff]" aria-label={`Select ${r.number}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <button onClick={() => openOrder(r.number)} className="font-mono text-[14px] font-bold hover:text-accent">#{r.number}</button>
                    <span className="text-[13.5px] font-medium">{r.name}</span>
                    <a href={`tel:${r.phone}`} className="font-mono text-[12.5px] text-muted hover:text-accent">{localPhone(r.phone)}</a>
                    <span className="rounded-full bg-black/[0.05] px-2 py-0.5 text-[11.5px] font-semibold">{r.city}</span>
                    {!r.openParcel && <span className="rounded-full bg-[#fff4e0] px-2 py-0.5 text-[11px] font-semibold text-[#a15c00]">No open parcel</span>}
                    {r.labelPrintedAt ? (
                      <span className="rounded-full bg-[#e9f8ef] px-2 py-0.5 text-[11px] font-semibold text-success">Label ✓</span>
                    ) : ["to_pack", "packed"].includes(stage) ? (
                      <span className="rounded-full bg-black/[0.05] px-2 py-0.5 text-[11px] text-muted">Label not printed</span>
                    ) : null}
                  </div>
                  <p className="mt-1 truncate text-[12.5px] text-muted">
                    {r.items.map((i) => `${i.qty}× ${i.name}${i.model ? ` (${i.model})` : ""} · ${i.color}`).join("  ·  ")}
                  </p>
                  <p className="mt-0.5 flex flex-wrap gap-x-3 text-[12px] text-muted">
                    <span>{dateTime(r.createdAt)}</span>
                    {r.courierName && (
                      <span className="text-ink">
                        <Truck size={12} className="mr-1 inline" />
                        {r.courierName}
                        {r.trackingNumber && <b className="ml-1 font-mono">{r.trackingNumber}</b>}
                      </span>
                    )}
                    {r.returnReason && <span className="text-danger">↩ {r.returnType === "customer" ? "Customer return" : "Courier return"} · {r.returnReason}</span>}
                    {r.notes && <span className="text-[#a15c00]">Note: {r.notes}</span>}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <b className="block text-[15px] tabular-nums">{money(r.codDue || r.total)}</b>
                  <span className="text-[11px] text-muted">{r.codDue ? "COD" : r.paymentMethod === "cod" ? "Paid" : "Prepaid"}</span>
                  {stage === "delivered" && r.reviewToken && (
                    <div className="mt-1.5">
                      {r.reviewsGiven > 0 ? (
                        <span className="rounded-full bg-[#fff3d6] px-2 py-0.5 text-[11.5px] font-semibold text-[#a15c00]">★ Reviewed</span>
                      ) : (
                        <a
                          href={`https://wa.me/${r.phone.replace(/\D/g, "")}?text=${encodeURIComponent(reviewMessage(r))}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => bulk("review_asked", {}, [r.number])}
                          className={cn("inline-flex h-8 items-center gap-1 rounded-full px-3 text-[12px] font-semibold", r.reviewRequestedAt ? "bg-black/[0.05] text-muted" : "bg-[#25d366] text-white")}
                        >
                          <MessageCircle size={13} /> {r.reviewRequestedAt ? "Asked · again" : "Ask for review"}
                        </a>
                      )}
                    </div>
                  )}
                  <div className="mt-1 flex justify-end gap-1">
                    <button onClick={() => printLabels("labels", [r.number])} title="Print label" aria-label={`Print label ${r.number}`} className="grid h-8 w-8 place-items-center rounded-full hover:bg-black/5"><Printer size={15} /></button>
                    <button onClick={() => openOrder(r.number)} title="Open order" aria-label={`Open ${r.number}`} className="grid h-8 w-8 place-items-center rounded-full hover:bg-black/5"><ChevronRight size={16} /></button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {toast && <div className="fixed bottom-5 left-1/2 z-[70] -translate-x-1/2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white shadow-lg">{toast}</div>}
    </div>
  );
}

/* ───────────── barcode scanner box ───────────── */

/** A USB / Bluetooth barcode scanner types the code + Enter. Pick what a scan should do. */
function Scanner({ onFound, onAction }: { onFound: (n: string, status: string) => void; onAction: (action: string, n: string) => Promise<void> }) {
  const [mode, setMode] = useState<"find" | "ship" | "deliver">("find");
  const [code, setCode] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const ref = useRef<HTMLInputElement>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const c = code.trim();
    if (!c) return;
    setCode("");
    try {
      const r = await api<{ data: { number: string; status: string } }>(`/admin/desk/scan/${encodeURIComponent(c)}`);
      if (mode === "find") onFound(r.data.number, r.data.status);
      else await onAction(mode, r.data.number);
      setLog((l) => [`✓ ${r.data.number}${mode === "find" ? "" : mode === "ship" ? " → with courier" : " → delivered"}`, ...l].slice(0, 5));
    } catch {
      setLog((l) => [`✗ ${c} not found`, ...l].slice(0, 5));
    }
    ref.current?.focus();
  };
  return (
    <form onSubmit={submit} className="card flex flex-wrap items-center gap-2 p-3">
      <ScanLine size={18} className="text-accent" />
      <input ref={ref} value={code} onChange={(e) => setCode(e.target.value)} placeholder="Scan label barcode (or type order / tracking no.) + Enter" className="input h-10 min-w-[220px] flex-1 font-mono" />
      <div className="flex rounded-full bg-black/[0.04] p-0.5 text-[12.5px] font-semibold">
        {([["find", "Find"], ["ship", "Scan = handed to courier"], ["deliver", "Scan = delivered"]] as const).map(([m, l]) => (
          <button type="button" key={m} onClick={() => { setMode(m); ref.current?.focus(); }} className={cn("rounded-full px-3 py-1.5", mode === m ? "bg-ink text-white" : "text-ink/70")}>{l}</button>
        ))}
      </div>
      {log.length > 0 && <p className="w-full truncate font-mono text-[12px] text-muted">{log.join("   ")}</p>}
    </form>
  );
}

/* ───────────── courier & tracking numbers ───────────── */

function CourierPanel({ rows, couriers, onDone }: { rows: Row[]; couriers: Options["couriers"]; onDone: (msg: string) => void }) {
  const [courier, setCourier] = useState(rows.find((r) => r.courier)?.courier ?? couriers.find((c) => c.id !== "own")?.id ?? "own");
  const [nums, setNums] = useState<Record<string, string>>(() => Object.fromEntries(rows.map((r) => [r.number, r.trackingNumber ?? ""])));
  const [paste, setPaste] = useState("");
  const [busy, setBusy] = useState(false);
  const fillFromPaste = (txt: string) => {
    setPaste(txt);
    const list = txt.split(/[\s,;]+/).filter(Boolean);
    setNums((n) => Object.fromEntries(rows.map((r, i) => [r.number, list[i] ?? n[r.number] ?? ""])));
  };
  const save = async () => {
    setBusy(true);
    try {
      await api("/admin/desk/tracking", { method: "PUT", json: { courier, items: rows.map((r) => ({ number: r.number, trackingNumber: nums[r.number] ?? "" })) } });
      onDone(`✓ Courier set for ${rows.length} orders`);
    } catch (e) {
      onDone((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="card space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <b className="text-sm">Courier</b>
        <select value={courier} onChange={(e) => setCourier(e.target.value)} className="input h-10 w-auto">
          {couriers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <span className="text-[12.5px] text-muted">Courier ki booking sheet se tracking numbers ek saath paste kar sakte hain (isi order mein).</span>
      </div>
      <textarea value={paste} onChange={(e) => fillFromPaste(e.target.value)} rows={2} placeholder="Paste tracking numbers here (one per line)…" className="input w-full py-2 font-mono text-[13px]" />
      <div className="grid gap-2 sm:grid-cols-2">
        {rows.map((r) => (
          <label key={r.number} className="flex items-center gap-2 text-[13px]">
            <span className="w-24 shrink-0 font-mono font-semibold">#{r.number}</span>
            <span className="w-20 shrink-0 truncate text-muted">{r.city}</span>
            <input value={nums[r.number] ?? ""} onChange={(e) => setNums({ ...nums, [r.number]: e.target.value })} placeholder="Tracking / CN no." className="input h-9 min-w-0 flex-1 font-mono" />
          </label>
        ))}
      </div>
      <button disabled={busy} onClick={save} className="btn btn-dark h-10 px-5 text-sm">Save courier & tracking</button>
    </section>
  );
}

/* ───────────── mark returned ───────────── */

function ReturnPanel({ rows, reasons, delivered, onDone }: { rows: Row[]; reasons: string[]; delivered: boolean; onDone: (msg: string) => void }) {
  const [type, setType] = useState<"rto" | "customer">(delivered ? "customer" : "rto");
  const [reason, setReason] = useState(reasons[0]);
  const [other, setOther] = useState("");
  const [cost, setCost] = useState(0);
  const [restock, setRestock] = useState(true);
  const [block, setBlock] = useState(false);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const r = await api<{ data: { done: string[]; skipped: { number: string; why: string }[] } }>("/admin/desk/return", {
        method: "POST",
        json: { numbers: rows.map((r) => r.number), type, reason: reason === "Other" && other.trim() ? other.trim() : reason, cost, restock, block },
      });
      onDone(`↩ ${r.data.done.length} marked returned${r.data.skipped.length ? ` · ${r.data.skipped.length} skipped` : ""}`);
    } catch (e) {
      onDone((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="card space-y-3 border-2 border-danger/20 p-4 text-[13.5px]">
      <p className="flex items-center gap-2 font-semibold"><PackageX size={17} className="text-danger" /> {rows.length} parcel(s) wapas aaye</p>
      <div className="flex flex-wrap gap-2">
        {([["rto", "Courier ne wapas kiya (deliver nahi hua)"], ["customer", "Customer ne delivery ke baad wapas kiya"]] as const).map(([t, l]) => (
          <button key={t} onClick={() => setType(t)} className={cn("rounded-full px-4 py-2 text-[13px] font-medium", type === t ? "bg-ink text-white" : "bg-black/[0.04]")}>{l}</button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {reasons.map((r) => (
          <button key={r} onClick={() => setReason(r)} className={cn("chip h-8 text-[12.5px]", reason === r && "!bg-danger !text-white")}>{r}</button>
        ))}
      </div>
      {reason === "Other" && <input value={other} onChange={(e) => setOther(e.target.value)} placeholder="Reason likhein…" className="input h-10 w-full" />}
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2">Return charges (per parcel) Rs.
          <input type="number" min={0} value={cost} onChange={(e) => setCost(Math.max(0, Number(e.target.value) || 0))} className="input h-9 w-24" />
        </label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} className="accent-[#4a65ff]" /> Maal theek hai, stock mein wapas daalo</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={block} onChange={(e) => setBlock(e.target.checked)} className="accent-[#e11d48]" /> Number block karo (COD band)</label>
      </div>
      <button disabled={busy} onClick={save} className="btn h-10 bg-danger px-5 text-sm text-white">Mark returned</button>
    </section>
  );
}
