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

/** Pixel-perfect 300 DPI Shipping Label Image Generator (4x6 / A6 thermal print ready) */
function downloadLabelImage(l: Label, from: Data["from"], contents: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 1800;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 1200, 1800);

  // Outer border
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 6;
  ctx.strokeRect(30, 30, 1140, 1740);

  // Header: Brand & Date
  ctx.fillStyle = "#000000";
  ctx.font = "bold 44px Arial, sans-serif";
  ctx.fillText(from.name.toUpperCase(), 60, 110);

  ctx.font = "26px Arial, sans-serif";
  ctx.fillStyle = "#666666";
  const dateStr = new Date(l.date).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });
  ctx.fillText(dateStr, 60, 155);

  // Courier right header
  ctx.textAlign = "right";
  ctx.fillStyle = "#666666";
  ctx.font = "24px Arial, sans-serif";
  ctx.fillText("COURIER", 1140, 105);
  ctx.fillStyle = "#000000";
  ctx.font = "bold 40px Arial, sans-serif";
  ctx.fillText(l.courier || "TRAX / TCS / LEOPARDS", 1140, 155);
  ctx.textAlign = "left";

  // Divider
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(30, 185);
  ctx.lineTo(1170, 185);
  ctx.stroke();

  // Barcode (Tracking or Order)
  const trackNum = l.trackingNumber || l.number;
  const { bars, width: bcWidth } = code128(trackNum);
  const bcBoxX = 80;
  const bcBoxY = 220;
  const bcTargetW = 1040;
  const bcH = 140;
  const scale = bcTargetW / bcWidth;

  ctx.fillStyle = "#000000";
  for (const [bx, bw] of bars) {
    ctx.fillRect(bcBoxX + bx * scale, bcBoxY, Math.max(1, bw * scale), bcH);
  }

  // Barcode text
  ctx.font = "bold 34px 'Courier New', monospace";
  ctx.textAlign = "center";
  ctx.fillText(trackNum, 600, 405);
  ctx.textAlign = "left";

  // DELIVER TO Section Box
  ctx.lineWidth = 4;
  ctx.strokeRect(60, 440, 1080, 510);

  // DELIVER TO Tag
  ctx.fillStyle = "#000000";
  ctx.fillRect(80, 465, 200, 42);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 22px Arial, sans-serif";
  ctx.fillText("DELIVER TO", 110, 495);

  // Recipient details
  ctx.fillStyle = "#000000";
  ctx.font = "bold 46px Arial, sans-serif";
  ctx.fillText(l.name, 85, 565);

  ctx.font = "bold 38px Arial, sans-serif";
  ctx.fillText("☎ " + localPhone(l.phone), 85, 625);

  ctx.font = "30px Arial, sans-serif";
  const addr = l.address + (l.postalCode ? ` · ${l.postalCode}` : "");
  const words = addr.split(" ");
  let line = "";
  let curY = 680;
  for (const w of words) {
    const testLine = line + w + " ";
    if (ctx.measureText(testLine).width > 980) {
      ctx.fillText(line, 85, curY);
      line = w + " ";
      curY += 44;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, 85, curY);

  // Destination City
  ctx.font = "bold 64px Arial, sans-serif";
  ctx.fillText(l.city.toUpperCase(), 85, 910);

  // COD & Open Parcel Boxes
  const cod = l.codDue > 0;
  if (cod) {
    ctx.fillStyle = "#000000";
    ctx.fillRect(60, 980, 520, 230);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 22px Arial, sans-serif";
    ctx.fillText("COLLECT CASH (COD)", 85, 1030);
    ctx.font = "bold 60px Arial, sans-serif";
    ctx.fillText(money(l.codDue), 85, 1120);
  } else {
    ctx.lineWidth = 4;
    ctx.strokeRect(60, 980, 520, 230);
    ctx.fillStyle = "#000000";
    ctx.font = "bold 22px Arial, sans-serif";
    ctx.fillText("PAYMENT STATUS", 85, 1030);
    ctx.font = "bold 52px Arial, sans-serif";
    ctx.fillText("PREPAID", 85, 1105);
    ctx.font = "22px Arial, sans-serif";
    ctx.fillText("Do not collect cash", 85, 1150);
  }

  // Open Parcel Box
  ctx.lineWidth = 4;
  ctx.strokeRect(620, 980, 520, 230);
  ctx.fillStyle = "#000000";
  ctx.font = "bold 22px Arial, sans-serif";
  ctx.fillText("OPEN PARCEL POLICY", 645, 1030);
  ctx.font = "bold 42px Arial, sans-serif";
  ctx.fillText(l.openParcel ? "✔ ALLOWED" : "✘ NOT ALLOWED", 645, 1095);
  ctx.font = "22px Arial, sans-serif";
  ctx.fillStyle = "#555555";
  ctx.fillText(l.openParcel ? "Customer may inspect before paying" : "Payment first, then open", 645, 1150);

  // Order Details
  ctx.fillStyle = "#000000";
  ctx.font = "bold 26px Arial, sans-serif";
  ctx.fillText(`ORDER: #${l.number}`, 60, 1260);
  ctx.fillText(`PIECES: ${l.pieces}`, 450, 1260);
  ctx.fillText(`WEIGHT: ${(l.weightGrams / 1000).toFixed(2)} kg`, 750, 1260);
  ctx.fillText(`CONTENTS: ${contents}`, 60, 1310);

  // Items summary
  ctx.font = "24px Arial, sans-serif";
  ctx.fillStyle = "#333333";
  let itemsY = 1360;
  for (const it of l.items.slice(0, 3)) {
    ctx.fillText(`• ${it.qty}x ${it.name} (${it.model || ""}) - ${it.color}`, 60, itemsY);
    itemsY += 35;
  }

  // Note if any
  if (l.notes) {
    ctx.fillStyle = "#b45309";
    ctx.font = "bold 24px Arial, sans-serif";
    ctx.fillText(`NOTE: ${l.notes}`, 60, 1500);
  }

  // Return to footer
  ctx.fillStyle = "#000000";
  ctx.fillRect(60, 1560, 280, 42);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 22px Arial, sans-serif";
  ctx.fillText("FROM / RETURN TO", 75, 1590);

  ctx.fillStyle = "#000000";
  ctx.font = "bold 32px Arial, sans-serif";
  ctx.fillText(from.name, 60, 1645);
  ctx.font = "26px Arial, sans-serif";
  ctx.fillText(`${from.address} · Support: ${from.phone}`, 60, 1690);

  // Trigger download
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Magora-Label-#${l.number}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }, "image/png");
}

