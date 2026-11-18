"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Eye, Gift, Loader2, MessageCircle, Save, Sparkles, X, Power } from "lucide-react";
import { api } from "@/lib/client-api";
import type { LeadCaptureConfig } from "@/lib/types";

export function LeadCaptureSettingsManager() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const [form, setForm] = useState<LeadCaptureConfig>({
    enabled: false,
    showFloatingPill: false,
    badgeText: "🎁 Rs. 300 OFF Code",
    heading: "Get Rs. 300 OFF",
    subheading: "Your first MagSafe case or skin",
    couponCode: "VIP300",
    discountAmount: 300,
    delaySeconds: 10,
  });

  useEffect(() => {
    let alive = true;
    api<{ data: LeadCaptureConfig }>("/lead-capture-settings")
      .then((res) => {
        if (alive && res?.data) {
          setForm({
            enabled: Boolean(res.data.enabled),
            showFloatingPill: Boolean(res.data.showFloatingPill),
            badgeText: res.data.badgeText || "🎁 Rs. 300 OFF Code",
            heading: res.data.heading || "Get Rs. 300 OFF",
            subheading: res.data.subheading || "Your first MagSafe case or skin",
            couponCode: res.data.couponCode || "VIP300",
            discountAmount: Number(res.data.discountAmount) || 300,
            delaySeconds: Number(res.data.delaySeconds) ?? 10,
          });
        }
      })
      .catch((err) => {
        if (alive) setError(err instanceof Error ? err.message : "Failed to load lead capture settings");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);

    try {
      const res = await api<{ data: LeadCaptureConfig }>("/lead-capture-settings", {
        method: "POST",
        json: {
          enabled: Boolean(form.enabled),
          showFloatingPill: Boolean(form.showFloatingPill),
          badgeText: form.badgeText.trim() || "🎁 Rs. 300 OFF Code",
          heading: form.heading.trim() || "Get Rs. 300 OFF",
          subheading: form.subheading.trim() || "Your first MagSafe case or skin",
          couponCode: form.couponCode.trim().toUpperCase() || "VIP300",
          discountAmount: Math.max(0, Number(form.discountAmount) || 0),
          delaySeconds: Math.max(0, Number(form.delaySeconds) || 0),
        },
      });

      if (res?.data) {
        setForm(res.data);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save lead capture settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="card p-8 flex items-center justify-center gap-3 text-muted">
        <Loader2 className="animate-spin text-accent" size={24} />
        <span>Loading Lead Capture &amp; Voucher settings…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status & Quick Toggle Banner */}
      <div className={`card p-5 border-2 transition-all ${form.enabled ? "border-emerald-500/40 bg-emerald-500/[0.03]" : "border-line bg-black/[0.01]"}`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`grid h-12 w-12 place-items-center rounded-2xl ${form.enabled ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "bg-neutral-200 dark:bg-neutral-800 text-neutral-500"}`}>
              <Gift size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">Lead Capture &amp; Discount Voucher Popup</h2>
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider ${form.enabled ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300" : "bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-400"}`}>
                  {form.enabled ? "● Currently Active (ON)" : "○ Disabled (OFF)"}
                </span>
              </div>
              <p className="text-xs text-muted mt-0.5">
                {form.enabled
                  ? "Popup and voucher are visible on the store according to your configuration."
                  : "Popup and floating button are completely hidden from the entire storefront."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const next = !form.enabled;
                setForm((prev) => ({ ...prev, enabled: next }));
              }}
              className={`btn h-11 px-5 font-bold text-sm gap-2 transition ${form.enabled ? "bg-rose-600 hover:bg-rose-700 text-white shadow-sm" : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"}`}
            >
              <Power size={16} />
              {form.enabled ? "Turn OFF Popup" : "Turn ON Popup"}
            </button>
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="btn btn-outline h-11 px-4 text-sm gap-1.5 font-semibold"
            >
              <Eye size={16} /> Live Preview
            </button>
          </div>
        </div>
      </div>

      {/* Main Settings Form */}
      <form onSubmit={handleSave} className="card p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-line pb-4">
          <h3 className="text-base font-bold flex items-center gap-2">
            <Sparkles size={18} className="text-amber-500" /> Popup Content &amp; Voucher Configuration
          </h3>
          {saved && (
            <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 px-3 py-1 rounded-full animate-in fade-in">
              <Check size={14} /> Settings Saved &amp; Live!
            </span>
          )}
        </div>

        {error && (
          <div className="rounded-xl border border-rose-300 bg-rose-50 dark:bg-rose-950/40 p-3 text-xs font-semibold text-danger">
            {error}
          </div>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          {/* Heading */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-ink">Popup Main Title / Heading</label>
            <input
              type="text"
              value={form.heading}
              onChange={(e) => setForm({ ...form, heading: e.target.value })}
              className="input text-sm"
              placeholder="e.g. Get Rs. 300 OFF"
              required
            />
            <p className="text-[11px] text-muted">Big bold headline displayed at the top of the popup.</p>
          </div>

          {/* Subheading */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-ink">Popup Subtitle / Description</label>
            <input
              type="text"
              value={form.subheading}
              onChange={(e) => setForm({ ...form, subheading: e.target.value })}
              className="input text-sm"
              placeholder="e.g. Your first MagSafe case or skin"
              required
            />
            <p className="text-[11px] text-muted">Subtitle explaining the deal to the user.</p>
          </div>

          {/* Coupon Code */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-ink">Coupon Code to Award</label>
            <input
              type="text"
              value={form.couponCode}
              onChange={(e) => setForm({ ...form, couponCode: e.target.value.toUpperCase() })}
              className="input text-sm font-mono uppercase font-bold"
              placeholder="e.g. VIP300"
              required
            />
            <p className="text-[11px] text-muted">The discount coupon shown to the user upon entering their number.</p>
          </div>

          {/* Discount Amount */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-ink">Discount Value (PKR)</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-muted">Rs.</span>
              <input
                type="number"
                min={0}
                step={50}
                value={form.discountAmount}
                onChange={(e) => setForm({ ...form, discountAmount: Number(e.target.value) })}
                className="input pl-10 text-sm font-bold"
                placeholder="300"
                required
              />
            </div>
            <p className="text-[11px] text-muted">Amount of discount promised in the banner and buttons.</p>
          </div>

          {/* Auto-Open Delay */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-ink">Auto-Open Delay (Seconds)</label>
            <div className="relative">
              <input
                type="number"
                min={0}
                max={120}
                value={form.delaySeconds}
                onChange={(e) => setForm({ ...form, delaySeconds: Number(e.target.value) })}
                className="input text-sm font-bold"
                placeholder="10"
                required
              />
            </div>
            <p className="text-[11px] text-muted">How many seconds after visitor arrives before popup opens automatically (0 = manual trigger only).</p>
          </div>

          {/* Floating Pill Label */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-ink">Floating Pill Button Text</label>
            <input
              type="text"
              value={form.badgeText}
              onChange={(e) => setForm({ ...form, badgeText: e.target.value })}
              className="input text-sm font-semibold"
              placeholder="e.g. 🎁 Rs. 300 OFF Code"
              disabled={!form.showFloatingPill}
            />
            <p className="text-[11px] text-muted">Text shown on the minimized button at the corner of the screen.</p>
          </div>
        </div>

        {/* Floating Pill Checkbox */}
        <div className="rounded-2xl border border-line bg-black/[0.02] dark:bg-white/[0.02] p-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.showFloatingPill}
              onChange={(e) => setForm({ ...form, showFloatingPill: e.target.checked })}
              className="h-4 w-4 mt-0.5 rounded cursor-pointer accent-accent"
            />
            <div>
              <b className="block text-sm text-ink">Show Floating &apos;Rs. 300 OFF Code&apos; Trigger Pill</b>
              <span className="text-xs text-muted block mt-0.5">
                If checked, a small floating pill appears at the bottom-left corner of the customer&apos;s screen. If unchecked, the popup opens automatically based on delay without leaving any floating pill behind.
              </span>
            </div>
          </label>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-line">
          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary h-12 px-7 text-sm font-bold gap-2 shadow-md"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? "Saving Changes…" : "Save & Update Storefront"}
          </button>
        </div>
      </form>

      {/* Admin Live Preview Modal */}
      {previewOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md overflow-hidden rounded-[28px] border border-line bg-white dark:bg-neutral-900 p-6 shadow-2xl sm:p-8">
            <button
              onClick={() => setPreviewOpen(false)}
              className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-black/5 dark:bg-white/10 text-muted hover:text-ink"
              aria-label="Close"
            >
              <X size={16} />
            </button>

            <div className="text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-950/60 px-3 py-1 text-xs font-bold text-amber-900 dark:text-amber-300">
                <Sparkles size={14} className="text-amber-600" /> Instant Welcome Voucher
              </span>
              <h3 className="mt-2 text-2xl font-bold tracking-tight text-ink">
                {form.heading}
              </h3>
              <p className="mt-1 text-xs text-muted leading-relaxed">
                {form.subheading}
              </p>
            </div>

            <div className="mt-6 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-ink mb-1">WhatsApp Mobile Number</label>
                <input type="tel" disabled className="input text-sm opacity-70" placeholder="03xx xxxxxxx" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Name</label>
                  <input type="text" disabled className="input text-sm opacity-70" placeholder="Your name" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Model</label>
                  <select disabled className="input text-xs opacity-70">
                    <option>iPhone 16 Pro Max</option>
                  </select>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-primary h-12 w-full text-sm font-bold shadow-md bg-gradient-to-r from-amber-500 to-amber-600 text-white border-none mt-2"
              >
                Unlock Rs. {form.discountAmount} Discount Voucher
              </button>
            </div>

            <div className="mt-5 rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/60 dark:bg-amber-950/30 p-3 text-center">
              <span className="text-xs text-muted block mb-1">Voucher Awarded on Submit:</span>
              <span className="font-mono text-lg font-extrabold text-amber-900 dark:text-amber-200 tracking-wider">
                {form.couponCode}
              </span>
            </div>

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="btn btn-outline h-9 px-4 text-xs font-semibold"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
