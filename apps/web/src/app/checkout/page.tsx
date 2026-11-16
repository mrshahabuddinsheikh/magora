"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { track } from "@/lib/track";
import { ArrowLeft, Banknote, CreditCard, Lock, ShieldCheck, Smartphone, Wallet } from "lucide-react";
import { useCart } from "@/stores/cart";
import { useAuth } from "@/stores/auth";
import { useCurrentSection, getEmptyBagConfig } from "@/stores/section";
import { api } from "@/lib/client-api";
import { cn, money } from "@/lib/format";
import { ProductThumb } from "@/components/CaseThumb";
import { CouponBox, Totals } from "@/components/CartLines";
import type { Order, PaymentMethod, StoreInfo } from "@/lib/types";

const SAVE_KEY = "mg-checkout";
type Form = { name: string; phone: string; email: string; city: string; area: string; line1: string; notes: string };
const empty: Form = { name: "", phone: "", email: "", city: "", area: "", line1: "", notes: "" };

const icons: Record<string, typeof Banknote> = { cod: Banknote, wallet: Wallet, card: CreditCard, bank: Smartphone };

export default function CheckoutPage() {
  const cart = useCart((s) => s.cart);
  const section = useCurrentSection();
  const emptyConfig = getEmptyBagConfig(section.slug);
  const trackedRef = useRef(false);
  useEffect(() => {
    if (trackedRef.current || !cart?.items.length) return;
    trackedRef.current = true;
    track("begin_checkout", { value: cart.totals.total, items: cart.items.map((i) => ({ id: i.product.slug, name: i.product.name, price: i.unitPrice, qty: i.qty })) });
  }, [cart]);
  const loadCart = useCart((s) => s.load);
  const user = useAuth((s) => s.user);
  const router = useRouter();
  const [store, setStore] = useState<StoreInfo | null>(null);
  const [f, setF] = useState<Form>(empty);
  const [method, setMethod] = useState("cod");
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ data: StoreInfo }>("/store", { auth: false }).then((r) => setStore(r.data)).catch(() => {});
    try {
      const saved = JSON.parse(localStorage.getItem(SAVE_KEY) ?? "null");
      if (saved) {
        queueMicrotask(() => setF((x) => ({ ...x, ...saved, notes: "" })));
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (user) {
      queueMicrotask(() => setF((x) => ({ ...x, name: x.name || user.name, email: x.email || user.email, phone: x.phone || (user.phone ?? "").replace("+92", "0") })));
    }
  }, [user]);

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setF({ ...f, [k]: e.target.value });
    setErrors({ ...errors, [k]: undefined });
  };

  const validate = () => {
    const e: typeof errors = {};
    if (f.name.trim().length < 2) e.name = "Please enter your full name";
    if (!/^(?:\+?92|0)?3\d{9}$/.test(f.phone.replace(/[\s-]/g, ""))) e.phone = "Enter a valid mobile number, e.g. 0300 1234567";
    if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) e.email = "Email looks wrong";
    if (!f.city) e.city = "Select your city";
    if (f.line1.trim().length < 5) e.line1 = "Please enter your complete address";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const place = async () => {
    if (!cart || !validate()) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ data: { order: Order; payment: { type: string; url?: string; action?: string; fields?: Record<string, string> } } }>("/checkout", {
        method: "POST",
        json: {
          cartId: cart.id,
          customer: { name: f.name, phone: f.phone, email: f.email || undefined },
          address: { city: f.city, area: f.area || undefined, line1: f.line1 },
          notes: f.notes || undefined,
          paymentMethod: method,
          source: "web",
        },
      });
      try {
        const { notes, ...keep } = f;
        void notes;
        localStorage.setItem(SAVE_KEY, JSON.stringify(keep));
      } catch {}
      const { order, payment } = r.data;
      await loadCart();
      if (payment.type === "redirect" && payment.url) return void (window.location.href = payment.url);
      if (payment.type === "form" && payment.action) {
        const form = document.createElement("form");
        form.method = "POST";
        form.action = payment.action;
        for (const [k, v] of Object.entries(payment.fields ?? {})) {
          const i = document.createElement("input");
          i.type = "hidden";
          i.name = k;
          i.value = v;
          form.appendChild(i);
        }
        document.body.appendChild(form);
        return form.submit();
      }
      router.replace(`/order/${order.number}?token=${order.accessToken}&new=1`);
    } catch (e) {
      setErr((e as Error).message);
      loadCart();
    } finally {
      setBusy(false);
    }
  };

  if (!cart || cart.items.length === 0)
    return (
      <div className="card mx-auto mt-6 max-w-lg p-10 text-center">
        <h1 className="text-2xl font-bold">Nothing to check out</h1>
        <p className="mt-1 text-muted">Your bag is empty.</p>
        <Link href={emptyConfig.href} className="btn btn-primary mt-6">{emptyConfig.buttonText}</Link>
      </div>
    );

  const methods: PaymentMethod[] = store?.paymentMethods ?? [{ id: "cod", name: "Cash on Delivery", description: "Pay in cash when your order arrives.", kind: "cod", enabled: true }];

  return (
    <div>
      <Link href="/cart" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft size={15} /> Back to bag</Link>
      <h1 className="mb-5 text-[30px] font-bold tracking-tight">Checkout</h1>
      <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <div className="space-y-4">
          <section className="card p-5 sm:p-7">
            <h2 className="text-lg font-bold">1. Contact</h2>
            {!user && <p className="mt-1 text-sm text-muted">No account needed. <Link href="/account?next=/checkout" className="font-medium text-accent">Log in</Link> to save your orders.</p>}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Full name" error={errors.name}><input className="input" value={f.name} onChange={set("name")} autoComplete="name" /></Field>
              <Field label="Mobile number" error={errors.phone} hint="Rider will call this number"><input className="input" value={f.phone} onChange={set("phone")} inputMode="tel" autoComplete="tel" placeholder="0300 1234567" /></Field>
              <Field label="Email (optional)" error={errors.email} className="sm:col-span-2"><input className="input" value={f.email} onChange={set("email")} type="email" autoComplete="email" placeholder="For order updates" /></Field>
            </div>
          </section>

          <section className="card p-5 sm:p-7">
            <h2 className="text-lg font-bold">2. Delivery address</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="City" error={errors.city}>
                <select className="input" value={f.city} onChange={set("city")} autoComplete="address-level2">
                  <option value="">Select city</option>
                  {(store?.cities ?? []).map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Area / Town (optional)"><input className="input" value={f.area} onChange={set("area")} placeholder="e.g. Gulshan-e-Iqbal" /></Field>
              <Field label="Complete address" error={errors.line1} className="sm:col-span-2"><input className="input" value={f.line1} onChange={set("line1")} autoComplete="street-address" placeholder="House / flat no., street, block, nearest landmark" /></Field>
              <Field label="Order notes (optional)" className="sm:col-span-2"><textarea className="input h-auto py-3" rows={2} value={f.notes} onChange={set("notes")} placeholder="e.g. Call before delivery" /></Field>
            </div>
          </section>

          <section className="card p-5 sm:p-7">
            <h2 className="text-lg font-bold">3. Payment</h2>
            <div className="mt-4 grid gap-2.5">
              {methods.map((m) => {
                const I = icons[m.kind] ?? Wallet;
                const on = method === m.id;
                return (
                  <label
                    key={m.id}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition",
                      on ? "border-accent bg-[#f2f4ff] shadow-[0_0_0_3px_rgba(54,83,255,0.12)]" : "border-black/10 bg-white/70",
                      !m.enabled && "cursor-not-allowed opacity-50",
                    )}
                  >
                    <input type="radio" name="pm" className="sr-only" disabled={!m.enabled} checked={on} onChange={() => setMethod(m.id)} />
                    <span className={cn("grid h-5 w-5 place-items-center rounded-full border-2", on ? "border-accent" : "border-black/25")}>{on && <span className="h-2.5 w-2.5 rounded-full bg-accent" />}</span>
                    <I size={20} className="text-accent" />
                    <span className="flex-1">
                      <b className="block text-[15px]">{m.name}</b>
                      <span className="text-[13px] text-muted">{m.enabled ? m.description : "Coming soon"}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="card h-fit space-y-4 p-5 sm:p-6 lg:sticky lg:top-[92px]">
          <h2 className="text-lg font-bold">Order summary</h2>
          <ul className="space-y-3">
            {cart.items.map((i) => (
              <li key={i.id} className="flex items-center gap-3">
                <span className="relative grid h-16 w-12 shrink-0 place-items-center rounded-xl bg-[#f1f2f6]">
                  {i.product.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={i.product.image} alt="" className="h-14 w-auto rounded-lg object-contain" />
              ) : (
                <ProductThumb material={i.product.material} color={i.color.hex} imageUrl={i.custom?.imageUrl} design={i.product.design ? { url: i.product.design } : null} className="h-14 w-auto" />
              )}
                  <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-ink px-1 text-[11px] font-bold text-white">{i.qty}</span>
                </span>
                <div className="min-w-0 flex-1 text-[13.5px]">
                  <p className="truncate font-semibold">{i.product.name}</p>
                  <p className="truncate text-muted">{[i.model?.name, i.color.name].filter(Boolean).join(" · ")}{i.custom?.coverage === "back_sides" ? " · Back + sides" : ""}{i.custom?.imageUrl ? " · Your photo" : ""}</p>
                  {i.issue && <p className="text-danger">{i.issue === "out_of_stock" ? "Sold out" : `Only ${i.stock} left`}</p>}
                </div>
                <span className="text-[14px] font-semibold tabular-nums">{money(i.lineTotal)}</span>
              </li>
            ))}
          </ul>
          <CouponBox cart={cart} />
          <Totals cart={cart} showTotalLabel={method === "cod" ? "Pay on delivery" : "Total"} />
          {err && <p className="rounded-xl bg-[#fde8e8] p-3 text-sm text-danger">{err}</p>}
          <button className="btn btn-primary h-[54px] w-full text-[16px]" onClick={place} disabled={busy || cart.hasIssues}>
            <Lock size={17} /> {busy ? "Placing order…" : `Place order · ${money(cart.totals.total)}`}
          </button>
          <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted">
            <ShieldCheck size={14} /> No advance payment. We’ll call to confirm your order.
          </p>
        </aside>
      </div>
    </div>
  );
}

function Field({ label, error, hint, className, children }: { label: string; error?: string; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={className}>
      <span className="label">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-xs text-danger">{error}</span> : hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}