/** One parcel label, A6 / 4×6 inch */
function ParcelLabel({ l, from, contents, onDownload }: { l: Label; from: Data["from"]; contents: string; onDownload: () => void }) {
  const cod = l.codDue > 0;
  return (
    <div className="relative group">
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

      <button
        type="button"
        onClick={onDownload}
        className="no-print absolute top-3 right-3 rounded-lg bg-black/85 hover:bg-black text-white text-[11px] font-bold px-2.5 py-1.5 flex items-center gap-1.5 shadow-lg opacity-80 group-hover:opacity-100 transition cursor-pointer"
        title="Download this label as PNG image"
      >
        <span>💾 Download Image</span>
      </button>
    </div>
  );
}

/** Packing / pick list */
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

  const handleDownloadAll = () => {
    if (!data) return;
    data.labels.forEach((l, idx) => {
      setTimeout(() => downloadLabelImage(l, data.from, data.contents), idx * 350);
    });
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
          {view === "labels" && (
            <button 
              type="button" 
              className="btn btn-secondary h-10 px-4 text-sm inline-flex items-center gap-1.5"
              onClick={handleDownloadAll}
              title="Download all labels as PNG image files for printing later"
            >
              <span>🖼 Download All Images</span>
            </button>
          )}
          <button className="btn btn-primary h-10 px-5 text-sm" onClick={print}>🖨 Print</button>
        </div>
        {view === "labels" ? (
          <div className="sheet">
            {data.labels.map((l) => (
              <ParcelLabel
                key={l.number}
                l={l}
                from={data.from}
                contents={data.contents}
                onDownload={() => downloadLabelImage(l, data.from, data.contents)}
              />
            ))}
          </div>
        ) : (
          <PickList labels={data.labels} />
        )}
      </div>
    );
  }
}

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
  .phone { font-size: 11pt; font-weight: 700; }
  .addr { font-size: 9.5pt; flex: 1; overflow: hidden; }
  .city { font-size: 14pt; font-weight: 900; letter-spacing: .04em; margin-top: auto; }
  .boxes { gap: 2mm; }
  .box { flex: 1; border: 1.5px solid #000; border-radius: 2mm; padding: 2mm; display: flex; flex-direction: column; justify-content: center; }
  .box span { font-size: 6.5pt; letter-spacing: .06em; }
  .box b { font-size: 15pt; line-height: 1.1; }
  .box b.small { font-size: 10.5pt; }
  .box em { font-style: normal; font-size: 6.5pt; color: #555; margin-top: .5mm; }
  .box.cod { background: #000; color: #fff; border-color: #000; }
  .box.open { background: #f5f5f5; }
  .box.closed { background: #fafafa; border-style: dashed; }
  .order { align-items: center; justify-content: space-between; border-top: 1px dashed #888; border-bottom: 1px dashed #888; padding: 1.5mm 0; }
  .ordbc { display: flex; flex-direction: column; align-items: flex-start; }
  .ordbc .bc { width: 42mm; height: 7mm; }
  .ordbc .mono { font-size: 8.5pt; }
  .meta { display: flex; flex-direction: column; font-size: 7.5pt; text-align: right; }
  .meta span b { font-weight: 700; }
  .note { background: #fff8e6; border: 1px solid #ffd666; border-radius: 1.5mm; padding: 1mm 2mm; font-size: 7.5pt; font-weight: 600; margin: 0; }
  .from { font-size: 7pt; color: #444; }
  @media print {
    body { background: #fff; }
    .no-print { display: none !important; }
    .sheet { gap: 0; }
    .label { page-break-after: always; break-after: page; border: none; }
  }
`;
