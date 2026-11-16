"use client";

import { WHATSAPP } from "@/lib/config";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Heart, Home, LogOut, MapPin, Package, RotateCcw, Shield, Trash2, Truck, User as UserIcon, Wallet } from "lucide-react";
import { useAuth } from "@/stores/auth";
import { api } from "@/lib/client-api";
import { cn, dateTime, money } from "@/lib/format";
import type { ReturnRequest, StoreInfo } from "@/lib/types";

interface MyOrder {
  number: string; status: string; statusLabel: string; total: number; createdAt: string; paymentMethod: string;
  items: { productName: string; modelName: string; colorName: string; colorHex: string; qty: number }[];
}
interface Summary { orders: number; totalSpent: number; activeOrders: number; openReturns: number; wishlist: number; memberSince: string }
interface Address { id: number; label: string; name: string; phone: string; city: string; area: string | null; line1: string; isDefault: boolean }

type Tab = "overview" | "orders" | "returns" | "addresses" | "wishlist" | "profile";
const TABS: [Tab, string, typeof Package][] = [
  ["overview", "Overview", Home],
  ["orders", "My orders", Package],
  ["returns", "Returns", RotateCcw],
  ["addresses", "Addresses", MapPin],
  ["wishlist", "Wishlist", Heart],
  ["profile", "Profile & security", Shield],
];

const statusTone = (s: string) =>
  s === "delivered" ? "bg-[#e9f8ef] text-success" : s === "cancelled" || s === "returned" ? "bg-[#fde8e8] text-danger" : s === "out_for_delivery" ? "bg-[#fff4e0] text-[#a15c00]" : "bg-[#eef1ff] text-accent";

export default function AccountPage() {
  const { user, ready } = useAuth();
  if (!ready) return <div className="skeleton mx-auto h-80 max-w-md rounded-[28px]" />;
  return user ? <Dashboard /> : <AuthForm />;
}

