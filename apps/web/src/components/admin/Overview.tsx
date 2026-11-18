"use client";

import { useEffect, useState, useMemo } from "react";
import { 
  AlertTriangle, Banknote, Bell, Package, RotateCcw, Truck, 
  MapPin, TrendingUp, ShoppingBag, Globe, Award, Compass
} from "lucide-react";
import { api } from "@/lib/client-api";
import { dateTime, money } from "@/lib/format";
import { Pill } from "./ui";

interface CityStat {
  city: string;
  orders: number;
  revenue: number;
}

interface Stats {
  series: { day: string; orders: number; revenue: number }[];
  byStatus: Record<string, number>;
  topProducts: { name: string; qty: number; revenue: number }[];
  cityStats?: CityStat[];
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

/** Pre-calibrated SVG Map Coordinates for Major Cities of Pakistan */
const PAKISTAN_CITIES: Record<string, { x: number; y: number; name: string; province: string }> = {
  karachi: { x: 145, y: 435, name: "Karachi", province: "Sindh" },
  lahore: { x: 360, y: 215, name: "Lahore", province: "Punjab" },
  islamabad: { x: 325, y: 135, name: "Islamabad", province: "Federal" },
  rawalpindi: { x: 320, y: 145, name: "Rawalpindi", province: "Punjab" },
  faisalabad: { x: 305, y: 225, name: "Faisalabad", province: "Punjab" },
  multan: { x: 260, y: 275, name: "Multan", province: "Punjab" },
  peshawar: { x: 280, y: 120, name: "Peshawar", province: "KPK" },
  gujranwala: { x: 350, y: 185, name: "Gujranwala", province: "Punjab" },
  sialkot: { x: 370, y: 175, name: "Sialkot", province: "Punjab" },
  quetta: { x: 125, y: 255, name: "Quetta", province: "Balochistan" },
  hyderabad: { x: 165, y: 410, name: "Hyderabad", province: "Sindh" },
  sukkur: { x: 185, y: 345, name: "Sukkur", province: "Sindh" },
  bahawalpur: { x: 275, y: 310, name: "Bahawalpur", province: "Punjab" },
  abbottabad: { x: 335, y: 110, name: "Abbottabad", province: "KPK" },
  sargodha: { x: 295, y: 195, name: "Sargodha", province: "Punjab" },
  gujrat: { x: 345, y: 170, name: "Gujrat", province: "Punjab" },
};

export function Overview({ go }: { go: (tab: string, extra?: string) => void }) {
  const [s, setS] = useState<Stats | null>(null);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);

  useEffect(() => {
    api<{ data: Stats }>("/admin/stats").then((r) => setS(r.data));
  }, []);

  const totalMapOrders = useMemo(() => {
    return s?.cityStats?.reduce((a, b) => a + b.orders, 0) || s?.last30Days?.orders || 1;
  }, [s]);

  if (!s) return <div className="skeleton h-96 rounded-[28px]" />;
  const max = Math.max(1, ...s.series.map((d) => d.revenue));

  const tiles: [string, string | number, string, typeof Truck, () => void][] = [
    ["Today", money(s.today.revenue), `${s.today.orders} orders`, Banknote, () => go("orders")],
    ["COD to confirm", s.codToConfirm ?? s.pendingOrders, "WhatsApp / call & confirm", Package, () => go("confirm")],
    ["On the road", s.deliveriesOnRoad, "Live deliveries", Truck, () => go("deliveries")],
    ["Open returns", s.openReturns, "Need action", RotateCcw, () => go("returns")],
  ];

  // Merge backend cityStats with geographical map coordinates
  const mappedCities = Object.entries(PAKISTAN_CITIES).map(([key, info]) => {
    const found = s.cityStats?.find((c) => c.city.toLowerCase().includes(key) || key.includes(c.city.toLowerCase()));
    const orders = found ? found.orders : 0;
    const revenue = found ? found.revenue : 0;
    const pct = totalMapOrders > 0 ? Math.round((orders / totalMapOrders) * 100) : 0;
    return {
      key,
      ...info,
      orders,
      revenue,
      pct,
    };
  }).sort((a, b) => b.orders - a.orders);

