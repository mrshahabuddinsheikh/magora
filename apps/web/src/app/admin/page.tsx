"use client";

import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
import { 
  Banknote, BarChart3, Bell, Boxes, Building2, ClipboardList, Coins, Contact2, 
  Database, Gift, LogOut, MessageSquare, Package, Palette, PhoneCall, PieChart, 
  Radio, RotateCcw, ShieldCheck, Smartphone, Store, Tag, Truck, Users, Video, 
  Share2, Search, ChevronDown, ChevronRight, Webhook
} from "lucide-react";
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
import { LoyaltyManager } from "@/components/admin/LoyaltyManager";
import { ReelsManager } from "@/components/admin/ReelsManager";
import { DatabaseBackupManager } from "@/components/admin/DatabaseBackupManager";
import { CodSettingsManager } from "@/components/admin/CodSettingsManager";
import { MarketingPixelsManager } from "@/components/admin/MarketingPixelsManager";
import { SocialWebhooks } from "@/components/admin/SocialWebhooks";
import { api } from "@/lib/client-api";

export type Tab = 
  | "overview" 
  | "backup" 
  | "cod-settings" 
  | "security" 
  | "confirm" 
  | "desk" 
  | "return-report" 
  | "alerts" 
  | "orders" 
  | "deliveries" 
  | "returns" 
  | "customers" 
  | "leads" 
  | "lead-capture" 
  | "loyalty" 
  | "reels" 
  | "products" 
  | "brands" 
  | "categories" 
  | "trust" 
  | "coupons" 
  | "models" 
  | "reviews"
  | "marketing-pixels"
  | "social-webhooks";

interface TabItem {
  id: Tab;
  label: string;
  icon: typeof Store;
}

interface CategoryGroup {
  id: string;
  title: string;
  icon?: typeof Store;
  tabs: TabItem[];
}

const CATEGORIES: CategoryGroup[] = [
  {
    id: "operations",
    title: "Operations & Orders",
    tabs: [
      { id: "overview", label: "Dashboard & Analytics", icon: BarChart3 },
      { id: "confirm", label: "Confirm COD Orders", icon: PhoneCall },
      { id: "desk", label: "Pack & Ship Desk", icon: ClipboardList },
      { id: "orders", label: "All Orders", icon: Package },
      { id: "deliveries", label: "Live Deliveries", icon: Truck },
      { id: "returns", label: "Returns Management", icon: RotateCcw },
      { id: "return-report", label: "Return Analytics", icon: PieChart },
      { id: "alerts", label: "Back-in-Stock Alerts", icon: Bell },
    ],
  },
  {
    id: "catalog",
    title: "Catalog & 3D Studio",
    tabs: [
      { id: "products", label: "Products & Stock", icon: Boxes },
      { id: "models", label: "Phone Models & 3D GLB", icon: Smartphone },
      { id: "brands", label: "Brands & Companies", icon: Building2 },
      { id: "categories", label: "Categories & 3D Styles", icon: Palette },
      { id: "reviews", label: "Customer Reviews", icon: MessageSquare },
    ],
  },
  {
    id: "marketing",
    title: "Marketing & Ad Pixels",
    tabs: [
      { id: "marketing-pixels", label: "Meta, TikTok & Google Ads", icon: Share2 },
      { id: "social-webhooks", label: "Social Ads Webhooks (Meta & TikTok)", icon: Webhook },
      { id: "lead-capture", label: "Lead Capture Popup", icon: Gift },
      { id: "leads", label: "WhatsApp Leads CRM", icon: Contact2 },
      { id: "reels", label: "TikTok & Insta Reels", icon: Video },
      { id: "trust", label: "Social Proof Popups", icon: Radio },
      { id: "coupons", label: "Discount Coupons", icon: Tag },
    ],
  },
  {
    id: "pricing",
    title: "Pricing & Loyalty Engine",
    tabs: [
      { id: "cod-settings", label: "COD Delivery Fees", icon: Banknote },
      { id: "loyalty", label: "Magora Coins & Loyalty", icon: Coins },
      { id: "customers", label: "Customer Accounts", icon: Users },
    ],
  },
  {
    id: "system",
    title: "System & Security",
    tabs: [
      { id: "backup", label: "MySQL Backup & Restore", icon: Database },
      { id: "security", label: "Cyber Security Shield", icon: ShieldCheck },
    ],
  },
];

// Flat list of all tabs for quick lookup
const ALL_TABS: TabItem[] = CATEGORIES.flatMap((c) => c.tabs);