function AuthForm() {
  const { login, register } = useAuth();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="mx-auto grid max-w-4xl gap-5 md:grid-cols-2">
      <div className="glass hidden flex-col justify-between rounded-[28px] p-8 md:flex">
        <div>
          <h1 className="text-[30px] font-bold leading-tight tracking-tight">Your orders, tracked live.</h1>
          <p className="mt-2 text-muted">Create an account with the same email or mobile you ordered with — your earlier orders appear automatically.</p>
        </div>
        <ul className="mt-6 space-y-3 text-[14.5px]">
          {[
            [Truck, "Live delivery tracking with rider location"],
            [Package, "All your orders in one place"],
            [RotateCcw, "Easy returns & exchanges in 2 taps"],
            [Heart, "Save cases to your wishlist"],
          ].map(([I, t], i) => {
            const Icon = I as typeof Truck;
            return (
              <li key={i} className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/80 text-accent"><Icon size={17} /></span>
                {t as string}
              </li>
            );
          })}
        </ul>
      </div>
      <div className="card p-6 sm:p-8">
        <div className="flex rounded-full bg-black/[0.04] p-1">
          {(["login", "register"] as const).map((t) => (
            <button key={t} onClick={() => { setTab(t); setErr(null); }} className={cn("h-10 flex-1 rounded-full text-sm font-semibold", tab === t ? "bg-white shadow-sm" : "text-muted")}>
              {t === "login" ? "Log in" : "Create account"}
            </button>
          ))}
        </div>
        <form
          className="mt-6 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setBusy(true);
            setErr(null);
            try {
              if (tab === "login") await login(String(f.get("email")), String(f.get("password")));
              else await register({ name: String(f.get("name")), email: String(f.get("email")), phone: String(f.get("phone") || "") || undefined, password: String(f.get("password")) });
              const next = new URLSearchParams(window.location.search).get("next");
              if (next?.startsWith("/")) window.location.href = next;
            } catch (e) {
              setErr((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {tab === "register" && (
            <>
              <label className="block"><span className="label">Full name</span><input name="name" required minLength={2} className="input" autoComplete="name" /></label>
              <label className="block"><span className="label">Mobile number</span><input name="phone" className="input" inputMode="tel" autoComplete="tel" placeholder="0300 1234567" /><span className="mt-1 block text-xs text-muted">Use the number you ordered with to see earlier orders</span></label>
            </>
          )}
          <label className="block"><span className="label">Email</span><input name="email" type="email" required className="input" autoComplete="email" /></label>
          <label className="block"><span className="label">Password</span><input name="password" type="password" required minLength={tab === "register" ? 8 : 1} className="input" autoComplete={tab === "login" ? "current-password" : "new-password"} /></label>
          {err && <p className="text-sm text-danger">{err}</p>}
          <button className="btn btn-primary h-12 w-full" disabled={busy}>{tab === "login" ? "Log in" : "Create account"}</button>
          {tab === "login" && (
            <a
              href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent("Assalam o Alaikum! Main apne account ka password bhool gaya/gayi hoon. Mera email: ")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center text-[13.5px] font-medium text-accent hover:underline"
            >
              Forgot password? Message us on WhatsApp
            </a>
          )}
        </form>
        <p className="mt-5 text-center text-xs text-muted">No account? You can still check out as a guest and track with your order number.</p>
      </div>
    </div>
  );
}

function Dashboard() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [orders, setOrders] = useState<MyOrder[] | null>(null);

  const load = useCallback(() => {
    api<{ data: Summary }>("/me/summary").then((r) => setSummary(r.data)).catch(() => {});
    api<{ data: MyOrder[] }>("/me/orders").then((r) => setOrders(r.data)).catch(() => setOrders([]));
  }, []);
  useEffect(() => {
    load();
    const h = window.location.hash.slice(1) as Tab;
    if (TABS.some(([t]) => t === h)) {
      queueMicrotask(() => setTab(h));
    }
  }, [load]);

  const go = (t: Tab) => {
    setTab(t);
    history.replaceState(null, "", `#${t}`);
  };
  if (!user) return null;
  const active = (orders ?? []).filter((o) => ["pending", "confirmed", "processing", "shipped", "out_for_delivery"].includes(o.status));

  return (
    <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
      <aside className="space-y-3 lg:sticky lg:top-[92px] lg:self-start">
        <div className="card p-5">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-[#4a65ff] to-[#7c3aed] text-lg font-bold text-white">{user.name[0]?.toUpperCase()}</span>
          <p className="mt-3 font-bold">{user.name}</p>
          <p className="truncate text-sm text-muted">{user.email}</p>
        </div>
        <nav className="glass no-scrollbar flex gap-1 overflow-x-auto rounded-[22px] p-1.5 lg:flex-col">
          {TABS.map(([t, l, I]) => (
            <button key={t} onClick={() => go(t)} className={cn("flex shrink-0 items-center gap-2.5 rounded-2xl px-3.5 py-2.5 text-left text-[14px] font-medium transition", tab === t ? "bg-white shadow-sm" : "text-ink/70 hover:bg-white/60")}>
              <I size={16} /> {l}
            </button>
          ))}
          {user.role === "admin" && (
            <Link href="/admin" className="flex shrink-0 items-center gap-2.5 rounded-2xl px-3.5 py-2.5 text-[14px] font-semibold text-accent hover:bg-white/60">
              <Shield size={16} /> Admin panel
            </Link>
          )}
          <button onClick={logout} className="flex shrink-0 items-center gap-2.5 rounded-2xl px-3.5 py-2.5 text-left text-[14px] text-danger hover:bg-white/60">
            <LogOut size={16} /> Log out
          </button>
        </nav>
      </aside>

      <section className="min-w-0 space-y-4">
        {tab === "overview" && (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                ["Orders", summary?.orders ?? "–", Package],
                ["On the way", summary?.activeOrders ?? "–", Truck],
                ["Total spent", summary ? money(summary.totalSpent) : "–", Wallet],
                ["Open returns", summary?.openReturns ?? "–", RotateCcw],
              ].map(([l, v, I]) => {
                const Icon = I as typeof Truck;
                return (
                  <div key={String(l)} className="card p-4">
                    <Icon size={18} className="text-accent" />
                    <p className="mt-2 text-2xl font-bold tabular-nums">{v as string}</p>
                    <p className="text-sm text-muted">{l as string}</p>
                  </div>
                );
              })}
            </div>
            <div className="card p-5">
              <h2 className="font-bold">On the way</h2>
              {orders === null ? (
                <div className="skeleton mt-3 h-20 rounded-2xl" />
              ) : active.length === 0 ? (
                <p className="mt-2 text-sm text-muted">Nothing on the way right now. <Link href="/shop" className="font-medium text-accent">Start shopping →</Link></p>
              ) : (
                <OrderList orders={active} />
              )}
            </div>
            {(orders?.length ?? 0) > 0 && (
              <div className="card p-5">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold">Recent orders</h2>
                  <button className="text-sm font-semibold text-accent" onClick={() => go("orders")}>All orders →</button>
                </div>
                <OrderList orders={orders!.slice(0, 3)} />
              </div>
            )}
            {summary?.memberSince && <p className="text-center text-xs text-muted">Member since {new Date(summary.memberSince).toLocaleDateString("en-PK", { month: "long", year: "numeric" })}</p>}
          </>
        )}
        {tab === "orders" && (
          <div className="card p-5">
            <h2 className="text-lg font-bold">My orders</h2>
            <p className="text-sm text-muted">Includes earlier guest orders placed with your email or mobile number.</p>
            {orders === null ? <div className="skeleton mt-4 h-40 rounded-2xl" /> : orders.length === 0 ? <p className="mt-4 text-muted">No orders yet.</p> : <OrderList orders={orders} />}
          </div>
        )}
        {tab === "returns" && <ReturnsTab />}
        {tab === "addresses" && <AddressesTab />}
        {tab === "wishlist" && <WishlistTab />}
        {tab === "profile" && <ProfileTab />}
      </section>
    </div>
  );
}

