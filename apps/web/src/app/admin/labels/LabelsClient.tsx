"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "@/lib/client-api";
import { code128 } from "@/lib/barcode";
import { money } from "@/lib/format";

type Label = {
  number: string; date: string; name: string; phone: string; address: string; city: string; postalCode: string | null;
  notes: string | null; codDue: number; total: number; paymentMethod: string; openParcel: boolean;
  pieces: number; weightGrams: number; courier: string | null; trackingNumber: string | null;
  items: { name: string; model: string; color: string; qty: number; sku: string }[];
};
type Data = { from: { name: string; phone: string; address: string }; contents: string; labels: Label[] };

/** +923001112201 → 0300 1112201 (how couriers & riders read numbers) */
const localPhone = (p: string) => {
  const d = p.replace(/\D/g, "");
  const n = d.startsWith("92") ? "0" + d.slice(2) : d;
  return n.length === 11 ? `${n.slice(0, 4)} ${n.slice(4)}` : p;
};

function Barcode({ value, height = 44, className }: { value: string; height?: number; className?: string }) {
  const { bars, width } = useMemo(() => code128(value), [value]);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className={className} role="img" aria-label={`Barcode ${value}`}>
      <rect width={width} height={height} fill="#fff" />
      {bars.map(([x, w], i) => (
        <rect key={i} x={x} y={0} width={w} height={height} fill="#000" />
      ))}
    </svg>
  );
}

