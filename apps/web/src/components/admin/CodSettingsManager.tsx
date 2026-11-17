"use client";

import { useEffect, useState } from "react";
import { Banknote, Check, DollarSign, Info, RefreshCw, Save, ShieldCheck, Sparkles } from "lucide-react";
import { api } from "@/lib/client-api";
import { money } from "@/lib/format";

interface CodSettings {
  id?: number;
  enabled: boolean;
  threshold: number;
  feeBelow: number;
  feeAbove: number;
}

export function CodSettingsManager() {
  const [settings, setSettings] = useState<CodSettings>({
    enabled: true,
    threshold: 2000,
    feeBelow: 50,
    feeAbove: 100,
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadSettings = () => {
    setLoading(true);
    api<{ data: CodSettings }>("/admin/cod-settings")
      .then((res) => {
        if (res.data) {
          setSettings(res.data);
        }
      })
      .catch((err) => {
        setMsg({ type: "error", text: (err as Error).message || "Failed to load COD settings" });
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
        },
      });
      setSettings(res.data);
      setMsg({ type: "success", text: "✓ Cash on Delivery (COD) charges updated successfully!" });
      setTimeout(() => setMsg(null), 4000);
    } catch (err) {
      setMsg({ type: "error", text: (err as Error).message || "Failed to update COD settings" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="card p-5 sm:p-6 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/20">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-500/25">
              <Banknote size={26} />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-ink">Cash on Delivery (COD) Dynamic Fee Rules</h2>
              <p className="mt-1 text-sm text-muted">
                Configure tiered courier handling charges applied automatically when buyers choose Cash on Delivery at checkout.
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
          {msg.type === "success" ? <Check size={18} /> : <Info size={18} />}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSave} className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="card p-5 sm:p-7 space-y-6">
          <h3 className="text-base font-bold text-ink flex items-center gap-2 border-b border-line pb-3">
            <Sparkles size={18} className="text-emerald-600" /> Charge Configuration
          </h3>

          {/* Toggle Switch */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-black/[0.03] dark:bg-white/[0.03] border border-line">
            <div>
              <b className="block text-sm font-bold text-ink">Enable Tiered COD Charges</b>
              <p className="text-xs text-muted mt-0.5">When disabled, Cash on Delivery will have Rs. 0 extra charge.</p>
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

          {/* Threshold input */}
          <div className="space-y-1.5">
            <label className="label font-bold text-ink flex items-center justify-between">
              <span>Order Amount Split Threshold (PKR)</span>
              <span className="text-xs text-muted font-normal">Default: Rs. 2,000</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted font-bold text-sm">Rs.</span>
              <input
                type="number"
                min="0"
                step="50"
                value={settings.threshold}
                onChange={(e) => setSettings({ ...settings, threshold: Number(e.target.value) })}
                className="input pl-11 text-base font-semibold"
                placeholder="2000"
                required
              />
            </div>
            <p className="text-xs text-muted">
              Orders below this subtotal are charged the lower fee; orders equal or above are charged the higher fee.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Fee Below */}
            <div className="space-y-1.5">
              <label className="label font-bold text-ink flex items-center justify-between">
                <span>Fee for Orders &lt; {money(settings.threshold)}</span>
                <span className="text-xs text-muted font-normal">Default: Rs. 50</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted font-bold text-sm">Rs.</span>
                <input
                  type="number"
                  min="0"
                  step="10"
                  value={settings.feeBelow}
                  onChange={(e) => setSettings({ ...settings, feeBelow: Number(e.target.value) })}
                  className="input pl-11 text-base font-semibold"
                  placeholder="50"
                  required
                />
              </div>
              <p className="text-[11px] text-muted">Courier cash handling fee for smaller parcels.</p>
            </div>

            {/* Fee Above */}
            <div className="space-y-1.5">
              <label className="label font-bold text-ink flex items-center justify-between">
                <span>Fee for Orders &ge; {money(settings.threshold)}</span>
                <span className="text-xs text-muted font-normal">Default: Rs. 100</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted font-bold text-sm">Rs.</span>
                <input
                  type="number"
                  min="0"
                  step="10"
                  value={settings.feeAbove}
                  onChange={(e) => setSettings({ ...settings, feeAbove: Number(e.target.value) })}
                  className="input pl-11 text-base font-semibold"
                  placeholder="100"
                  required
                />
              </div>
              <p className="text-[11px] text-muted">Courier cash handling fee for larger parcels.</p>
            </div>
          </div>

          {/* Action button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary h-12 w-full flex items-center justify-center gap-2 text-sm font-bold shadow-lg shadow-accent/20"
            >
              <Save size={16} /> {saving ? "Saving settings…" : "Save COD Changes"}
            </button>
          </div>
        </div>

        {/* Live Scenario Preview / Rule Card */}
        <div className="space-y-4">
          <div className="card p-5 sm:p-6 bg-black/[0.02] dark:bg-white/[0.02] border border-line">
            <h4 className="text-sm font-bold text-ink flex items-center gap-2">
              <ShieldCheck size={17} className="text-emerald-600" /> Active Customer Rules
            </h4>
            <div className="mt-3.5 space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-white/70 dark:bg-white/5 border border-line">
                <div className="font-semibold text-ink text-[13px] flex items-center justify-between">
                  <span>Order under {money(settings.threshold)}</span>
                  <span className="font-bold text-emerald-600">+{money(settings.feeBelow)} COD fee</span>
                </div>
                <p className="mt-1 text-muted">Example: Rs. 1,600 item + {money(settings.feeBelow)} COD charge.</p>
              </div>

              <div className="p-3 rounded-xl bg-white/70 dark:bg-white/5 border border-line">
                <div className="font-semibold text-ink text-[13px] flex items-center justify-between">
                  <span>Order {money(settings.threshold)} or above</span>
                  <span className="font-bold text-emerald-600">+{money(settings.feeAbove)} COD fee</span>
                </div>
                <p className="mt-1 text-muted">Example: Rs. 2,600 item + {money(settings.feeAbove)} COD charge.</p>
              </div>

              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300">
                <b className="block text-[12.5px]">Payment Method Isolation:</b>
                <p className="mt-0.5">
                  These handling fees apply <b>ONLY</b> to Cash on Delivery. Online Card, JazzCash, EasyPaisa, or Bank
                  transfer orders are charged <b>Rs. 0</b> fee.
                </p>
              </div>
            </div>
          </div>

          <div className="card p-4 text-xs text-muted space-y-1.5">
            <div className="font-semibold text-ink flex items-center gap-1.5">
              <Info size={14} className="text-accent" />
              <span>Auto-Sync Details</span>
            </div>
            <p>
              Changes saved here take effect immediately on the storefront cart calculation, checkout screen, and order placement API.
            </p>
          </div>
        </div>
      </form>
    </div>
  );
}
