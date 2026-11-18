"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Banknote, BarChart3, Bell, Boxes, Building2, ClipboardList, Contact2, Database, Gift, LogOut, MessageSquare, Package, Palette, PhoneCall, PieChart, Radio, RotateCcw, ShieldCheck, Smartphone, Store, Tag, Truck, Users, Video } from "lucide-react";
import { useAuth } from "@/stores/auth";
import { cn } from "@/lib/format";
import { Logo } from "@/components/Header";
import { Overview } from "@/components/admin/Overview";
import { Orders } from "@/components/admin/Orders";
import { Coupons, Customers, Deliveries, Models, Products, Returns, Reviews } from "@/components/admin/Sections";
import { CodConfirm, StockAlerts } from "@/components/admin/Engage";
import { Desk } from "@/components/admin/Desk";
import { ReturnsReport } from "@/components/admin/ReturnsReport";
import { SecurityShield } from "@/components/admin/SecurityShield";
import { ProductBrandsManager } from "@/components/admin/ProductBrandsManager";
import { CategoriesStylesManager } from "@/components/admin/CategoriesStylesManager";
import { TrustSignalsManager } from "@/components/admin/TrustSignalsManager";
import { CustomerLeadsManager } from "@/components/admin/CustomerLeadsManager";
import { LeadCaptureSettingsManager } from "@/components/admin/LeadCaptureSettingsManager";
import { ReelsManager } from "@/components/admin/ReelsManager";
import { DatabaseBackupManager } from "@/components/admin/DatabaseBackupManager";
import { CodSettingsManager } from "@/components/admin/CodSettingsManager";
import { api } from "@/lib/client-api";

type Tab = "overview" | "backup" | "cod-settings" | "security" | "confirm" | "desk" | "return-report" | "alerts" | "orders" | "deliveries" | "returns" | "customers" | "leads" | "lead-capture" | "reels" | "products" | "brands" | "categories" | "trust" | "coupons" | "models" | "reviews";
const TABS: [Tab, string, typeof Store][] = [
  ["overview", "Dashboard", BarChart3],
  ["cod-settings", "Cash on Delivery (COD) Charges", Banknote],
  ["backup", "Database Backup & Restore", Database],
  ["security", "Cyber Security Shield", ShieldCheck],
  ["confirm", "Confirm COD orders", PhoneCall],
  ["desk", "Order desk · pack & ship", ClipboardList],
  ["orders", "Orders", Package],
  ["deliveries", "Live deliveries", Truck],
  ["returns", "Returns", RotateCcw],
  ["return-report", "Return analysis", PieChart],
  ["customers", "Customers", Users],
  ["leads", "WhatsApp Leads & Excel CRM", Contact2],
  ["lead-capture", "Lead Capture Popup & Voucher", Gift],
  ["reels", "TikTok & Insta Reels", Video],
  ["products", "Products & stock", Boxes],
  ["brands", "Brands & Companies", Building2],
  ["categories", "Categories & 3D Styles", Palette],
  ["trust", "Social Proof Popups", Radio],
  ["alerts", "Back-in-stock requests", Bell],
  ["coupons", "Coupons", Tag],
  ["models", "Phone models", Smartphone],
  ["reviews", "Reviews", MessageSquare],
];

