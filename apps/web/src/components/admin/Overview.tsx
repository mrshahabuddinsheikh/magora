"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Banknote, Bell, Package, RotateCcw, Truck } from "lucide-react";
import { api } from "@/lib/client-api";
import { dateTime, money } from "@/lib/format";
import { Pill } from "./ui";

interface Stats {
  series: { day: string; orders: number; revenue: number }[];
  byStatus: Record<string, number>;
  topProducts: { name: string; qty: number; revenue: number }[];
  openReturns: number;
  deliveriesOnRoad: number;
  today: { orders: number; revenue: number };
  last30Days: { orders: number; revenue: number };
  pendingOrders: number;
  activeProducts: number;
  lowStockVariants: number;
  codToConfirm?: number;
  stockAlertsWaiting?: number;
  recentOrders: { number: string; customerName: string; city: string; total: number; status: string; createdAt: string }[];
}

export function Overview({ go }: { go: (tab: string, extra?: string) => void }) {
  const [s, setS] = useState<Stats | null>(null);
  useEffect(() => {
    api<{ data: Stats }>("/admin/stats").then((r) => setS(r.data));
  }, []);
  if (!s) return <div className="skeleton h-96 rounded-[28px]" />;
  const max = Math.max(1, ...s.series.map((d) => d.revenue));

  const tiles: [string, string | number, string, typeof Truck, () => void][] = [
    ["Today", money(s.today.revenue), `${s.today.orders} orders`, Banknote, () => go("orders")],
    ["COD to confirm", s.codToConfirm ?? s.pendingOrders, "WhatsApp / call & confirm", Package, () => go("confirm")],
    ["On the road", s.deliveriesOnRoad, "Live deliveries", Truck, () => go("deliveries")],
    ["Open returns", s.openReturns, "Need action", RotateCcw, () => go("returns")],
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map(([l, v, sub, I, on]) => (
          <button key={l} onClick={on} className="card p-5 text-left transition hover:-translate-y-0.5">
            <I size={18} className="text-accent" />
            <p className="mt-2 text-sm text-muted">{l}</p>
            <p className="text-3xl font-bold tabular-nums">{v}</p>
            <p className="text-sm text-muted">{sub}</p>
          </button>
        ))}
      </div>

      <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-3.5 flex items-center justify-between text-xs sm:text-sm">
        <div className="flex items-center gap-2.5">
          <Banknote size={18} className="text-emerald-600 shrink-0" />
          <span className="text-emerald-900 dark:text-emerald-300">
            <b>Cash on Delivery (COD) Rules:</b> Under Rs.2,000 &rarr; <b>Rs.50 fee</b> | Rs.2,000+ &rarr; <b>Rs.100 fee</b> (Rs.0 on online payments)
          </span>
        </div>
        <button
          onClick={() => go("cod-settings")}
          className="ml-3 shrink-0 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 text-xs font-bold transition shadow-sm"
        >
          Manage Fees &rarr;
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <div className="card p-5">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="font-bold">Sales — last 14 days</h2>
              <p className="text-sm text-muted">30 days: {money(s.last30Days.revenue)} from {s.last30Days.orders} orders</p>
            </div>
          </div>
          <div className="mt-5 flex h-48 items-end gap-1.5" role="img" aria-label="Daily revenue bar chart">
            {s.series.map((d) => (
              <div key={d.day} className="group relative flex h-full flex-1 flex-col justify-end">
                <div className="rounded-t-lg bg-gradient-to-t from-[#4a65ff] to-[#8b5cf6] transition group-hover:from-[#3653ff]" style={{ height: `${Math.max(2, (d.revenue / max) * 100)}%`, opacity: d.revenue ? 1 : 0.18 }} />
                <span className="pointer-events-none absolute -top-9 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink px-2 py-1 text-[11px] text-white group-hover:block">
                  {money(d.revenue)} · {d.orders}
                </span>
                <span className="mt-1 text-center text-[10px] text-muted">{d.day.slice(8)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card p-5">
          <h2 className="font-bold">Orders by status</h2>
          <ul className="mt-3 space-y-2">
            {Object.entries(s.byStatus).map(([k, v]) => (
              <li key={k} className="flex items-center justify-between">
                <button onClick={() => go("orders", k)}><Pill s={k} /></button>
                <span className="font-semibold tabular-nums">{v}</span>
              </li>
            ))}
            {Object.keys(s.byStatus).length === 0 && <li className="text-sm text-muted">No orders yet</li>}
          </ul>
          {s.lowStockVariants > 0 && (
            <p className="mt-4 flex items-center gap-2 rounded-xl bg-[#fff4e0] p-3 text-sm text-[#a15c00]">
              <AlertTriangle size={16} /> {s.lowStockVariants} phone/colour options have 5 or fewer in stock
            </p>
          )}
          {!!s.stockAlertsWaiting && (
            <button onClick={() => go("alerts")} className="mt-2 flex w-full items-center gap-2 rounded-xl bg-[#eef1ff] p-3 text-left text-sm text-accent">
              <Bell size={16} /> {s.stockAlertsWaiting} customers are waiting for a product to come back in stock →
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="card p-5">
          <h2 className="font-bold">Recent orders</h2>
          <table className="mt-3 w-full text-sm">
            <tbody className="divide-y divide-line">
              {s.recentOrders.map((o) => (
                <tr key={o.number} className="cursor-pointer hover:bg-white/70" onClick={() => go("orders", `#${o.number}`)}>
                  <td className="py-2.5 font-semibold">{o.number}</td>
                  <td>{o.customerName}<span className="text-muted"> · {o.city}</span><div className="text-xs text-muted">{dateTime(o.createdAt)}</div></td>
                  <td className="text-right tabular-nums">{money(o.total)}</td>
                  <td className="text-right"><Pill s={o.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card p-5">
          <h2 className="font-bold">Top products (30 days)</h2>
          <ul className="mt-3 divide-y divide-line text-sm">
            {s.topProducts.map((p) => (
              <li key={p.name} className="flex justify-between py-2.5">
                <span>{p.name}</span>
                <span className="text-muted">{p.qty} sold · <b className="text-ink">{money(p.revenue)}</b></span>
              </li>
            ))}
            {s.topProducts.length === 0 && <li className="py-4 text-muted">No sales yet</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
