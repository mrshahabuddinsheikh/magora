"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/client-api";
import { money } from "@/lib/format";
import { STORE_NAME } from "@/lib/config";
import type { Order } from "@/lib/types";

/** Printable invoice + packing slip (A5/A4). Ctrl+P → Save as PDF or print. */
export function InvoiceClient() {
  const { number } = useParams<{ number: string }>();
  const [o, setO] = useState<Order | null>(null);
  useEffect(() => {
    api<{ data: Order }>(`/admin/orders/${number}`).then((r) => setO(r.data));
  }, [number]);
  if (!o) return <p className="p-10 text-center text-muted">Loading… (log in to the admin panel first)</p>;
  const cod = o.paymentMethod === "cod" && o.paymentStatus !== "paid";
  return (
    <div className="mx-auto max-w-[780px] bg-white p-8 text-[13px] text-black print:p-0">
      <style>{`@media print { header, footer, .ambient, .no-print { display:none !important } body { background:#fff } main { padding:0 !important; max-width:none !important } }`}</style>
      <div className="no-print mb-4 flex justify-end gap-2">
        <button className="btn btn-primary h-10 text-sm" onClick={() => window.print()}>Print / Save PDF</button>
      </div>
      <div className="flex items-start justify-between border-b-2 border-black pb-4">
        <div>
          <p className="text-2xl font-bold uppercase tracking-[0.2em]">{STORE_NAME}</p>
          <p className="text-xs text-neutral-500">MagSafe-compatible cases</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold">INVOICE</p>
          <p>{o.number}</p>
          <p className="text-neutral-500">{new Date(o.createdAt).toLocaleDateString("en-PK", { day: "numeric", month: "long", year: "numeric" })}</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-6">
        <div>
          <p className="text-xs font-bold uppercase text-neutral-500">Ship to</p>
          <p className="mt-1 text-base font-bold">{o.customer.name}</p>
          <p>{o.customer.phone}</p>
          <p>{o.address.line1}{o.address.area ? `, ${o.address.area}` : ""}</p>
          <p className="font-semibold">{o.address.city}</p>
          {o.notes && <p className="mt-1 italic">Note: {o.notes}</p>}
        </div>
        <div className="text-right">
          <p className="text-xs font-bold uppercase text-neutral-500">Payment</p>
          <p className="mt-1">{o.paymentMethod === "cod" ? "Cash on Delivery" : o.paymentMethod}</p>
          {o.shipment && <p className="mt-2">{o.shipment.courierName}{o.shipment.trackingNumber ? ` · ${o.shipment.trackingNumber}` : ""}</p>}
          {cod && (
            <div className="mt-3 inline-block border-2 border-black px-4 py-2 text-left">
              <p className="text-xs font-bold uppercase">Collect (COD)</p>
              <p className="text-2xl font-bold">{money(o.totals.total)}</p>
            </div>
          )}
        </div>
      </div>
      <table className="mt-6 w-full border-collapse">
        <thead><tr className="border-b border-black text-left text-xs uppercase"><th className="py-2">Item</th><th>Phone / colour</th><th>SKU</th><th className="text-right">Qty</th><th className="text-right">Price</th><th className="text-right">Total</th></tr></thead>
        <tbody>
          {o.items.map((i) => (
            <tr key={i.id} className="border-b border-neutral-200">
              <td className="py-2 font-semibold">{i.productName}</td>
              <td>
                {[i.modelName, i.colorName].filter(Boolean).join(" · ")}
                {i.custom?.coverage && <div className="text-xs">{i.custom.coverage === "back_sides" ? "Back + sides" : "Back only"}</div>}
                {i.custom?.imageUrl && <div className="text-xs font-semibold">Custom photo: {i.custom.imageUrl.split("/").pop()}</div>}
              </td>
              <td className="text-xs">{i.sku}</td>
              <td className="text-right">{i.qty}</td>
              <td className="text-right">{money(i.unitPrice)}</td>
              <td className="text-right">{money(i.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="ml-auto mt-4 w-64 space-y-1">
        <div className="flex justify-between"><span>Subtotal</span><span>{money(o.totals.subtotal)}</span></div>
        {o.totals.discount > 0 && <div className="flex justify-between"><span>Discount</span><span>−{money(o.totals.discount)}</span></div>}
        <div className="flex justify-between"><span>Delivery</span><span>{o.totals.shipping ? money(o.totals.shipping) : "Free"}</span></div>
        <div className="flex justify-between border-t border-black pt-1 text-base font-bold"><span>Total</span><span>{money(o.totals.total)}</span></div>
      </div>
      <p className="mt-10 border-t border-dashed border-neutral-400 pt-3 text-center text-xs text-neutral-500">
        Thank you for shopping with {STORE_NAME}! 7-day exchange on unused items in original packaging. Track your order on our website with {o.number}.
      </p>
    </div>
  );
}