export default function AdminPage() {
  const { user, ready, login, logout, init } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");
  const [extra, setExtra] = useState<string | undefined>();
  const [key, setKey] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [badges, setBadges] = useState<Partial<Record<Tab, number>>>({});

  useEffect(() => {
    if (!ready) init();
    const fromHash = () => {
      const h = window.location.hash.slice(1) as Tab;
      if (TABS.some(([t]) => t === h)) setTab(h);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [ready, init]);

  // little counters on the menu (refresh every minute)
  useEffect(() => {
    if (user?.role !== "admin") return;
    let last: number | null = null;
    const load = () =>
      api<{ data: { codToConfirm?: number; stockAlertsWaiting?: number; openReturns?: number; toPack?: number } }>("/admin/stats")
        .then((r) => {
          const n = r.data.codToConfirm ?? 0;
          if (last !== null && n > last) newOrderAlert(n - last);
          last = n;
          document.title = n ? `(${n}) Admin` : "Admin";
          setBadges({ confirm: r.data.codToConfirm, desk: r.data.toPack, alerts: r.data.stockAlertsWaiting, returns: r.data.openReturns });
        })
        .catch(() => {});
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [user?.role, key]);

  const go = (t: string, x?: string) => {
    setTab(t as Tab);
    setExtra(x);
    setKey((k) => k + 1);
    history.replaceState(null, "", `#${t}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!ready) return <div className="skeleton mx-auto mt-10 h-72 max-w-md rounded-[28px]" />;

  if (!user || user.role !== "admin")
    return (
      <div className="card mx-auto mt-10 max-w-md p-7">
        <Logo />
        <h1 className="mt-5 text-xl font-bold">Admin login</h1>
        {user && <p className="mt-1 text-sm text-danger">This account is not an admin.</p>}
        <form
          className="mt-4 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            try {
              setErr(null);
              await login(String(f.get("email")), String(f.get("password")));
            } catch (e) {
              setErr((e as Error).message);
            }
          }}
        >
          <input name="email" type="email" placeholder="Email" className="input" required autoComplete="username" />
          <input name="password" type="password" placeholder="Password" className="input" required autoComplete="current-password" />
          {err && <p className="text-sm text-danger">{err}</p>}
          <button className="btn btn-primary h-12 w-full">Log in</button>
        </form>
      </div>
    );

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 pb-10 pt-3 lg:grid-cols-[230px_minmax(0,1fr)]">
      <aside className="min-w-0 lg:sticky lg:top-4 lg:self-start">
        <div className="crystal rounded-[26px] p-3">
          <div className="px-2 pb-3 pt-1"><Logo /></div>
          <nav className="no-scrollbar flex gap-1 overflow-x-auto lg:flex-col">
            {TABS.map(([t, l, I]) => (
              <button
                key={t}
                onClick={() => go(t)}
                className={cn("flex shrink-0 items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left text-[14px] font-medium transition", tab === t ? "bg-white shadow-sm" : "text-ink/70 hover:bg-white/60")}
              >
                <I size={16} /> {l}
                {!!badges[t] && <span className="ml-auto rounded-full bg-[#e11d74] px-1.5 py-0.5 text-[10.5px] font-bold leading-none text-white">{badges[t]}</span>}
              </button>
            ))}
          </nav>
          <div className="mt-2 flex gap-1 border-t border-white/70 pt-2 lg:flex-col">
            <Link href="/" className="flex items-center gap-2.5 rounded-2xl px-3 py-2.5 text-[14px] text-ink/70 hover:bg-white/60"><Store size={16} /> View store</Link>
            <button onClick={logout} className="flex items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left text-[14px] text-danger hover:bg-white/60"><LogOut size={16} /> Log out</button>
          </div>
        </div>
      </aside>
      <section className="min-w-0" key={key}>
        <h1 className="mb-4 text-[26px] font-bold tracking-tight">{TABS.find(([t]) => t === tab)?.[1]}</h1>
        {tab === "overview" && <Overview go={go} />}
        {tab === "cod-settings" && <CodSettingsManager />}
        {tab === "backup" && <DatabaseBackupManager />}
        {tab === "security" && <SecurityShield />}
        {tab === "confirm" && <CodConfirm openOrder={(n) => go("orders", `#${n}`)} />}
        {tab === "alerts" && <StockAlerts />}
        {tab === "desk" && <Desk openOrder={(n) => go("orders", `#${n}`)} />}
        {tab === "return-report" && <ReturnsReport openOrder={(n) => go("orders", `#${n}`)} />}
        {tab === "orders" && <Orders initial={extra} />}
        {tab === "deliveries" && <Deliveries openOrder={(n) => go("orders", `#${n}`)} />}
        {tab === "returns" && <Returns />}
        {tab === "customers" && <Customers openOrder={(n) => go("orders", `#${n}`)} />}
        {tab === "leads" && <CustomerLeadsManager />}
        {tab === "lead-capture" && <LeadCaptureSettingsManager />}
        {tab === "reels" && <ReelsManager />}
        {tab === "products" && <Products />}
        {tab === "brands" && <ProductBrandsManager />}
        {tab === "categories" && <CategoriesStylesManager />}
        {tab === "trust" && <TrustSignalsManager />}
        {tab === "coupons" && <Coupons />}
        {tab === "models" && <Models />}
        {tab === "reviews" && <Reviews />}
      </section>
    </div>
  );
}

/** "Ding-dong" + a desktop notification when a new order arrives while the admin panel is open */
function newOrderAlert(count: number) {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ac = new Ctx();
    [880, 660].forEach((f, i) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.frequency.value = f;
      o.connect(g).connect(ac.destination);
      const at = ac.currentTime + i * 0.22;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.25, at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.5);
      o.start(at);
      o.stop(at + 0.55);
    });
  } catch {}
  try {
    if ("Notification" in window && Notification.permission === "granted")
      new Notification(count > 1 ? `${count} new orders` : "New order!", { body: "Open “Confirm COD orders” to confirm it." });
    else if ("Notification" in window && Notification.permission === "default") Notification.requestPermission();
  } catch {}
}
