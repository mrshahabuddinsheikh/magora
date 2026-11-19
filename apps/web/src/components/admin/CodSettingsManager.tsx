"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Banknote, Check, CreditCard, DollarSign, Globe, Info, MapPin, Plus, RefreshCw, Save, ShieldCheck, Sparkles, Trash2, X } from "lucide-react";
import { api } from "@/lib/client-api";
import { money, cn } from "@/lib/format";

interface CodSettings {
  id?: number;
  enabled: boolean;
  threshold: number;
  feeBelow: number;
  feeAbove: number;
  cityRestriction?: "all" | "selected_only";
  allowedCities?: string[];
  nonCodNotice?: string;
  payoneerEnabled?: boolean;
  payoneerTitle?: string;
  payoneerEmail?: string;
  payoneerLink?: string;
  payoneerInstructions?: string;
  bankTitle?: string;
  bankAccount?: string;
  bankIban?: string;
}

const PAKISTAN_MAJOR_CITIES = [
  "Karachi",
  "Lahore",
  "Islamabad",
  "Rawalpindi",
  "Faisalabad",
  "Multan",
  "Peshawar",
  "Quetta",
  "Hyderabad",
  "Sialkot",
  "Gujranwala",
];

export function CodSettingsManager() {
  const [settings, setSettings] = useState<CodSettings>({
    enabled: true,
    threshold: 2000,
    feeBelow: 50,
    feeAbove: 100,
    cityRestriction: "selected_only",
    allowedCities: ["Karachi"],
    nonCodNotice: "Cash on Delivery is currently available in Karachi only. Orders for other cities require advance online payment.",
    payoneerEnabled: true,
    payoneerTitle: "Payoneer / Card / Online Payment",
    payoneerEmail: "payments@magora.pk",
    payoneerLink: "",
    payoneerInstructions: "Transfer your total amount via Payoneer or bank transfer. Submit your transaction ID or share screenshot on WhatsApp.",
    bankTitle: "",
    bankAccount: "",
    bankIban: "",
  });

  const [newCityInput, setNewCityInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadSettings = () => {
    setLoading(true);
    api<{ data: CodSettings }>("/admin/cod-settings")
      .then((res) => {
        if (res.data) {
          setSettings({
            ...res.data,
            cityRestriction: res.data.cityRestriction ?? "selected_only",
            allowedCities: Array.isArray(res.data.allowedCities) && res.data.allowedCities.length > 0 ? res.data.allowedCities : ["Karachi"],
            nonCodNotice: res.data.nonCodNotice || "Cash on Delivery is currently available in Karachi only. Orders for other cities require advance online payment.",
            payoneerEnabled: res.data.payoneerEnabled ?? true,
            payoneerTitle: res.data.payoneerTitle || "Payoneer / Card / Online Payment",
            payoneerEmail: res.data.payoneerEmail || "",
            payoneerLink: res.data.payoneerLink || "",
            payoneerInstructions: res.data.payoneerInstructions || "",
            bankTitle: res.data.bankTitle || "",
            bankAccount: res.data.bankAccount || "",
            bankIban: res.data.bankIban || "",
          });
        }
      })
      .catch((err) => {
        setMsg({ type: "error", text: (err as Error).message || "Failed to load COD & Payment settings" });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const res = await api<{ data: CodSettings }>("/admin/cod-settings", {
        method: "POST",
        json: {
          enabled: settings.enabled,
          threshold: Number(settings.threshold) || 2000,
          feeBelow: Number(settings.feeBelow) || 50,
          feeAbove: Number(settings.feeAbove) || 100,
          cityRestriction: settings.cityRestriction || "selected_only",
          allowedCities: settings.allowedCities || ["Karachi"],
          nonCodNotice: settings.nonCodNotice || "",
          payoneerEnabled: settings.payoneerEnabled ?? true,
          payoneerTitle: settings.payoneerTitle || "Payoneer / Card / Online Payment",
          payoneerEmail: settings.payoneerEmail || "",
          payoneerLink: settings.payoneerLink || "",
          payoneerInstructions: settings.payoneerInstructions || "",
          bankTitle: settings.bankTitle || "",
          bankAccount: settings.bankAccount || "",
          bankIban: settings.bankIban || "",
        },
      });
      if (res.data) {
        setSettings({
          ...res.data,
          allowedCities: Array.isArray(res.data.allowedCities) ? res.data.allowedCities : ["Karachi"],
        });
      }
      setMsg({ type: "success", text: "✓ COD Rules, City Restrictions & Payoneer Gateways saved successfully!" });
      setTimeout(() => setMsg(null), 4000);
    } catch (err) {
      setMsg({ type: "error", text: (err as Error).message || "Failed to update settings" });
    } finally {
      setSaving(false);
    }
  };

  const addCity = (cityName: string) => {
    const trimmed = cityName.trim();
    if (!trimmed) return;
    const current = settings.allowedCities || [];
    if (current.some((c) => c.toLowerCase() === trimmed.toLowerCase())) return;
    setSettings({ ...settings, allowedCities: [...current, trimmed] });
    setNewCityInput("");
  };

  const removeCity = (cityToRemove: string) => {
    const current = settings.allowedCities || [];
    setSettings({
      ...settings,
      allowedCities: current.filter((c) => c.toLowerCase() !== cityToRemove.toLowerCase()),
    });
  };

  const setKarachiOnly = () => {
    setSettings({
      ...settings,
      cityRestriction: "selected_only",
      allowedCities: ["Karachi"],
      nonCodNotice: "Cash on Delivery is currently available in Karachi only. Orders for other cities require advance online payment.",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="card p-5 sm:p-6 bg-gradient-to-r from-emerald-500/10 via-accent/5 to-transparent border border-emerald-500/20">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-500/25">
              <Banknote size={26} />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-ink">Cash on Delivery (COD) & Online Payment Control</h2>
              <p className="mt-1 text-sm text-muted">
                Control COD city availability (e.g. Karachi only vs Nationwide), tiered courier handling fees, and Payoneer advance payment gateway.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={loadSettings}
            disabled={loading}
            className="btn btn-secondary self-start sm:self-auto flex items-center gap-2 text-xs"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      {msg && (
        <div
          className={`rounded-2xl p-4 text-sm font-semibold flex items-center gap-2.5 transition-all animate-in fade-in ${
            msg.type === "success"
              ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30"
              : "bg-rose-500/15 text-rose-800 dark:text-rose-300 border border-rose-500/30"
          }`}
        >
          {msg.type === "success" ? <Check size={18} /> : <AlertCircle size={18} />}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSave} className="grid gap-6 lg:grid-cols-[1.55fr_1fr]">
        <div className="space-y-6">
          {/* Section 1: COD City Restriction & Rules */}
          <div className="card p-5 sm:p-7 space-y-6">
            <h3 className="text-base font-bold text-ink flex items-center gap-2 border-b border-line pb-3">
              <MapPin size={18} className="text-emerald-600" /> Cash on Delivery (COD) City Rules
            </h3>

            {/* Global COD Toggle */}
            <div className="flex items-center justify-between p-4 rounded-2xl bg-black/[0.03] dark:bg-white/[0.03] border border-line">
              <div>
                <b className="block text-sm font-bold text-ink">Enable Cash on Delivery (COD)</b>
                <p className="text-xs text-muted mt-0.5">Turn COD on or off across your entire store.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.enabled}
                  onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-black/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            {/* City Restriction Mode */}
            <div className="space-y-2">
              <label className="label font-bold text-ink">COD City Mode</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, cityRestriction: "selected_only" })}
                  className={cn(
                    "rounded-2xl border p-4 text-left transition",
                    settings.cityRestriction === "selected_only"
                      ? "border-emerald-600 bg-emerald-500/10 shadow-sm"
                      : "border-line bg-white dark:bg-neutral-800 opacity-70",
                  )}
                >
                  <b className="block text-sm font-bold text-ink">Selected Cities Only (Karachi Only)</b>
                  <span className="block text-xs text-muted mt-1">
                    COD is allowed ONLY in chosen cities. All other cities must pay online in advance.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, cityRestriction: "all" })}
                  className={cn(
                    "rounded-2xl border p-4 text-left transition",
                    settings.cityRestriction === "all"
                      ? "border-emerald-600 bg-emerald-500/10 shadow-sm"
                      : "border-line bg-white dark:bg-neutral-800 opacity-70",
                  )}
                >
                  <b className="block text-sm font-bold text-ink">Nationwide (All Pakistan Cities)</b>
                  <span className="block text-xs text-muted mt-1">
                    COD is enabled across all cities in Pakistan without city restriction.
                  </span>
                </button>
              </div>
            </div>

            {/* Allowed Cities Manager */}
            {settings.cityRestriction === "selected_only" && (
              <div className="space-y-3 rounded-2xl border border-line bg-black/[0.02] dark:bg-white/[0.02] p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-bold text-ink block">Allowed COD Cities</label>
                    <p className="text-xs text-muted">Buyers from these cities can place COD orders.</p>
                  </div>
                  <button
                    type="button"
                    onClick={setKarachiOnly}
                    className="chip text-[11px] font-bold text-emerald-700 dark:text-emerald-300 py-1 px-2.5"
                  >
                    Set Karachi Only
                  </button>
                </div>

                {/* City Chips */}
                <div className="flex flex-wrap gap-1.5 min-h-[36px] p-2.5 rounded-xl border border-line bg-white dark:bg-neutral-800">
                  {(settings.allowedCities || []).map((city) => (
                    <span
                      key={city}
                      className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 text-white px-3 py-1 text-xs font-semibold shadow-sm"
                    >
                      {city}
                      <button
                        type="button"
                        onClick={() => removeCity(city)}
                        className="hover:text-rose-200 transition"
                      >
                        <X size={13} />
                      </button>
                    </span>
                  ))}
                  {(settings.allowedCities || []).length === 0 && (
                    <span className="text-xs text-danger font-medium self-center">
                      No cities selected — COD will be unavailable everywhere!
                    </span>
                  )}
                </div>

                {/* Add Custom City Input */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCityInput}
                    onChange={(e) => setNewCityInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCity(newCityInput);
                      }
                    }}
                    placeholder="Type city name, e.g. Karachi or Rawalpindi"
                    className="input text-xs flex-1 h-9"
                  />
                  <button
                    type="button"
                    onClick={() => addCity(newCityInput)}
                    className="btn btn-secondary h-9 px-3 text-xs flex items-center gap-1 font-bold"
                  >
                    <Plus size={14} /> Add City
                  </button>
                </div>

                {/* Quick Add Suggestions */}
                <div>
                  <span className="text-[11px] text-muted block mb-1">Quick add major cities:</span>
                  <div className="flex flex-wrap gap-1">
                    {PAKISTAN_MAJOR_CITIES.map((c) => {
                      const already = (settings.allowedCities || []).some(
                        (ac) => ac.toLowerCase() === c.toLowerCase()
                      );
                      if (already) return null;
                      return (
                        <button
                          type="button"
                          key={c}
                          onClick={() => addCity(c)}
                          className="chip text-[11px] py-0.5 px-2 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                        >
                          + {c}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Non-COD Notice */}
                <div className="space-y-1.5 pt-2">
                  <label className="label font-bold text-ink">Customer Notice for Other Cities</label>
                  <textarea
                    rows={2}
                    value={settings.nonCodNotice}
                    onChange={(e) => setSettings({ ...settings, nonCodNotice: e.target.value })}
                    placeholder="Message shown to buyers when they select a city where COD is unavailable..."
                    className="input w-full text-xs p-2.5 resize-none"
                  />
                </div>
              </div>
            )}

            {/* Tiered Fee Rules */}
            <div className="space-y-4 pt-2">
              <h4 className="text-sm font-bold text-ink">Tiered COD Courier Handling Fee</h4>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <label className="label text-xs font-bold text-ink">Split Threshold</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-xs font-bold">Rs.</span>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={settings.threshold}
                      onChange={(e) => setSettings({ ...settings, threshold: Number(e.target.value) })}
                      className="input pl-9 text-xs font-semibold"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="label text-xs font-bold text-ink">Fee &lt; Threshold</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-xs font-bold">Rs.</span>
                    <input
                      type="number"
                      min="0"
                      step="10"
                      value={settings.feeBelow}
                      onChange={(e) => setSettings({ ...settings, feeBelow: Number(e.target.value) })}
                      className="input pl-9 text-xs font-semibold"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="label text-xs font-bold text-ink">Fee &ge; Threshold</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-xs font-bold">Rs.</span>
                    <input
                      type="number"
                      min="0"
                      step="10"
                      value={settings.feeAbove}
                      onChange={(e) => setSettings({ ...settings, feeAbove: Number(e.target.value) })}
                      className="input pl-9 text-xs font-semibold"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Payoneer & Online Payment Gateway */}
          <div className="card p-5 sm:p-7 space-y-5">
            <h3 className="text-base font-bold text-ink flex items-center gap-2 border-b border-line pb-3">
              <CreditCard size={18} className="text-accent" /> Payoneer & Online Payment Gateway
            </h3>

            {/* Payoneer Enable Toggle */}
            <div className="flex items-center justify-between p-4 rounded-2xl bg-black/[0.03] dark:bg-white/[0.03] border border-line">
              <div>
                <b className="block text-sm font-bold text-ink">Enable Online Payment Gateway (Payoneer / Bank)</b>
                <p className="text-xs text-muted mt-0.5">Allows non-Karachi and advance-paying customers to pay online.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.payoneerEnabled}
                  onChange={(e) => setSettings({ ...settings, payoneerEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-black/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="label text-xs font-bold text-ink">Gateway Display Title</label>
                <input
                  type="text"
                  value={settings.payoneerTitle}
                  onChange={(e) => setSettings({ ...settings, payoneerTitle: e.target.value })}
                  placeholder="e.g. Payoneer / Card / Online Payment"
                  className="input text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="label text-xs font-bold text-ink">Payoneer Account Email</label>
                <input
                  type="email"
                  value={settings.payoneerEmail}
                  onChange={(e) => setSettings({ ...settings, payoneerEmail: e.target.value })}
                  placeholder="e.g. payments@magora.pk"
                  className="input text-xs font-mono"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="label text-xs font-bold text-ink">Payoneer Direct Payment Link (Optional)</label>
                <input
                  type="url"
                  value={settings.payoneerLink}
                  onChange={(e) => setSettings({ ...settings, payoneerLink: e.target.value })}
                  placeholder="https://payoneer.me/..."
                  className="input text-xs font-mono"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="label text-xs font-bold text-ink">Customer Payment Instructions</label>
                <textarea
                  rows={2}
                  value={settings.payoneerInstructions}
                  onChange={(e) => setSettings({ ...settings, payoneerInstructions: e.target.value })}
                  placeholder="Instructions displayed to customers during checkout and on their order status page..."
                  className="input w-full text-xs p-2.5 resize-none"
                />
              </div>
            </div>

            {/* Bank details */}
            <div className="rounded-2xl border border-line bg-black/[0.02] dark:bg-white/[0.02] p-4 space-y-3">
              <h4 className="text-xs font-bold text-ink uppercase tracking-wider">
                Direct Pakistani Bank Transfer Details (Optional)
              </h4>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <label className="label text-xs font-semibold text-ink">Bank & Account Title</label>
                  <input
                    type="text"
                    value={settings.bankTitle}
                    onChange={(e) => setSettings({ ...settings, bankTitle: e.target.value })}
                    placeholder="e.g. Meezan Bank - Magora"
                    className="input text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="label text-xs font-semibold text-ink">Account Number</label>
                  <input
                    type="text"
                    value={settings.bankAccount}
                    onChange={(e) => setSettings({ ...settings, bankAccount: e.target.value })}
                    placeholder="e.g. 010203040506"
                    className="input text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="label text-xs font-semibold text-ink">IBAN</label>
                  <input
                    type="text"
                    value={settings.bankIban}
                    onChange={(e) => setSettings({ ...settings, bankIban: e.target.value })}
                    placeholder="PK..."
                    className="input text-xs font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary h-12 w-full flex items-center justify-center gap-2 text-sm font-bold shadow-lg shadow-accent/20"
          >
            <Save size={16} /> {saving ? "Saving settings…" : "Save All COD & Payment Settings"}
          </button>
        </div>

        {/* Live Scenario Card & Info Sidebar */}
        <div className="space-y-4">
          <div className="card p-5 sm:p-6 bg-black/[0.02] dark:bg-white/[0.02] border border-line">
            <h4 className="text-sm font-bold text-ink flex items-center gap-2">
              <ShieldCheck size={17} className="text-emerald-600" /> Active Order Flow Rules
            </h4>

            <div className="mt-3.5 space-y-3 text-xs">
              {/* Karachi Rule */}
              <div className="p-3 rounded-xl bg-white/70 dark:bg-white/5 border border-line">
                <div className="font-semibold text-ink text-[13px] flex items-center justify-between">
                  <span>Karachi Orders</span>
                  <span className="font-bold text-emerald-600">✓ COD Available</span>
                </div>
                <p className="mt-1 text-muted">
                  Karachi customers can choose Cash on Delivery with standard courier verification.
                </p>
              </div>

              {/* Non-Karachi Rule */}
              <div className="p-3 rounded-xl bg-white/70 dark:bg-white/5 border border-line">
                <div className="font-semibold text-ink text-[13px] flex items-center justify-between">
                  <span>Non-Karachi Cities (Lahore, Islamabad...)</span>
                  <span className="font-bold text-amber-600">⚠️ Online Advance Only</span>
                </div>
                <p className="mt-1 text-muted">
                  COD is automatically locked out. Customers pay via Payoneer, Card or Bank Transfer before dispatch.
                </p>
              </div>

              {/* Security info */}
              <div className="p-3 rounded-xl bg-accent/10 border border-accent/20 text-accent dark:text-accent">
                <b className="block text-[12.5px]">Security & Deployment Safety:</b>
                <p className="mt-0.5 text-ink/80 dark:text-white/80">
                  Settings are stored in the secure MySQL production database. No passwords, credentials, or private keys are ever committed to GitHub.
                </p>
              </div>
            </div>
          </div>

          <div className="card p-4 text-xs text-muted space-y-1.5">
            <div className="font-semibold text-ink flex items-center gap-1.5">
              <Info size={14} className="text-accent" />
              <span>Instant Storefront Propagation</span>
            </div>
            <p>
              When you save changes here, both server-side caches and client checkout validation update instantly.
            </p>
          </div>
        </div>
      </form>
    </div>
  );
}