function OrderList({ orders }: { orders: MyOrder[] }) {
  return (
    <ul className="mt-3 divide-y divide-line">
      {orders.map((o) => (
        <li key={o.number}>
          <Link href={`/order/${o.number}`} className="-mx-2 flex flex-wrap items-center gap-3 rounded-2xl px-2 py-3.5 transition hover:bg-white/70">
            <div className="flex -space-x-2">
              {o.items.slice(0, 3).map((i, k) => (
                <span key={k} className="h-9 w-9 rounded-xl border-2 border-white" style={{ background: i.colorHex }} />
              ))}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {o.number} <span className={cn("ml-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold", statusTone(o.status))}>{o.statusLabel}</span>
              </p>
              <p className="truncate text-sm text-muted">{dateTime(o.createdAt)} · {o.items.map((i) => (i.modelName ? `${i.productName} (${i.modelName})` : i.productName)).join(", ")}</p>
            </div>
            <span className="font-semibold tabular-nums">{money(o.total)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function ReturnsTab() {
  const [rows, setRows] = useState<ReturnRequest[] | null>(null);
  useEffect(() => {
    api<{ data: ReturnRequest[] }>("/me/returns").then((r) => setRows(r.data)).catch(() => setRows([]));
  }, []);
  return (
    <div className="card p-5">
      <h2 className="text-lg font-bold">Returns & exchanges</h2>
      <p className="text-sm text-muted">To start a return, open a delivered order and tap “Return or exchange”.</p>
      {rows === null ? (
        <div className="skeleton mt-4 h-28 rounded-2xl" />
      ) : rows.length === 0 ? (
        <p className="mt-4 text-muted">No return requests.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {rows.map((r) => (
            <li key={r.number} className="rounded-[22px] bg-black/[0.03] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">
                  {r.number} · {r.resolution === "exchange" ? "Exchange" : `Refund ${money(r.refundAmount)}`}
                  <span className="text-sm font-normal text-muted"> for <Link href={`/order/${r.orderNumber}`} className="text-accent">{r.orderNumber}</Link></span>
                </p>
                <span className="rounded-full bg-[#eef1ff] px-2.5 py-1 text-xs font-semibold text-accent">{r.statusLabel}</span>
              </div>
              <p className="mt-1 text-sm text-muted">{r.items.map((i) => `${i.qty}× ${i.productName}${i.modelName ? ` (${i.modelName})` : ""}`).join(", ")} · {r.reason}</p>
              {r.adminNote && <p className="mt-2 rounded-xl bg-white/80 p-2.5 text-sm">💬 {r.adminNote}</p>}
              <ol className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                {r.timeline.map((t, i) => <li key={i}>✓ {t.label} · {dateTime(t.at)}</li>)}
              </ol>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AddressesTab() {
  const [rows, setRows] = useState<Address[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const load = () => api<{ data: Address[] }>("/me/addresses").then((r) => setRows(r.data));
  useEffect(() => {
    load();
    api<{ data: StoreInfo }>("/store", { auth: false }).then((r) => setCities(r.data.cities));
  }, []);
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Saved addresses</h2>
        <button className="btn btn-glass h-10 text-sm" onClick={() => setAdding((a) => !a)}>{adding ? "Cancel" : "+ Add address"}</button>
      </div>
      {adding && (
        <form
          className="mt-4 grid gap-3 rounded-[22px] bg-black/[0.03] p-4 sm:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
            try {
              await api("/me/addresses", { method: "POST", json: { ...f, isDefault: f.isDefault === "on" } });
              setAdding(false);
              setErr(null);
              load();
            } catch (e) {
              setErr((e as Error).message);
            }
          }}
        >
          <input name="label" placeholder="Label (Home, Office)" className="input" />
          <input name="name" placeholder="Full name" required className="input" />
          <input name="phone" placeholder="Mobile 0300 1234567" required className="input" />
          <select name="city" required className="input"><option value="">City</option>{cities.map((c) => <option key={c}>{c}</option>)}</select>
          <input name="area" placeholder="Area (optional)" className="input" />
          <input name="line1" placeholder="Complete address" required minLength={5} className="input sm:col-span-2" />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isDefault" /> Make default</label>
          {err && <p className="text-sm text-danger sm:col-span-2">{err}</p>}
          <button className="btn btn-primary h-11 sm:col-span-2 sm:justify-self-start">Save address</button>
        </form>
      )}
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {rows.map((a) => (
          <li key={a.id} className="relative rounded-[22px] bg-black/[0.03] p-4 text-sm">
            <p className="font-semibold">{a.label} {a.isDefault && <span className="ml-1 rounded-full bg-[#eef1ff] px-2 py-0.5 text-xs text-accent">Default</span>}</p>
            <p className="mt-1">{a.name} · {a.phone}</p>
            <p className="text-muted">{a.line1}{a.area ? `, ${a.area}` : ""}, {a.city}</p>
            <button className="absolute right-3 top-3 text-muted hover:text-danger" aria-label="Delete address" onClick={async () => { await api(`/me/addresses/${a.id}`, { method: "DELETE" }); load(); }}>
              <Trash2 size={16} />
            </button>
          </li>
        ))}
        {rows.length === 0 && !adding && <p className="text-sm text-muted">No saved addresses yet — they make checkout one tap.</p>}
      </ul>
    </div>
  );
}

function WishlistTab() {
  const [rows, setRows] = useState<{ id: number; slug: string; name: string; price: number }[] | null>(null);
  const load = () => api<{ data: { id: number; slug: string; name: string; price: number }[] }>("/me/wishlist").then((r) => setRows(r.data));
  useEffect(() => {
    load();
  }, []);
  return (
    <div className="card p-5">
      <h2 className="text-lg font-bold">Wishlist</h2>
      {rows === null ? (
        <div className="skeleton mt-4 h-24 rounded-2xl" />
      ) : rows.length === 0 ? (
        <p className="mt-2 text-muted">Tap the ♡ on any case to save it here.</p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {rows.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-3">
              <Link href={`/product/${p.slug}`} className="font-medium hover:text-accent">{p.name}</Link>
              <span className="flex items-center gap-3">
                <span className="text-sm text-muted">from {money(p.price)}</span>
                <button className="text-muted hover:text-danger" aria-label="Remove" onClick={async () => { await api(`/me/wishlist/${p.id}`, { method: "DELETE" }); load(); }}>
                  <Trash2 size={16} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ProfileTab() {
  const { user, init } = useAuth();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  if (!user) return null;
  return (
    <div className="card p-5">
      <h2 className="flex items-center gap-2 text-lg font-bold"><UserIcon size={18} /> Profile & security</h2>
      <form
        className="mt-4 grid max-w-lg gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
          const body: Record<string, string> = {};
          if (f.name && f.name !== user.name) body.name = f.name;
          if (f.phone) body.phone = f.phone;
          if (f.password) body.password = f.password;
          try {
            await api("/me", { method: "PATCH", json: body });
            setMsg("Saved ✓");
            setErr(null);
            init();
          } catch (e) {
            setErr((e as Error).message);
          }
        }}
      >
        <label><span className="label">Name</span><input name="name" defaultValue={user.name} className="input" /></label>
        <label><span className="label">Mobile</span><input name="phone" defaultValue={user.phone?.replace("+92", "0") ?? ""} className="input" inputMode="tel" /></label>
        <label><span className="label">Email</span><input value={user.email} disabled className="input opacity-60" /></label>
        <label><span className="label">New password (optional)</span><input name="password" type="password" minLength={8} className="input" autoComplete="new-password" /></label>
        {err && <p className="text-sm text-danger">{err}</p>}
        {msg && <p className="text-sm text-success">{msg}</p>}
        <button className="btn btn-primary h-11 justify-self-start">Save changes</button>
      </form>
    </div>
  );
}