  return (
    <div className="space-y-5">
      {/* 4 Summary Cards */}
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

      {/* COD Rule banner */}
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

      {/* 14 Days Revenue Chart & Status Breakdown */}
      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <div className="card p-5">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="font-bold flex items-center gap-2">
                <span>Sales Overview — Last 14 Days</span>
                <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-bold text-accent">Real-Time</span>
              </h2>
              <p className="text-sm text-muted">30 days: {money(s.last30Days.revenue)} from {s.last30Days.orders} orders</p>
            </div>
          </div>
          <div className="mt-5 flex h-48 items-end gap-1.5" role="img" aria-label="Daily revenue bar chart">
            {s.series.map((d) => (
              <div key={d.day} className="group relative flex h-full flex-1 flex-col justify-end">
                <div 
                  className="rounded-t-lg bg-gradient-to-t from-[#4a65ff] to-[#8b5cf6] transition group-hover:from-[#3653ff]" 
                  style={{ height: `${Math.max(2, (d.revenue / max) * 100)}%`, opacity: d.revenue ? 1 : 0.18 }} 
                />
                <span className="pointer-events-none absolute -top-9 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink px-2 py-1 text-[11px] text-white group-hover:block z-10 shadow-lg">
                  {money(d.revenue)} · {d.orders} orders
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

      {/* ───── Pakistan Geographic Sales Map & City Analytics ───── */}
      <div className="card p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-line">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🗺️</span>
              <h2 className="text-lg font-black text-ink">Pakistan Geographic Sales Map & City Analytics</h2>
              <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10.5px] font-bold text-emerald-600">
                Live Heatmap
              </span>
            </div>
            <p className="text-xs text-muted">
              Discover which cities across Pakistan generate the highest order volume and revenue for Magora.
            </p>
          </div>
          {selectedCity && (
            <button
              onClick={() => setSelectedCity(null)}
              className="text-xs text-accent hover:underline font-semibold"
            >
              Reset Map Selection
            </button>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          {/* SVG Map of Pakistan */}
          <div className="relative rounded-2xl bg-gradient-to-br from-[#0c1017] to-[#161c28] p-4 text-white overflow-hidden shadow-inner flex flex-col justify-between min-h-[380px]">
            {/* Ambient Background Grid */}
            <div 
              className="absolute inset-0 opacity-10 pointer-events-none"
              style={{ backgroundImage: "radial-gradient(#4a65ff 1px, transparent 1px)", backgroundSize: "20px 20px" }}
            />

            <div className="relative z-10 flex items-center justify-between text-xs text-zinc-400">
              <span className="flex items-center gap-1.5">
                <Compass size={14} className="text-accent" />
                <span>Pakistan Delivery Hubs</span>
              </span>
              <span className="text-[11px] font-mono text-zinc-500">Coordinate Grid 24°N - 37°N</span>
            </div>

            {/* Pakistan Map SVG */}
            <div className="relative w-full max-w-[420px] mx-auto my-auto aspect-[4/4.2]">
              <svg viewBox="0 0 500 520" className="w-full h-full drop-shadow-2xl">
                {/* Stylized Pakistan Country Outline */}
                <path
                  d="M 120 220 
                     L 160 180 
                     L 240 130 
                     L 290 80 
                     L 350 70 
                     L 400 90 
                     L 420 140 
                     L 380 180 
                     L 380 250 
                     L 330 300 
                     L 290 350 
                     L 220 400 
                     L 170 470 
                     L 120 480 
                     L 100 440 
                     L 80 360 
                     L 60 300 
                     L 90 250 Z"
                  fill="#1b2434"
                  stroke="#2d3b55"
                  strokeWidth="2.5"
                  strokeDasharray="4 4"
                />

                {/* Province Separators */}
                <path d="M 160 180 Q 230 260 220 400" fill="none" stroke="#253248" strokeWidth="1.5" />
                <path d="M 240 130 Q 300 210 380 250" fill="none" stroke="#253248" strokeWidth="1.5" />
                <path d="M 220 400 L 120 480" fill="none" stroke="#253248" strokeWidth="1.5" />

                {/* City Pins */}
                {mappedCities.map((c) => {
                  const isHovered = selectedCity === c.key;
                  const hasOrders = c.orders > 0;
                  const radius = hasOrders ? Math.max(7, Math.min(18, 7 + c.orders * 2.5)) : 5;

                  return (
                    <g 
                      key={c.key} 
                      className="cursor-pointer transition-transform"
                      onClick={() => setSelectedCity(c.key)}
                      onMouseEnter={() => setSelectedCity(c.key)}
                    >
                      {/* Pulse Wave for Active Cities */}
                      {hasOrders && (
                        <circle
                          cx={c.x}
                          cy={c.y}
                          r={radius * 1.8}
                          fill="#4a65ff"
                          opacity="0.25"
                          className="animate-ping"
                        />
                      )}

                      {/* Main Node */}
                      <circle
                        cx={c.x}
                        cy={c.y}
                        r={radius}
                        fill={isHovered ? "#38bdf8" : hasOrders ? "#4a65ff" : "#475569"}
                        stroke="#ffffff"
                        strokeWidth={isHovered ? "2.5" : "1.5"}
                        className="transition-all duration-200"
                      />

                      {/* City Name Label */}
                      <text
                        x={c.x + radius + 4}
                        y={c.y + 4}
                        fontSize={isHovered ? "13" : "10.5"}
                        fontWeight={isHovered || hasOrders ? "bold" : "normal"}
                        fill={isHovered ? "#38bdf8" : hasOrders ? "#f8fafc" : "#64748b"}
                        className="select-none pointer-events-none drop-shadow"
                      >
                        {c.name} {hasOrders ? `(${c.orders})` : ""}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Selected City Tooltip Footer */}
            <div className="relative z-10 rounded-xl bg-black/60 backdrop-blur-md p-3 border border-white/10 flex items-center justify-between text-xs">
              {(() => {
                const active = mappedCities.find((c) => c.key === (selectedCity || mappedCities[0]?.key));
                if (!active) return <span>Click on any city to inspect details</span>;
                return (
                  <>
                    <div className="flex items-center gap-2">
                      <MapPin size={16} className="text-accent shrink-0" />
                      <div>
                        <p className="font-bold text-white text-sm">{active.name} ({active.province})</p>
                        <p className="text-[11px] text-zinc-400">
                          {active.orders > 0 ? `${active.orders} total orders · ${active.pct}% of store volume` : "No orders yet in this region"}
                        </p>
                      </div>
                    </div>
                    {active.revenue > 0 && (
                      <div className="text-right">
                        <span className="text-[10px] text-zinc-400">Total Sales</span>
                        <p className="font-bold text-emerald-400 text-sm tabular-nums">{money(active.revenue)}</p>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>

          {/* City Leaderboard Table */}
          <div className="space-y-3 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-ink mb-2 flex items-center gap-1.5">
                <Award size={16} className="text-amber-500" />
                <span>Top Delivery Cities Leaderboard</span>
              </h3>
              <p className="text-xs text-muted mb-3">
                Real customer delivery destinations across Pakistan ranked by order volume:
              </p>

              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {mappedCities.filter((c) => c.orders > 0).map((c, i) => (
                  <div
                    key={c.key}
                    onClick={() => setSelectedCity(c.key)}
                    className={`card p-3 flex items-center justify-between transition cursor-pointer border ${
                      selectedCity === c.key ? "border-accent bg-accent/5" : "border-line hover:border-black/20"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`grid h-6 w-6 place-items-center rounded-full text-xs font-black ${
                        i === 0 ? "bg-amber-500 text-white" : i === 1 ? "bg-zinc-300 text-zinc-800" : i === 2 ? "bg-amber-700 text-white" : "bg-black/5 dark:bg-white/5 text-muted"
                      }`}>
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-xs font-bold text-ink">{c.name}</p>
                        <p className="text-[11px] text-muted">{c.province} · {c.orders} orders</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-ink tabular-nums">{c.revenue > 0 ? money(c.revenue) : "—"}</p>
                      <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent">
                        {c.pct}% share
                      </span>
                    </div>
                  </div>
                ))}

                {mappedCities.filter((c) => c.orders > 0).length === 0 && (
                  <div className="rounded-xl border border-dashed border-line p-6 text-center text-xs text-muted">
                    <span>No city orders placed yet. Orders will automatically populate the live map.</span>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl bg-accent/5 border border-accent/15 p-3.5 flex items-center justify-between text-xs">
              <div>
                <p className="font-bold text-ink">Nationwide Coverage</p>
                <p className="text-[11px] text-muted">Leopards, Trax, TCS, PostEx & M&P delivery integration</p>
              </div>
              <button onClick={() => go("orders")} className="btn btn-primary text-xs h-8 px-3 font-semibold">
                View All Orders &rarr;
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Orders & Top Products (30 Days) */}
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