export default function AdminPage() {
  const { user, ready, login, logout, init } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");
  const [extra, setExtra] = useState<string | undefined>();
  const [key, setKey] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [badges, setBadges] = useState<Partial<Record<Tab, number>>>({});
  const [search, setSearch] = useState("");
  const [mobileCategory, setMobileCategory] = useState<string>("operations");

  useEffect(() => {
    if (!ready) init();
    const fromHash = () => {
      const h = window.location.hash.slice(1) as Tab;
      if (ALL_TABS.some((t) => t.id === h)) {
        setTab(h);
        // Find category
        const cat = CATEGORIES.find((c) => c.tabs.some((t) => t.id === h));
        if (cat) setMobileCategory(cat.id);
      }
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [ready, init]);

  // Counters refresh every 30 seconds
  useEffect(() => {
    if (user?.role !== "admin") return;
    let last: number | null = null;
    const load = () =>
      api<{ data: { codToConfirm?: number; stockAlertsWaiting?: number; openReturns?: number; toPack?: number } }>("/admin/stats")
        .then((r) => {
          const n = r.data.codToConfirm ?? 0;
          if (last !== null && n > last) newOrderAlert(n - last);
          last = n;
          document.title = n ? `(${n}) Magora Admin` : "Magora Admin";
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
    const cat = CATEGORIES.find((c) => c.tabs.some((item) => item.id === t));
    if (cat) setMobileCategory(cat.id);
    history.replaceState(null, "", `#${t}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Filter tabs if user types in search
  const filteredCategories = useMemo(() => {
    if (!search.trim()) return CATEGORIES;
    const q = search.toLowerCase();
    return CATEGORIES.map((cat) => ({
      ...cat,
      tabs: cat.tabs.filter((t) => t.label.toLowerCase().includes(q) || t.id.toLowerCase().includes(q)),
    })).filter((cat) => cat.tabs.length > 0);
  }, [search]);

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

  const currentTabObj = ALL_TABS.find((t) => t.id === tab);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 pb-12 pt-3 lg:grid-cols-[250px_minmax(0,1fr)]">
      {/* Sidebar */}
      <aside className="min-w-0 lg:sticky lg:top-4 lg:self-start">
        <div className="crystal rounded-[26px] p-3 shadow-sm border border-black/5 dark:border-white/10 max-h-[calc(100vh-2rem)] flex flex-col">
          <div className="px-2 pb-3 pt-1 flex items-center justify-between">
            <Logo />
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary uppercase tracking-wider">
              Admin
            </span>
          </div>

          {/* Quick Filter Search */}
          <div className="relative mb-2 px-1">
            <Search size={14} className="absolute left-3 top-2.5 text-ink/40" />
            <input
              type="text"
              placeholder="Search tabs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl bg-black/5 dark:bg-white/5 pl-8 pr-3 py-1.5 text-xs font-medium text-ink outline-none placeholder:text-ink/40 focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Mobile Category Switcher Pills */}
          <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-2 lg:hidden">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setMobileCategory(cat.id)}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition",
                  mobileCategory === cat.id
                    ? "bg-primary text-white shadow-sm"
                    : "bg-white/70 dark:bg-white/10 text-ink/70 hover:bg-white"
                )}
              >
                {cat.title}
              </button>
            ))}
          </div>

          {/* Navigation Items */}
          <nav className="no-scrollbar flex-1 overflow-y-auto space-y-4 pr-0.5">
            {filteredCategories.map((cat) => {
              // On mobile, show only selected category unless searching
              const isHiddenOnMobile = !search && mobileCategory !== cat.id;

              return (
                <div key={cat.id} className={cn("space-y-1", isHiddenOnMobile && "hidden lg:block")}>
                  <div className="px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider text-ink/40">
                    {cat.title}
                  </div>
                  <div className="space-y-0.5">
                    {cat.tabs.map((t) => {
                      const Icon = t.icon;
                      const active = tab === t.id;
                      const badge = badges[t.id];

                      return (
                        <button
                          key={t.id}
                          onClick={() => go(t.id)}
                          className={cn(
                            "group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13.5px] font-medium transition",
                            active
                              ? "bg-primary text-white shadow-sm"
                              : "text-ink/75 hover:bg-white/70 dark:hover:bg-white/10"
                          )}
                        >
                          <Icon size={16} className={cn("shrink-0", active ? "text-white" : "text-ink/60 group-hover:text-primary")} />
                          <span className="truncate flex-1">{t.label}</span>
                          {badge !== undefined && badge > 0 && (
                            <span
                              className={cn(
                                "shrink-0 rounded-full px-1.5 py-0.5 text-[10.5px] font-bold leading-none",
                                active ? "bg-white text-primary" : "bg-[#e11d74] text-white"
                              )}
                            >
                              {badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>

          {/* Bottom Actions */}
          <div className="mt-2 flex gap-1 border-t border-black/5 dark:border-white/10 pt-2 lg:flex-col shrink-0">
            <Link
              href="/"
              className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] font-medium text-ink/70 hover:bg-white/60 dark:hover:bg-white/10"
            >
              <Store size={15} /> View Store
            </Link>
            <button
              onClick={logout}
              className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] font-medium text-danger hover:bg-white/60 dark:hover:bg-white/10"
            >
              <LogOut size={15} /> Log Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Tab Content */}
      <section className="min-w-0" key={key}>
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-[24px] font-extrabold tracking-tight">
            {currentTabObj?.label ?? "Admin"}
          </h1>
          <span className="text-xs font-medium text-ink/50 bg-black/5 dark:bg-white/5 px-2.5 py-1 rounded-full">
            {CATEGORIES.find((c) => c.tabs.some((t) => t.id === tab))?.title}
          </span>
        </div>

        {tab === "overview" && <Overview go={go} />}
        {tab === "marketing-pixels" && <MarketingPixelsManager />}
        {tab === "social-webhooks" && <SocialWebhooks />}
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
        {tab === "loyalty" && <LoyaltyManager />}
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
