"use client";

import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, Clock, MapPin, Plus, RefreshCw, Sliders, Sparkles, Trash2, X } from "lucide-react";
import { api } from "@/lib/client-api";
import { cn } from "@/lib/format";
import { ProductThumb } from "../CaseThumb";
import type { TrustSettings, TrustSignal } from "@/lib/types";

const PK_CITIES = [
  "Karachi", "Lahore", "Islamabad", "Rawalpindi", "Faisalabad", "Multan", "Peshawar",
  "Sialkot", "Gujranwala", "Hyderabad", "Quetta", "Bahawalpur", "Sargodha", "Abbottabad",
];

export function TrustSignalsManager() {
  const [signals, setSignals] = useState<TrustSignal[]>([]);
  const [settings, setSettings] = useState<TrustSettings>({
    enabled: true,
    mode: "hybrid",
    initialDelaySec: 6,
    intervalSec: 28,
    durationSec: 6,
  });
  const [loading, setLoading] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Form state
  const [city, setCity] = useState("Lahore");
  const [productName, setProductName] = useState("Crystal Clear MagSafe Case");
  const [productSlug, setProductSlug] = useState("crystal-clear-magsafe-case");
  const [material, setMaterial] = useState("clear");
  const [colorHex, setColorHex] = useState("#f4f7fb");
  const [modelName, setModelName] = useState("iPhone 16 Pro Max");
  const [timeAgoText, setTimeAgoText] = useState("2 min ago");
  const [active, setActive] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api<{ data: TrustSignal[] }>("/admin/trust-signals"),
      api<{ data: TrustSettings }>("/admin/trust-settings"),
    ])
      .then(([sigRes, setRes]) => {
        setSignals(sigRes.data);
        if (setRes.data) setSettings(setRes.data);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let alive = true;
    Promise.all([
      api<{ data: TrustSignal[] }>("/admin/trust-signals"),
      api<{ data: TrustSettings }>("/admin/trust-settings"),
    ])
      .then(([sigRes, setRes]) => {
        if (alive) {
          setSignals(sigRes.data);
          if (setRes.data) setSettings(setRes.data);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSuccessMsg(null);
    try {
      await api("/admin/trust-settings", {
        method: "POST",
        json: settings,
      });
      setSuccessMsg("Settings saved! Popups will now display according to your rules.");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (e) {
      alert("Save failed: " + (e as Error).message);
    } finally {
      setSavingSettings(false);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setCity("Lahore");
    setProductName("Crystal Clear MagSafe Case");
    setProductSlug("crystal-clear-magsafe-case");
    setMaterial("clear");
    setColorHex("#f4f7fb");
    setModelName("iPhone 16 Pro Max");
    setTimeAgoText("Just now");
    setActive(true);
    setErr(null);
    setShowModal(true);
  };

  const openEdit = (s: TrustSignal) => {
    setEditingId(s.id);
    setCity(s.city);
    setProductName(s.productName);
    setProductSlug(s.productSlug);
    setMaterial(s.material || "clear");
    setColorHex(s.colorHex || "#1f2024");
    setModelName(s.modelName || "");
    setTimeAgoText(s.timeAgoText);
    setActive(s.active);
    setErr(null);
    setShowModal(true);
  };

  const handleSaveSignal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName.trim()) return setErr("Product name is required");
    setSubmitting(true);
    setErr(null);

    const body = {
      city: city.trim(),
      productName: productName.trim(),
      productSlug: productSlug.trim() || productName.toLowerCase().replace(/\s+/g, "-"),
      material,
      colorHex,
      modelName: modelName.trim() || null,
      timeAgoText: timeAgoText.trim() || "Just now",
      active,
    };

    try {
      if (editingId) {
        await api(`/admin/trust-signals/${editingId}`, { method: "PATCH", json: body });
      } else {
        await api("/admin/trust-signals", { method: "POST", json: body });
      }
      setShowModal(false);
      load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number, prod: string) => {
    if (!confirm(`Delete trust signal for "${prod}"?`)) return;
    try {
      await api(`/admin/trust-signals/${id}`, { method: "DELETE" });
      load();
    } catch (e) {
      alert("Delete failed: " + (e as Error).message);
    }
  };

  const handleToggle = async (id: number, currentActive: boolean) => {
    await api(`/admin/trust-signals/${id}`, { method: "PATCH", json: { active: !currentActive } });
    load();
  };

  return (
    <div className="space-y-4">
      {/* ───── Header Spotlight ───── */}
      <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-indigo-500/10 p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                <Sparkles size={13} /> Social Proof &amp; Trust Signals
              </span>
              <span className="text-xs text-muted">Recent Purchase Popup Controller</span>
            </div>
            <h3 className="text-xl font-extrabold text-ink mt-1">Trust Signal &amp; Sales Popups Manager</h3>
            <p className="text-xs text-muted max-w-xl mt-1">
              Storefront par aane wale &ldquo;Someone in Lahore bought…&rdquo; popups ko mukammal control karein.
              Aap naye popups create kar sakte hain, timings set kar sakte hain, aur decide kar sakte hain ke kustomer ko kab aur kitni der baad popup dikhana hai.
            </p>
          </div>
          <button
            onClick={openCreate}
            className="btn btn-primary flex items-center gap-2 self-start rounded-xl px-4 py-2.5 text-xs font-bold shadow-md"
          >
            <Plus size={16} /> Add Trust Signal Popup
          </button>
        </div>
      </div>

      {/* ───── Live Preview & Timing Settings Grid ───── */}
      <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        {/* Live Card Preview */}
        <div className="card p-5 space-y-3 bg-gradient-to-br from-white to-[#f8fafc] border border-black/5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">Customer Screen Live Preview</span>
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
              Live Widget
            </span>
          </div>

          <p className="text-xs text-muted">
            Customer jab aap ki website kholega, to screen ke bottom-left corner par ye notification nazar aayega:
          </p>

          <div className="pt-2">
            <div className="relative flex max-w-[340px] items-center gap-3 rounded-[20px] bg-white/95 p-3 pr-8 shadow-[0_18px_40px_-18px_rgba(15,23,42,0.35)] border border-black/5">
              <div className="grid h-14 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-b from-[#f4f5f9] to-[#e9ebf1]">
                <ProductThumb material={material || "clear"} color={colorHex || "#f4f7fb"} className="h-[86%] w-auto" />
              </div>
              <div className="min-w-0 text-[12.5px] leading-snug">
                <span className="text-muted">
                  Someone in <b className="text-ink">{city || "Lahore"}</b> bought
                </span>
                <b className="block truncate text-[13.5px] text-ink">{productName}</b>
                <span className="flex items-center gap-1 text-[11.5px] text-muted">
                  {timeAgoText} · <BadgeCheck size={12} className="text-success" /> verified real order
                </span>
              </div>
              <button className="absolute right-2.5 top-2.5 grid h-5 w-5 place-items-center rounded-full text-muted hover:bg-black/5">
                <X size={12} />
              </button>
            </div>
          </div>
        </div>

        {/* Timing & Frequency Settings */}
        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-line pb-2.5">
            <div className="flex items-center gap-2">
              <Sliders size={16} className="text-accent" />
              <h4 className="text-sm font-bold text-ink">Popup Timing &amp; Frequency Rules</h4>
            </div>
            {successMsg && <span className="text-xs font-bold text-success animate-fade-in">{successMsg}</span>}
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-3 text-xs">
            {/* Master Switch */}
            <div className="flex items-center justify-between rounded-xl bg-black/[0.02] p-2.5">
              <div>
                <b className="block text-ink">Enable Social Proof Popups</b>
                <span className="text-muted">Site par trust signal popups dikhayein ya band karein</span>
              </div>
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) => setSettings((s) => ({ ...s, enabled: e.target.checked }))}
                className="h-5 w-5 cursor-pointer rounded"
              />
            </div>

            {/* Mode */}
            <div>
              <label className="block font-bold text-ink mb-1">Display Mode</label>
              <select
                value={settings.mode}
                onChange={(e) => setSettings((s) => ({ ...s, mode: e.target.value as "hybrid" | "custom" | "auto" }))}
                className="input h-9 text-xs"
              >
                <option value="hybrid">⚡ Hybrid (Recommended: Mix of real customer orders + custom highlights)</option>
                <option value="custom">🎯 Custom Only (Show only admin-defined products/cities)</option>
                <option value="auto">📦 Real Orders Only (Extract from actual database sales)</option>
              </select>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block font-bold text-ink mb-1" title="Time before first popup appears">
                  Initial Delay
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={settings.initialDelaySec}
                    onChange={(e) => setSettings((s) => ({ ...s, initialDelaySec: Number(e.target.value) }))}
                    className="input h-8 text-xs"
                  />
                  <span className="text-muted">sec</span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-ink mb-1" title="Time between successive popups">
                  Interval
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={5}
                    max={300}
                    value={settings.intervalSec}
                    onChange={(e) => setSettings((s) => ({ ...s, intervalSec: Number(e.target.value) }))}
                    className="input h-8 text-xs"
                  />
                  <span className="text-muted">sec</span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-ink mb-1" title="How long popup stays visible">
                  Duration
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={2}
                    max={30}
                    value={settings.durationSec}
                    onChange={(e) => setSettings((s) => ({ ...s, durationSec: Number(e.target.value) }))}
                    className="input h-8 text-xs"
                  />
                  <span className="text-muted">sec</span>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={savingSettings}
              className="btn btn-primary h-8 w-full text-xs font-bold"
            >
              {savingSettings ? "Saving Settings..." : "Save Popup Settings"}
            </button>
          </form>
        </div>
      </div>

      {/* ───── Signals List Table ───── */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-ink">Custom Trust Signals ({signals.length})</h4>
          <button onClick={load} disabled={loading} className="grid h-7 w-7 place-items-center rounded-lg border border-black/10 hover:bg-black/5">
            <RefreshCw size={13} className={cn(loading && "animate-spin")} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[750px] text-sm">
            <thead className="border-b border-line text-left text-xs uppercase text-muted">
              <tr>
                <th className="py-2.5">City</th>
                <th>Product &amp; Model</th>
                <th>Time Label</th>
                <th>Thumbnail Style</th>
                <th>Active</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {signals.map((s) => (
                <tr key={s.id} className="transition-colors hover:bg-black/[0.015]">
                  <td className="py-3">
                    <span className="flex items-center gap-1 font-bold text-ink">
                      <MapPin size={13} className="text-accent" /> {s.city}
                    </span>
                  </td>
                  <td>
                    <b className="block text-ink">{s.productName}</b>
                    {s.modelName && <span className="text-xs text-muted">for {s.modelName}</span>}
                  </td>
                  <td>
                    <span className="inline-flex items-center gap-1 rounded bg-black/[0.04] px-2 py-0.5 text-xs text-muted">
                      <Clock size={11} /> {s.timeAgoText}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <span className="h-4 w-4 rounded-full border border-black/20" style={{ backgroundColor: s.colorHex }} />
                      <span className="text-xs text-muted">{s.material || "clear"}</span>
                    </div>
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={s.active}
                      onChange={() => handleToggle(s.id, s.active)}
                      className="cursor-pointer"
                    />
                  </td>
                  <td className="text-right space-x-1.5">
                    <button onClick={() => openEdit(s)} className="chip text-[11px] hover:!bg-ink hover:!text-white">
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(s.id, s.productName)}
                      className="inline-grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-danger/10 hover:text-danger align-middle"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ───── Create / Edit Signal Modal ───── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="card w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="text-lg font-bold text-ink">
                {editingId ? "Edit Trust Signal" : "Add Trust Signal Popup"}
              </h3>
              <button onClick={() => setShowModal(false)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-black/10">
                <X size={16} />
              </button>
            </div>

            {err && <div className="mt-3 rounded-xl bg-danger/10 p-2.5 text-xs text-danger font-medium">{err}</div>}

            <form onSubmit={handleSaveSignal} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-ink mb-1">Customer City</label>
                <div className="flex gap-2">
                  <select
                    value={PK_CITIES.includes(city) ? city : "Other"}
                    onChange={(e) => {
                      if (e.target.value !== "Other") setCity(e.target.value);
                    }}
                    className="input h-9 text-xs w-36"
                  >
                    {PK_CITIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                    <option value="Other">Other...</option>
                  </select>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Type city..."
                    className="input h-9 text-xs flex-1"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-ink mb-1">Product Name *</label>
                <input
                  type="text"
                  required
                  value={productName}
                  onChange={(e) => {
                    setProductName(e.target.value);
                    if (!editingId) setProductSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
                  }}
                  placeholder="e.g. Crystal Clear MagSafe Case"
                  className="input h-9 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink mb-1">Product Slug</label>
                <input
                  type="text"
                  value={productSlug}
                  onChange={(e) => setProductSlug(e.target.value)}
                  placeholder="e.g. crystal-clear-magsafe-case"
                  className="input h-9 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-ink mb-1">Phone Model (Optional)</label>
                  <input
                    type="text"
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    placeholder="e.g. iPhone 16 Pro Max"
                    className="input h-9 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-ink mb-1">Time Label</label>
                  <input
                    type="text"
                    value={timeAgoText}
                    onChange={(e) => setTimeAgoText(e.target.value)}
                    placeholder="e.g. 2 min ago, Just now"
                    className="input h-9 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-ink mb-1">Material Style</label>
                  <select value={material} onChange={(e) => setMaterial(e.target.value)} className="input h-9 text-xs">
                    <option value="clear">Clear Case</option>
                    <option value="frosted">Frosted Case</option>
                    <option value="silicone">Silicone Case</option>
                    <option value="leather">Leather Case</option>
                    <option value="carbon">Carbon Case</option>
                    <option value="skin-carbon">Carbon Skin</option>
                    <option value="glass-clear">Tempered Glass</option>
                    <option value="gadget-charger">GaN Charger</option>
                    <option value="gadget-earbuds">Earbuds</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-ink mb-1">Thumbnail Color</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={colorHex}
                      onChange={(e) => setColorHex(e.target.value)}
                      className="h-9 w-9 rounded-lg border border-black/10 cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={colorHex}
                      onChange={(e) => setColorHex(e.target.value)}
                      className="input h-9 text-xs flex-1"
                    />
                  </div>
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="rounded"
                />
                <span>Active (Dikhayein)</span>
              </label>

              <div className="flex justify-end gap-2 border-t border-line pt-3">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary text-xs">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn btn-primary text-xs font-bold">
                  {submitting ? "Saving..." : editingId ? "Save Changes" : "Create Signal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
