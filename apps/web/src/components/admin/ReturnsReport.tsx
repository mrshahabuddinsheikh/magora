"use client";

import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { api } from "@/lib/client-api";
import { cn, dateTime, money } from "@/lib/format";
import { Empty } from "./ui";

type G = { key: string; label: string; sent: number; returned: number; delivered: number; lost: number; rate: number; extra?: string };
type Report = {
  days: number;
  totals: { sent: number; delivered: number; inTransit: number; returned: number; rto: number; customer: number; rate: number; lost: number; valueReturned: number };
  byReason: { reason: string; n: number }[];
  byCity: G[]; byCourier: G[]; byCourierCity: G[]; byCustomer: G[]; byProduct: G[]; byModel: G[];
  recent: { number: string; name: string; phone: string; city: string; total: number; type: string; reason: string | null; courier: string; returnedAt: string }[];
};

const RANGES = [[30, "30 days"], [90, "90 days"], [365, "1 year"], [0, "All time"]] as const;

/** Return % colour: green under 10, amber under 25, red above */
const rateCls = (r: number) => (r >= 25 ? "bg-[#fde8e8] text-danger" : r >= 10 ? "bg-[#fff4e0] text-[#a15c00]" : "bg-[#e9f8ef] text-success");

function Table({ title, hint, rows, first, onBlock }: { title: string; hint?: string; rows: G[]; first: string; onBlock?: (phone: string) => void }) {
  const max = Math.max(1, ...rows.map((r) => r.returned));
  return (
    <section className="card overflow-hidden">
      <header className="border-b border-line px-4 py-3">
        <h3 className="text-[15px] font-bold">{title}</h3>
        {hint && <p className="text-[12px] text-muted">{hint}</p>}
      </header>
      {!rows.length ? (
        <Empty>Abhi data nahi.</Empty>
      ) : (
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 bg-white/95 text-left text-[11.5px] uppercase tracking-wide text-muted backdrop-blur">
              <tr>
                <th className="px-4 py-2 font-semibold">{first}</th>
                <th className="px-2 py-2 text-right font-semibold">Sent</th>
                <th className="px-2 py-2 text-right font-semibold">Returned</th>
                <th className="px-2 py-2 text-right font-semibold">Return %</th>
                <th className="px-4 py-2 text-right font-semibold">Loss</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.key}>
                  <td className="px-4 py-2">
                    <span className="font-medium">{r.label}</span>
                    {r.extra && (
                      <span className="ml-1.5 font-mono text-[12px] text-muted">
                        {r.extra}
                        {onBlock && (
                          <>
                            <a href={`https://wa.me/${r.extra.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="ml-2 inline-grid h-6 w-6 place-items-center rounded-full text-[#128c4b] hover:bg-black/5" aria-label="WhatsApp"><MessageCircle size={13} /></a>
                            <button onClick={() => onBlock(r.extra!)} className="ml-1 rounded-full px-2 py-0.5 text-[11px] font-semibold text-danger hover:bg-danger/10">Block</button>
                          </>
                        )}
                      </span>
                    )}
                    <div className="mt-1 h-1 w-full max-w-[200px] overflow-hidden rounded-full bg-black/[0.05]">
                      <div className="h-full rounded-full bg-danger/70" style={{ width: `${(r.returned / max) * 100}%` }} />
                    </div>
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{r.sent}</td>
                  <td className="px-2 py-2 text-right font-semibold tabular-nums">{r.returned}</td>
                  <td className="px-2 py-2 text-right"><span className={cn("rounded-full px-2 py-0.5 text-[12px] font-bold tabular-nums", rateCls(r.rate))}>{r.rate}%</span></td>
                  <td className="px-4 py-2 text-right tabular-nums text-muted">{r.lost ? money(r.lost) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function ReturnsReport({ openOrder }: { openOrder: (n: string) => void }) {
  const [days, setDays] = useState(90);
  const [r, setR] = useState<Report | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    queueMicrotask(() => setR(null));
    api<{ data: Report }>(`/admin/reports/returns?days=${days}`).then((x) => setR(x.data));
  }, [days]);

  const block = async (phone: string) => {
    if (!confirm(`Block ${phone} from Cash on Delivery?`)) return;
    await api("/admin/blacklist", { method: "POST", json: { phone, reason: "Many returns (returns report)" } });
    setToast(`${phone} blocked`);
    setTimeout(() => setToast(null), 2200);
  };

  const t = r?.totals;
  const maxReason = Math.max(1, ...(r?.byReason.map((x) => x.n) ?? [1]));
  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center gap-2 p-3">
        {RANGES.map(([d, l]) => (
          <button key={d} onClick={() => setDays(d)} className={cn("rounded-full px-4 py-2 text-sm font-medium", days === d ? "bg-ink text-white" : "bg-black/[0.04]")}>{l}</button>
        ))}
        <p className="ml-auto text-[12.5px] text-muted">Return % = wapas aaye ÷ jo parcels bheje gaye (courier ko diye)</p>
      </div>

      {!r || !t ? (
        <div className="skeleton h-80 rounded-[24px]" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {[
              ["Parcels sent", String(t.sent), `${t.delivered} delivered · ${t.inTransit} on the way`],
              ["Returned", String(t.returned), `${t.rto} courier · ${t.customer} customer`],
              ["Return rate", `${t.rate}%`, t.rate >= 25 ? "Bohat zyada — neeche dekhein kahan se" : t.rate >= 10 ? "Theek hai, kam kar sakte hain" : "Bohat achha"],
              ["Money lost", money(t.lost), "Delivery + return charges"],
              ["Goods came back", money(t.valueReturned), "Order value of returns"],
            ].map(([k, v, h]) => (
              <div key={k} className="card p-4">
                <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">{k}</p>
                <p className={cn("mt-1 text-[24px] font-bold tabular-nums", k === "Return rate" && (t.rate >= 25 ? "text-danger" : t.rate >= 10 ? "text-[#a15c00]" : "text-success"))}>{v}</p>
                <p className="text-[12px] text-muted">{h}</p>
              </div>
            ))}
          </div>

          <section className="card p-4">
            <h3 className="mb-3 text-[15px] font-bold">Wapas kyun aaye? (reasons)</h3>
            {!r.byReason.length ? (
              <p className="text-sm text-muted">Abhi koi return nahi.</p>
            ) : (
              <ul className="space-y-2">
                {r.byReason.map((x) => (
                  <li key={x.reason} className="flex items-center gap-3 text-[13px]">
                    <span className="w-56 shrink-0 truncate">{x.reason}</span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-black/[0.05]">
                      <div className="h-full rounded-full bg-danger/70" style={{ width: `${(x.n / maxReason) * 100}%` }} />
                    </div>
                    <b className="w-8 text-right tabular-nums">{x.n}</b>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="grid gap-4 xl:grid-cols-2">
            <Table title="Customers who return most" hint="Zyada return karne walon ko block kar sakte hain" rows={r.byCustomer} first="Customer" onBlock={block} />
            <Table title="Cities" rows={r.byCity} first="City" />
            <Table title="Couriers" hint="Kaunsa courier zyada parcels wapas laata hai" rows={r.byCourier} first="Courier" />
            <Table title="Courier × city" hint="Kis shehar mein kaunsa courier kamzor hai" rows={r.byCourierCity} first="Courier · City" />
            <Table title="Products" rows={r.byProduct} first="Product" />
            <Table title="Phone models" rows={r.byModel} first="Phone model" />
          </div>

          <section className="card overflow-hidden">
            <h3 className="border-b border-line px-4 py-3 text-[15px] font-bold">Latest returns</h3>
            {!r.recent.length ? (
              <Empty>Abhi koi return nahi.</Empty>
            ) : (
              <ul className="divide-y divide-line text-[13px]">
                {r.recent.map((x) => (
                  <li key={x.number} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
                    <button onClick={() => openOrder(x.number)} className="font-mono font-bold hover:text-accent">#{x.number}</button>
                    <span>{x.name}</span>
                    <span className="font-mono text-[12px] text-muted">{x.phone}</span>
                    <span className="rounded-full bg-black/[0.05] px-2 py-0.5 text-[11.5px] font-semibold">{x.city}</span>
                    <span className="text-muted">{x.courier}</span>
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", x.type === "customer" ? "bg-[#fff4e0] text-[#a15c00]" : "bg-[#fde8e8] text-danger")}>{x.type === "customer" ? "Customer return" : "Courier return"}</span>
                    <span className="text-danger">{x.reason ?? "—"}</span>
                    <span className="ml-auto tabular-nums">{money(x.total)}</span>
                    <span className="text-[12px] text-muted">{dateTime(x.returnedAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
      {toast && <div className="fixed bottom-5 left-1/2 z-[70] -translate-x-1/2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white shadow-lg">{toast}</div>}
    </div>
  );
}