/** One parcel label, A6 / 4×6 inch. What's inside is NOT printed (only "Mobile accessories"). */
function ParcelLabel({ l, from, contents }: { l: Label; from: Data["from"]; contents: string }) {
  const cod = l.codDue > 0;
  return (
    <article className="label">
      <div className="row head">
        <div>
          <b className="brand">{from.name}</b>
          <span className="muted">{new Date(l.date).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" })}</span>
        </div>
        <div className="right">
          <span className="muted">Courier</span>
          <b className="courier">{l.courier ?? "—"}</b>
        </div>
      </div>

      {l.trackingNumber ? (
        <div className="track">
          <Barcode value={l.trackingNumber} height={40} className="bc" />
          <span className="mono">{l.trackingNumber}</span>
        </div>
      ) : (
        <div className="track empty">Courier tracking no. / CN: ____________________</div>
      )}

      <div className="to">
        <span className="tag">DELIVER TO</span>
        <p className="name">{l.name}</p>
        <p className="phone">☎ {localPhone(l.phone)}</p>
        <p className="addr">{l.address}{l.postalCode ? ` · ${l.postalCode}` : ""}</p>
        <p className="city">{l.city.toUpperCase()}</p>
      </div>

      <div className="row boxes">
        <div className={cod ? "box cod" : "box paid"}>
          {cod ? (
            <>
              <span>COLLECT CASH (COD)</span>
              <b>{money(l.codDue)}</b>
            </>
          ) : (
            <>
              <span>PREPAID</span>
              <b className="small">Do not collect cash</b>
            </>
          )}
        </div>
        <div className={l.openParcel ? "box open" : "box closed"}>
          <span>OPEN PARCEL</span>
          <b className="small">{l.openParcel ? "✔ ALLOWED" : "✘ NOT ALLOWED"}</b>
          <em>{l.openParcel ? "Customer may check before paying" : "Payment first, then open"}</em>
        </div>
      </div>

      <div className="row order">
        <div className="ordbc">
          <Barcode value={l.number} height={30} className="bc" />
          <span className="mono">Order #{l.number}</span>
        </div>
        <div className="meta">
          <span>Pieces <b>{l.pieces}</b></span>
          <span>Weight <b>{(l.weightGrams / 1000).toFixed(2)} kg</b></span>
          <span>Contents <b>{contents}</b></span>
        </div>
      </div>

      {l.notes && <p className="note">Note: {l.notes}</p>}

      <div className="from">
        <span className="tag">FROM / RETURN TO</span> {from.name} · {from.address} · {from.phone}
      </div>
    </article>
  );
}

/** Packing / pick list: what to take from the shelf (inside use only) */
function PickList({ labels }: { labels: Label[] }) {
  const totals = new Map<string, { name: string; model: string; color: string; sku: string; qty: number }>();
  for (const l of labels)
    for (const i of l.items) {
      const k = i.sku;
      const t = totals.get(k) ?? { ...i, qty: 0 };
      t.qty += i.qty;
      totals.set(k, t);
    }
  const rows = [...totals.values()].sort((a, b) => a.name.localeCompare(b.name) || a.model.localeCompare(b.model));
  return (
    <div className="pick">
      <h1>Pick list · {labels.length} orders · {rows.reduce((a, r) => a + r.qty, 0)} items</h1>
      <p className="muted">{new Date().toLocaleString("en-PK")}</p>
      <h2>1. Take from the shelf</h2>
      <table>
        <thead>
          <tr><th>✓</th><th>Product</th><th>Phone</th><th>Colour</th><th>SKU</th><th>Qty</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.sku}>
              <td className="chk">☐</td><td>{r.name}</td><td>{r.model || "—"}</td><td>{r.color}</td><td className="mono">{r.sku}</td><td className="qty">{r.qty}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2>2. Pack each order</h2>
      <table>
        <thead>
          <tr><th>✓</th><th>Order</th><th>Customer · City</th><th>Items</th><th>COD</th></tr>
        </thead>
        <tbody>
          {labels.map((l) => (
            <tr key={l.number}>
              <td className="chk">☐</td>
              <td className="mono">{l.number}</td>
              <td>{l.name} · {l.city}</td>
              <td>{l.items.map((i) => `${i.qty}× ${i.name}${i.model ? ` (${i.model})` : ""} ${i.color}`).join(" · ")}</td>
              <td className="qty">{l.codDue ? money(l.codDue) : "Paid"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LabelsClient() {
  const sp = useSearchParams();
  const numbers = sp.get("numbers") ?? "";
  const [size, setSize] = useState<"a6" | "a4">((sp.get("size") as "a6" | "a4") ?? "a4");
  const [view, setView] = useState<"labels" | "pick">((sp.get("view") as "labels" | "pick") ?? "labels");
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [marked, setMarked] = useState(false);

  useEffect(() => {
    if (!numbers) return;
    api<{ data: Data }>(`/admin/desk/labels?numbers=${encodeURIComponent(numbers)}`)
      .then((r) => setData(r.data))
      .catch((e) => setErr((e as Error).message));
  }, [numbers]);

  const print = async () => {
    window.print();
    if (view === "labels" && data && !marked) {
      setMarked(true);
      api("/admin/desk/bulk", { method: "POST", json: { action: "printed", numbers: data.labels.map((l) => l.number) } }).catch(() => {});
    }
  };

  if (!numbers) return <p className="p-10 text-center">No orders chosen. Go to the order desk and tick the orders first.</p>;
  if (err) return <p className="p-10 text-center text-danger">{err} (log in to the admin panel first)</p>;
  if (!data) return <p className="p-10 text-center text-muted">Loading labels…</p>;

  return <PrintRoot>{page(data)}</PrintRoot>;

  function page(data: Data) {
  return (
    <div className={`labels-page size-${size}`}>
      <style>{CSS(size)}</style>
      <div className="no-print toolbar">
        <Link href="/admin#desk" className="btn btn-glass h-10 px-4 text-sm">← Order desk</Link>
        <div className="seg">
          <button className={view === "labels" ? "on" : ""} onClick={() => setView("labels")}>Parcel labels ({data.labels.length})</button>
          <button className={view === "pick" ? "on" : ""} onClick={() => setView("pick")}>Pick list</button>
        </div>
        {view === "labels" && (
          <div className="seg">
            <button className={size === "a4" ? "on" : ""} onClick={() => setSize("a4")}>A4 paper · 4 per page</button>
            <button className={size === "a6" ? "on" : ""} onClick={() => setSize("a6")}>Label printer 4×6&quot;</button>
          </div>
        )}
        <button className="btn btn-primary h-10 px-5 text-sm" onClick={print}>🖨 Print</button>
      </div>
      {view === "labels" ? (
        <div className="sheet">{data.labels.map((l) => <ParcelLabel key={l.number} l={l} from={data.from} contents={data.contents} />)}</div>
      ) : (
        <PickList labels={data.labels} />
      )}
    </div>
  );
  }
}

/** Labels live in their own top-level box so nothing else on the page can add blank pages when printing */
function PrintRoot({ children }: { children: React.ReactNode }) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const d = document.createElement("div");
    d.id = "print-root";
    document.body.appendChild(d);
    queueMicrotask(() => setEl(d));
    return () => d.remove();
  }, []);
  return el ? createPortal(children, el) : null;
}

const CSS = (size: "a6" | "a4") => `
  body > *:not(#print-root) { display: none !important; }
  body { background: #e9ebf0; margin: 0; }
  .labels-page { color: #000; font-family: Arial, Helvetica, sans-serif; padding: 16px; }
  .toolbar { position: sticky; top: 0; z-index: 5; display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: center; padding: 10px; margin: -16px -16px 16px; background: rgba(255,255,255,.92); backdrop-filter: blur(8px); border-bottom: 1px solid #ddd; }
  .seg { display: inline-flex; background: #eef0f4; border-radius: 999px; padding: 3px; }
  .seg button { border-radius: 999px; padding: 7px 14px; font-size: 13px; font-weight: 600; color: #555; }
  .seg button.on { background: #0b0d12; color: #fff; }
  .sheet { display: grid; gap: 14px; justify-content: center; grid-template-columns: ${size === "a4" ? "repeat(2, 105mm)" : "101.6mm"}; }
  .label { width: ${size === "a4" ? "105mm" : "101.6mm"}; height: ${size === "a4" ? "148mm" : "152mm"}; background: #fff; box-sizing: border-box; padding: 4mm; display: flex; flex-direction: column; gap: 2mm; border: 1px dashed #bbb; overflow: hidden; font-size: 9.5pt; line-height: 1.25; }
  .label, .label *, .pick, .pick * { color: #000; }
  .box.cod, .box.cod *, .tag { color: #fff !important; }
  .row { display: flex; gap: 2mm; }
  .head { justify-content: space-between; align-items: flex-start; border-bottom: 1.5px solid #000; padding-bottom: 1.5mm; }
  .head > div { display: flex; flex-direction: column; }
  .head .right { text-align: right; }
  .brand { font-size: 13pt; letter-spacing: .12em; text-transform: uppercase; }
  .courier { font-size: 12pt; }
  .muted { color: #555; font-size: 7.5pt; }
  .mono { font-family: "Courier New", monospace; font-weight: 700; letter-spacing: .06em; }
  .track { display: flex; flex-direction: column; align-items: center; }
  .track .bc { width: 100%; height: 13mm; }
  .track .mono { font-size: 11pt; }
  .track.empty { border: 1px dashed #000; padding: 3mm; font-size: 9pt; text-align: center; }
  .tag { display: inline-block; background: #000; color: #fff; font-size: 6.5pt; font-weight: 700; letter-spacing: .08em; padding: .4mm 1.6mm; border-radius: 1mm; }
  .to { border: 1.5px solid #000; border-radius: 2mm; padding: 2mm 2.5mm; flex: 1; display: flex; flex-direction: column; gap: .8mm; min-height: 0; }
  .to p { margin: 0; }
  .name { font-size: 13pt; font-weight: 700; }
  .phone { font-size: 13pt; font-weight: 700; letter-spacing: .03em; }
  .addr { font-size: 10pt; }
  .city { font-size: 20pt; font-weight: 900; letter-spacing: .04em; margin-top: auto !important; }
  .boxes .box { flex: 1; border: 1.5px solid #000; border-radius: 2mm; padding: 1.5mm 2mm; display: flex; flex-direction: column; align-items: center; text-align: center; }
  .box span { font-size: 7pt; font-weight: 700; letter-spacing: .06em; }
  .box b { font-size: 17pt; font-weight: 900; line-height: 1.1; }
  .box b.small { font-size: 11pt; }
  .box em { font-size: 6.5pt; font-style: normal; color: #333; }
  .box.cod { background: #000; color: #fff; }
  .box.cod span { color: #fff; }
  .box.closed { background: repeating-linear-gradient(45deg, #fff, #fff 2mm, #eee 2mm, #eee 4mm); }
  .order { align-items: center; }
  .ordbc { width: 46%; display: flex; flex-direction: column; align-items: center; }
  .ordbc .bc { width: 100%; height: 9mm; }
  .ordbc .mono { font-size: 8.5pt; }
  .meta { flex: 1; display: flex; flex-direction: column; gap: .5mm; font-size: 8pt; }
  .note { margin: 0; border: 1px dashed #000; padding: 1mm 2mm; font-size: 8.5pt; font-weight: 700; }
  .from { border-top: 1px solid #000; padding-top: 1.2mm; font-size: 7.5pt; }
  .pick { background: #fff; max-width: 190mm; margin: 0 auto; padding: 8mm; font-size: 10pt; }
  .pick h1 { font-size: 15pt; margin: 0; } .pick h2 { font-size: 11pt; margin: 6mm 0 2mm; }
  .pick table { width: 100%; border-collapse: collapse; } .pick th, .pick td { border: 1px solid #999; padding: 1.5mm 2mm; text-align: left; vertical-align: top; }
  .pick th { background: #f0f0f0; font-size: 8.5pt; } .pick .chk { width: 6mm; text-align: center; font-size: 12pt; } .pick .qty { text-align: right; font-weight: 700; white-space: nowrap; }
  @media print {
    .no-print { display: none !important; }
    body { background: #fff !important; }
    .labels-page { padding: 0; }
    @page { size: ${size === "a4" ? "A4" : "4in 6in"}; margin: 0; }
    .sheet { gap: 0; grid-template-columns: ${size === "a4" ? "repeat(2, 105mm)" : "101.6mm"}; }
    .label { border: none; ${size === "a4" ? "outline: .2mm dashed #999; outline-offset: -.1mm;" : ""} break-inside: avoid; page-break-inside: avoid; }
    html, body { height: auto !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; }
    .sheet { row-gap: 0 !important; column-gap: 0 !important; align-content: start; }
    .label { height: ${size === "a4" ? "147mm" : "150mm"} !important; margin: ${size === "a4" ? "0" : "1mm 0"}; }
    ${size === "a6" ? ".label:not(:last-child) { page-break-after: always; }" : ".label:nth-child(4n):not(:last-child) { page-break-after: always; }"}
    .pick { padding: 10mm; max-width: none; }
  }
`;
