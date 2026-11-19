"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { track } from "@/lib/track";
import { AlertCircle, ArrowLeft, Banknote, Check, Copy, CreditCard, ExternalLink, Lock, ShieldCheck, Smartphone, Wallet } from "lucide-react";
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
  const [payReference, setPayReference] = useState("");
  const [copiedPayoneer, setCopiedPayoneer] = useState(false);
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

  const isCityAllowedForCod = (targetCity?: string) => {
    if (!store?.cod?.enabled) return false;
    if (store?.cod?.cityRestriction === "all") return true;
    const allowed = store?.cod?.allowedCities && store.cod.allowedCities.length > 0
      ? store.cod.allowedCities
      : ["Karachi"];
    const c = (targetCity ?? f.city).trim().toLowerCase();
    if (!c) return true;
    return allowed.some((city) => city.trim().toLowerCase() === c);
  };

  const onCityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setF({ ...f, city: val });
    setErrors({ ...errors, city: undefined });
    if (val && !isCityAllowedForCod(val) && method === "cod") {
      setMethod("payoneer");
    }
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
      const combinedNotes = [
        f.notes?.trim() || null,
        payReference.trim() ? `Payment Reference: ${payReference.trim()}` : null,
      ].filter(Boolean).join(" | ");

      const r = await api<{ data: { order: Order; payment: { type: string; url?: string; action?: string; fields?: Record<string, string> } } }>("/checkout", {
        method: "POST",
        json: {
          cartId: cart.id,
          customer: { name: f.name, phone: f.phone, email: f.email || undefined },
          address: { city: f.city, area: f.area || undefined, line1: f.line1 },
          notes: combinedNotes || undefined,
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

  const isCod = method === "cod";
  const codSettings = cart?.totals.codSettings ?? store?.cod ?? { enabled: true, threshold: 2000, feeBelow: 50, feeAbove: 100 };
  const effectiveSubtotal = (cart?.totals.subtotal ?? 0) - (cart?.totals.discount ?? 0);
  const codFee = isCod && (codSettings.enabled ?? true)
    ? (effectiveSubtotal < (codSettings.threshold ?? 2000) ? (codSettings.feeBelow ?? 50) : (codSettings.feeAbove ?? 100))
    : 0;
  const finalTotal = effectiveSubtotal + (cart?.totals.shipping ?? 0) + codFee;

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
                <select className="input" value={f.city} onChange={onCityChange} autoComplete="address-level2">
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
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">3. Payment</h2>
              {f.city && !isCityAllowedForCod(f.city) && (
                <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                  Online Payment Required ({f.city})
                </span>
              )}
            </div>

            {f.city && !isCityAllowedForCod(f.city) && (
              <div className="mt-3.5 flex items-start gap-2.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-900 dark:text-amber-200">
                <AlertCircle size={16} className="shrink-0 text-amber-600 mt-0.5" />
                <div>
                  <p className="font-bold">
                    {store?.cod?.nonCodNotice || `Cash on Delivery is currently available in Karachi only. Orders for ${f.city} require advance online payment.`}
                  </p>
                  <p className="mt-1 text-muted">
                    Pay securely using Payoneer, Card, or Online Bank Transfer below.
                  </p>
                </div>
              </div>
            )}

            <div className="mt-4 grid gap-2.5">
              {methods.map((m) => {
                const I = icons[m.kind] ?? Wallet;
                const isBlockedCod = m.id === "cod" && !!f.city && !isCityAllowedForCod(f.city);
                const isItemEnabled = m.enabled && !isBlockedCod;
                const on = method === m.id;
                return (
                  <label
                    key={m.id}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition",
                      on ? "border-accent bg-[#f2f4ff] shadow-[0_0_0_3px_rgba(54,83,255,0.12)]" : "border-black/10 bg-white/70",
                      !isItemEnabled && "cursor-not-allowed opacity-50 bg-black/[0.02]",
                    )}
                  >
                    <input
                      type="radio"
                      name="pm"
                      className="sr-only"
                      disabled={!isItemEnabled}
                      checked={on}
                      onChange={() => isItemEnabled && setMethod(m.id)}
                    />
                    <span className={cn("grid h-5 w-5 place-items-center rounded-full border-2", on ? "border-accent" : "border-black/25")}>
                      {on && <span className="h-2.5 w-2.5 rounded-full bg-accent" />}
                    </span>
                    <I size={20} className={isBlockedCod ? "text-muted" : "text-accent"} />
                    <span className="flex-1">
                      <span className="flex items-center gap-2">
                        <b className="text-[15px]">{m.name}</b>
                        {isBlockedCod && (
                          <span className="rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 px-2 py-0.5 text-[10.5px] font-bold">
                            Karachi Only
                          </span>
                        )}
                      </span>
                      <span className="block text-[13px] text-muted">
                        {isBlockedCod ? "COD is unavailable in your city. Select Payoneer or Bank Transfer." : m.enabled ? m.description : "Coming soon"}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>

            {/* Payoneer Online Payment Details Box */}
            {method === "payoneer" && (
              <div className="mt-4 rounded-2xl border border-accent/20 bg-accent/[0.04] p-4 sm:p-5 space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-accent flex items-center gap-1.5">
                    <ShieldCheck size={14} /> {store?.payoneer?.title || "Payoneer & Online Transfer Instructions"}
                  </span>
                  {store?.payoneer?.link && (
                    <a
                      href={store.payoneer.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-bold text-accent hover:underline"
                    >
                      Pay Online Now <ExternalLink size={12} />
                    </a>
                  )}
                </div>

                {store?.payoneer?.email && (
                  <div className="rounded-xl bg-white dark:bg-neutral-800 p-3 border border-line flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-medium text-muted">Payoneer Account Email</p>
                      <p className="font-mono text-sm font-bold text-ink select-all">{store.payoneer.email}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(store.payoneer?.email || "");
                        setCopiedPayoneer(true);
                        setTimeout(() => setCopiedPayoneer(false), 2000);
                      }}
                      className="btn btn-secondary h-8 px-2.5 text-xs flex items-center gap-1"
                    >
                      {copiedPayoneer ? <Check size={13} className="text-success" /> : <Copy size={13} />}
                      {copiedPayoneer ? "Copied" : "Copy"}
                    </button>
                  </div>
                )}

                {(store?.payoneer?.bankTitle || store?.payoneer?.bankAccount || store?.payoneer?.bankIban) && (
                  <div className="rounded-xl bg-white dark:bg-neutral-800 p-3 border border-line text-xs space-y-1">
                    <p className="font-bold text-ink mb-1">Direct Bank Account Transfer:</p>
                    {store.payoneer.bankTitle && (
                      <p className="text-muted"><span className="font-semibold text-ink">Title:</span> {store.payoneer.bankTitle}</p>
                    )}
                    {store.payoneer.bankAccount && (
                      <p className="text-muted"><span className="font-semibold text-ink">Account No:</span> <span className="font-mono select-all font-bold">{store.payoneer.bankAccount}</span></p>
                    )}
                    {store.payoneer.bankIban && (
                      <p className="text-muted"><span className="font-semibold text-ink">IBAN:</span> <span className="font-mono select-all font-bold">{store.payoneer.bankIban}</span></p>
                    )}
                  </div>
                )}

                <p className="text-xs text-muted leading-relaxed">
                  {store?.payoneer?.instructions || "Transfer your total amount via Payoneer or online bank transfer. After placing the order, you can submit your transaction reference or share the payment screenshot on WhatsApp."}
                </p>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">
                    Transaction ID / Payment Reference (Optional)
                  </label>
                  <input
                    type="text"
                    value={payReference}
                    onChange={(e) => setPayReference(e.target.value)}
                    placeholder="e.g. Transaction ID / TID or Sender Name"
                    className="input w-full text-xs font-mono"
                  />
                </div>
              </div>
            )}
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
          <Totals cart={cart} paymentMethod={method} showTotalLabel={method === "cod" ? "Pay on delivery" : "Total"} />
          {err && <p className="rounded-xl bg-[#fde8e8] p-3 text-sm text-danger">{err}</p>}
          <button className="btn btn-primary h-[54px] w-full text-[16px]" onClick={place} disabled={busy || cart.hasIssues}>
            <Lock size={17} /> {busy ? "Placing order…" : `Place order · ${money(finalTotal)}`}
          </button>
          <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted">
            <ShieldCheck size={14} />{" "}
            {method === "cod"
              ? "No advance payment. We’ll call to confirm your order."
              : "100% Secure payment. WhatsApp support available for assistance."}
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
