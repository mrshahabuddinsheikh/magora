"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock,
  Coins,
  DollarSign,
  Filter,
  Info,
  MinusCircle,
  PlusCircle,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  Sparkles,
  UserCheck,
  X,
  XCircle,
} from "lucide-react";
import { api } from "@/lib/client-api";
import { cn, money } from "@/lib/format";
import type { CoinTransaction, LoyaltyConfig } from "@/lib/types";

export function LoyaltyManager() {
  const [activeSubTab, setActiveSubTab] = useState<"settings" | "ledger">("settings");

  // Settings State
  const [settings, setSettings] = useState<LoyaltyConfig>({
    enabled: true,
    coinRatePct: 5,
    coinValuePkr: 1,
    minOrderPkr: 0,
    customBadgeTemplate: "Earn {coins} Magora Coins (Rs. {discount} discount on your next order)",
    termsNotice:
      "Magora Coins are promotional loyalty rewards provided at Magora's sole discretion. Magora reserves the absolute right to modify, suspend, reject, cancel, or revoke any Magora Coins, rewards, or discounts earned or redeemed on any order at its sole discretion without prior notice (including suspected abuse, cancellations, or returns). Coins hold no cash redemption value outside the platform.",
  });
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Ledger State
  const [transactions, setTransactions] = useState<CoinTransaction[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [ledgerQ, setLedgerQ] = useState("");
  const [ledgerStatus, setLedgerStatus] = useState<string>("all");
  const [ledgerSummary, setLedgerSummary] = useState({
    totalEarned: 0,
    totalRedeemed: 0,
    pendingCoins: 0,
    rejectedCoins: 0,
  });
  const [actionId, setActionId] = useState<number | null>(null);

  // Manual Adjustment Modal State
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [adjPhone, setAdjPhone] = useState("");
  const [adjName, setAdjName] = useState("");
  const [adjCoins, setAdjCoins] = useState<number>(100);
  const [adjNotes, setAdjNotes] = useState("");
  const [submittingAdj, setSubmittingAdj] = useState(false);

  // Load Settings
  const loadSettings = () => {
    setLoadingSettings(true);
    api<{ data: LoyaltyConfig }>("/admin/loyalty-settings")
      .then((res) => {
        if (res.data) setSettings(res.data);
      })
      .catch((err) => {
        setSettingsMsg({ type: "error", text: (err as Error).message || "Failed to load loyalty settings" });
      })
      .finally(() => setLoadingSettings(false));
  };

  // Load Ledger
  const loadLedger = () => {
    setLoadingLedger(true);
    const params = new URLSearchParams();
    if (ledgerQ.trim()) params.set("q", ledgerQ.trim());
    if (ledgerStatus && ledgerStatus !== "all") params.set("status", ledgerStatus);
    params.set("limit", "50");

    api<{
      data: CoinTransaction[];
      summary: { totalEarned: number; totalRedeemed: number; pendingCoins: number; rejectedCoins: number };
    }>(`/admin/loyalty-ledger?${params.toString()}`)
      .then((res) => {
        if (res.data) setTransactions(res.data);
        if (res.summary) setLedgerSummary(res.summary);
      })
      .catch(() => {})
      .finally(() => setLoadingLedger(false));
  };

  useEffect(() => {
    loadSettings();
    loadLedger();
  }, []);

  useEffect(() => {
    if (activeSubTab === "ledger") {
      const t = setTimeout(() => loadLedger(), 300);
      return () => clearTimeout(t);
    }
  }, [ledgerQ, ledgerStatus, activeSubTab]);

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsMsg(null);
    try {
      const res = await api<{ data: LoyaltyConfig }>("/admin/loyalty-settings", {
        method: "POST",
        json: {
          enabled: settings.enabled,
          coinRatePct: Number(settings.coinRatePct) || 5,
          coinValuePkr: Number(settings.coinValuePkr) || 1,
          minOrderPkr: Number(settings.minOrderPkr) || 0,
          customBadgeTemplate: settings.customBadgeTemplate.trim(),
          termsNotice: settings.termsNotice.trim(),
        },
      });
      setSettings(res.data);
      setSettingsMsg({ type: "success", text: "✓ Magora Coins & Loyalty Settings saved successfully!" });
      setTimeout(() => setSettingsMsg(null), 4000);
    } catch (err) {
      setSettingsMsg({ type: "error", text: (err as Error).message || "Failed to save loyalty settings" });
    } finally {
      setSavingSettings(false);
    }
  };

  // Status Change: Accept / Reject
  const handleUpdateStatus = async (id: number, status: "approved" | "rejected") => {
    setActionId(id);
    try {
      await api(`/admin/loyalty-ledger/${id}/status`, {
        method: "POST",
        json: {
          status,
          notes: status === "rejected" ? "Cancelled/Revoked by Admin" : "Approved by Admin",
        },
      });
      setTransactions((prev) =>
        prev.map((t) => (t.id === id ? { ...t, status, notes: status === "rejected" ? "Cancelled by Admin" : "Approved" } : t)),
      );
      loadLedger();
    } catch (err) {
      alert((err as Error).message || "Failed to update transaction status");
    } finally {
      setActionId(null);
    }
  };

  // Manual Adjustment Submit
  const handleManualAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjPhone.trim()) return;
    setSubmittingAdj(true);
    try {
      await api("/admin/loyalty-ledger/manual-adjustment", {
        method: "POST",
        json: {
          customerPhone: adjPhone.trim(),
          customerName: adjName.trim() || undefined,
          amountCoins: Number(adjCoins),
          notes: adjNotes.trim() || (adjCoins >= 0 ? "Admin Grant" : "Admin Deduction"),
        },
      });
      setManualModalOpen(false);
      setAdjPhone("");
      setAdjName("");
      setAdjCoins(100);
      setAdjNotes("");
      loadLedger();
    } catch (err) {
      alert((err as Error).message || "Failed to apply manual adjustment");
    } finally {
      setSubmittingAdj(false);
    }
  };

  // Preview calculations for sample Rs. 2,299 case
  const samplePrice = 2299;
  const sampleCoins = Math.round(samplePrice * ((settings.coinRatePct || 5) / 100));
  const sampleDiscount = sampleCoins * (settings.coinValuePkr || 1);
  const previewBadge = (settings.customBadgeTemplate || "Earn {coins} Magora Coins (Rs. {discount} discount on your next order)")
    .replace("{coins}", String(sampleCoins))
    .replace("{discount}", String(sampleDiscount));

  return (
    <div className="space-y-6">
      {/* ── Sub-tab Navigation ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <div className="flex items-center gap-2">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-500/10 text-amber-600 font-bold">
            <Coins size={22} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-ink">Magora Coins & Loyalty Rewards</h2>
            <p className="text-xs text-muted">Control customer reward cashback, cancellation rights, and coin approvals</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 rounded-2xl bg-black/[0.04] dark:bg-white/[0.04] p-1">
          <button
            type="button"
            onClick={() => setActiveSubTab("settings")}
            className={cn(
              "rounded-xl px-3.5 py-1.5 text-xs font-semibold transition",
              activeSubTab === "settings"
                ? "bg-white dark:bg-white/10 text-ink dark:text-white shadow-sm font-bold"
                : "text-muted hover:text-ink",
            )}
          >
            ⚙️ Settings & Rule Engine
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab("ledger")}
            className={cn(
              "rounded-xl px-3.5 py-1.5 text-xs font-semibold transition flex items-center gap-1.5",
              activeSubTab === "ledger"
                ? "bg-white dark:bg-white/10 text-ink dark:text-white shadow-sm font-bold"
                : "text-muted hover:text-ink",
            )}
          >
            📋 Customer Coin Ledger
            {ledgerSummary.pendingCoins > 0 && (
              <span className="rounded-full bg-amber-500 px-1.5 py-0.2 text-[10px] font-bold text-white">
                {ledgerSummary.pendingCoins}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── TAB 1: Settings & Rule Engine ── */}
      {activeSubTab === "settings" && (
        <form onSubmit={handleSaveSettings} className="space-y-6">
          {settingsMsg && (
            <div
              className={cn(
                "rounded-2xl border p-4 text-sm font-medium flex items-center justify-between animate-in fade-in",
                settingsMsg.type === "success"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
                  : "bg-danger/10 border-danger/30 text-danger",
              )}
            >
              <span>{settingsMsg.text}</span>
              <button type="button" onClick={() => setSettingsMsg(null)}>
                <X size={16} />
              </button>
            </div>
          )}

          {/* Master ON / OFF Switch */}
          <div className="card rounded-[24px] p-5 sm:p-6 border border-line bg-white/70 dark:bg-white/[0.02]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-base text-ink">Master Loyalty Program Status</span>
                  {settings.enabled ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Active ON Storefront
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-neutral-500/10 border border-neutral-500/25 px-2.5 py-0.5 text-xs font-bold text-muted">
                      Disabled / Hidden
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  Jab ON ho ga to product pages par Magora Coins ka badge show ho ga aur customer coins earn kar payenge.
                  Jab OFF kar denge to ye poori store se bilkul gayab ho jaye ga.
                </p>
              </div>

              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={settings.enabled}
                  onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-14 h-7 bg-neutral-200 dark:bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-accent" />
              </label>
            </div>
          </div>

          {/* Value & Calculation Rules */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Cashback Rate % */}
            <div className="card rounded-[24px] p-5 border border-line bg-white/70 dark:bg-white/[0.02] space-y-2">
              <label className="text-xs font-bold text-ink uppercase tracking-wider block">
                Cashback Rate (%)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={settings.coinRatePct}
                  onChange={(e) => setSettings({ ...settings, coinRatePct: Number(e.target.value) || 0 })}
                  className="input h-11 text-base font-bold text-ink"
                  placeholder="5"
                />
                <span className="text-sm font-bold text-muted">%</span>
              </div>
              <p className="text-[11px] text-muted leading-relaxed">
                Order amount ka kitna % Magora Coins banna chahiye (Default: 5%). Rs. 2,299 case par {sampleCoins} coins milenge.
              </p>
            </div>

            {/* 1 Coin Value in PKR */}
            <div className="card rounded-[24px] p-5 border border-line bg-white/70 dark:bg-white/[0.02] space-y-2">
              <label className="text-xs font-bold text-ink uppercase tracking-wider block">
                Coin Value (in PKR)
              </label>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-muted">Rs.</span>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={settings.coinValuePkr}
                  onChange={(e) => setSettings({ ...settings, coinValuePkr: Number(e.target.value) || 1 })}
                  className="input h-11 text-base font-bold text-ink"
                  placeholder="1"
                />
              </div>
              <p className="text-[11px] text-muted leading-relaxed">
                1 Magora Coin kitne Pakistani Rupee ke discount ke barabar hai (Default: 1 Coin = Rs. 1).
              </p>
            </div>

            {/* Min Order Value */}
            <div className="card rounded-[24px] p-5 border border-line bg-white/70 dark:bg-white/[0.02] space-y-2">
              <label className="text-xs font-bold text-ink uppercase tracking-wider block">
                Min Order for Coins (PKR)
              </label>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-muted">Rs.</span>
                <input
                  type="number"
                  min="0"
                  value={settings.minOrderPkr}
                  onChange={(e) => setSettings({ ...settings, minOrderPkr: Number(e.target.value) || 0 })}
                  className="input h-11 text-base font-bold text-ink"
                  placeholder="0"
                />
              </div>
              <p className="text-[11px] text-muted leading-relaxed">
                Minimum order amount jis pe customer coins earn kar sake (0 = har order pe coins milenge).
              </p>
            </div>
          </div>

          {/* Custom Badge Text & Live Preview */}
          <div className="card rounded-[24px] p-5 sm:p-6 border border-line bg-white/70 dark:bg-white/[0.02] space-y-4">
            <div className="space-y-1">
              <h3 className="font-bold text-sm text-ink">Storefront Badge Text Template</h3>
              <p className="text-xs text-muted">
                Aap text ko apni marzi se edit kar sakte hain. Variables <code>{`{coins}`}</code> aur <code>{`{discount}`}</code> dynamically replace honge.
              </p>
            </div>

            <input
              type="text"
              value={settings.customBadgeTemplate}
              onChange={(e) => setSettings({ ...settings, customBadgeTemplate: e.target.value })}
              className="input h-11 text-sm font-medium text-ink w-full"
              placeholder="Earn {coins} Magora Coins (Rs. {discount} discount on your next order)"
            />

            {/* Live Preview */}
            <div className="rounded-2xl border border-line bg-black/[0.02] dark:bg-white/[0.02] p-4 space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted">
                Live Storefront Preview (Rs. {samplePrice} sample item)
              </div>
              {settings.enabled ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 text-xs font-bold text-amber-700 dark:text-amber-400">
                    <span>🪙</span>
                    <span>{previewBadge}</span>
                  </span>
                  <span className="text-[11px] font-semibold text-muted underline cursor-pointer">
                    T&Cs apply
                  </span>
                </div>
              ) : (
                <div className="text-xs text-muted italic">
                  Loyalty rewards currently disabled (Badge will not appear on product pages)
                </div>
              )}
            </div>
          </div>

          {/* Terms & Cancellation Notice */}
          <div className="card rounded-[24px] p-5 sm:p-6 border border-line bg-white/70 dark:bg-white/[0.02] space-y-3">
            <div className="flex items-center gap-2">
              <ShieldAlert size={18} className="text-amber-500" />
              <h3 className="font-bold text-sm text-ink">Terms & Cancellation Policy (Discretionary Rights)</h3>
            </div>
            <p className="text-xs text-muted leading-relaxed">
              Ye clause terms and conditions aur customer modal mein show hota hai taa ke legal tor par aap ke paas
              kisi bhi order ya customer ke coins cancel/revoke karne ka poora ikhtiyar rahe.
            </p>
            <textarea
              rows={4}
              value={settings.termsNotice}
              onChange={(e) => setSettings({ ...settings, termsNotice: e.target.value })}
              className="input py-3 text-xs font-medium text-ink w-full leading-relaxed resize-y"
              placeholder="Magora Coins are promotional loyalty rewards provided at Magora's sole discretion..."
            />
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={loadSettings}
              disabled={loadingSettings || savingSettings}
              className="btn btn-secondary text-xs h-10 px-4 font-semibold flex items-center gap-1.5"
            >
              <RefreshCw size={14} className={cn(loadingSettings && "animate-spin")} />
              Reset to Saved
            </button>

            <button
              type="submit"
              disabled={savingSettings}
              className="btn btn-primary h-11 px-6 text-xs font-bold flex items-center gap-2 shadow-lg shadow-accent/20"
            >
              {savingSettings ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />}
              {savingSettings ? "Saving Settings..." : "Save Loyalty Settings"}
            </button>
          </div>
        </form>
      )}

      {/* ── TAB 2: Customer Coin Ledger & Approvals ── */}
      {activeSubTab === "ledger" && (
        <div className="space-y-5">
          {/* Summary Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="card rounded-2xl p-4 border border-line bg-white/70 dark:bg-white/[0.02]">
              <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Total Coins Earned</div>
              <div className="text-2xl font-bold text-ink mt-1 tabular-nums">{ledgerSummary.totalEarned.toLocaleString()}</div>
              <div className="text-[11px] text-muted">Approved customer coins</div>
            </div>

            <div className="card rounded-2xl p-4 border border-line bg-white/70 dark:bg-white/[0.02]">
              <div className="text-[11px] font-bold uppercase tracking-wider text-blue-600">Total Redeemed</div>
              <div className="text-2xl font-bold text-ink mt-1 tabular-nums">{ledgerSummary.totalRedeemed.toLocaleString()}</div>
              <div className="text-[11px] text-muted">Used on discount checkouts</div>
            </div>

            <div className="card rounded-2xl p-4 border border-line bg-white/70 dark:bg-white/[0.02]">
              <div className="text-[11px] font-bold uppercase tracking-wider text-amber-600">Pending Review</div>
              <div className="text-2xl font-bold text-ink mt-1 tabular-nums">{ledgerSummary.pendingCoins.toLocaleString()}</div>
              <div className="text-[11px] text-muted">Awaiting admin review</div>
            </div>

            <div className="card rounded-2xl p-4 border border-line bg-white/70 dark:bg-white/[0.02]">
              <div className="text-[11px] font-bold uppercase tracking-wider text-red-600">Rejected / Cancelled</div>
              <div className="text-2xl font-bold text-ink mt-1 tabular-nums">{ledgerSummary.rejectedCoins.toLocaleString()}</div>
              <div className="text-[11px] text-muted">Revoked by admin</div>
            </div>
          </div>

          {/* Action Bar: Search, Filters & Manual Grant */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex flex-1 items-center gap-2 max-w-md">
              <div className="flex h-10 flex-1 items-center gap-2 rounded-2xl border border-line bg-white dark:bg-white/[0.04] px-3">
                <Search size={15} className="text-muted shrink-0" />
                <input
                  type="text"
                  value={ledgerQ}
                  onChange={(e) => setLedgerQ(e.target.value)}
                  placeholder="Search by customer phone, name, or order #..."
                  className="h-full flex-1 bg-transparent text-xs outline-none text-ink placeholder:text-muted"
                />
                {ledgerQ && (
                  <button type="button" onClick={() => setLedgerQ("")}>
                    <X size={14} className="text-muted hover:text-ink" />
                  </button>
                )}
              </div>

              <select
                value={ledgerStatus}
                onChange={(e) => setLedgerStatus(e.target.value)}
                className="h-10 rounded-2xl border border-line bg-white dark:bg-[#1a1c24] px-3 text-xs font-semibold text-ink outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="approved">Approved</option>
                <option value="pending">Pending</option>
                <option value="rejected">Rejected / Cancelled</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={loadLedger}
                disabled={loadingLedger}
                className="btn btn-secondary h-10 px-3 text-xs font-semibold"
                title="Refresh ledger"
              >
                <RefreshCw size={14} className={cn(loadingLedger && "animate-spin")} />
              </button>

              <button
                type="button"
                onClick={() => setManualModalOpen(true)}
                className="btn btn-primary h-10 px-4 text-xs font-bold flex items-center gap-1.5 shadow-sm"
              >
                <PlusCircle size={15} />
                <span>Grant / Deduct Coins</span>
              </button>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="card rounded-[24px] border border-line overflow-hidden bg-white/70 dark:bg-white/[0.02]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-line bg-black/[0.02] dark:bg-white/[0.02] text-muted font-bold uppercase tracking-wider text-[10.5px]">
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Order #</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Coins Amount</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Date & Notes</th>
                    <th className="py-3 px-4 text-right">Accept / Reject Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-muted">
                        {loadingLedger ? (
                          <div className="flex items-center justify-center gap-2">
                            <RefreshCw size={16} className="animate-spin text-accent" />
                            <span>Loading coin transactions...</span>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <p className="font-semibold text-ink">No coin transactions found</p>
                            <p className="text-[11px]">Orders placed by customers will automatically record coins here.</p>
                          </div>
                        )}
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tx) => {
                      const isPositive = tx.amountCoins > 0;
                      return (
                        <tr key={tx.id} className="hover:bg-black/[0.01] dark:hover:bg-white/[0.01] transition">
                          <td className="py-3 px-4">
                            <div className="font-bold text-ink">{tx.customerPhone}</div>
                            {tx.customerName && <div className="text-[11px] text-muted">{tx.customerName}</div>}
                          </td>

                          <td className="py-3 px-4">
                            {tx.orderNumber ? (
                              <span className="font-mono font-bold text-accent">#{tx.orderNumber}</span>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            <span className="capitalize font-medium text-ink/80">
                              {tx.type.replace("_", " ")}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <div className={cn("font-bold tabular-nums text-sm flex items-center gap-1", isPositive ? "text-emerald-600" : "text-blue-600")}>
                              <span>{isPositive ? "+" : ""}{tx.amountCoins} 🪙</span>
                            </div>
                            <div className="text-[10.5px] text-muted tabular-nums">
                              (Rs. {tx.amountPkr})
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            {tx.status === "approved" && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 size={12} /> Approved
                              </span>
                            )}
                            {tx.status === "pending" && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                                <Clock size={12} /> Pending Review
                              </span>
                            )}
                            {tx.status === "rejected" && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 border border-red-500/20 px-2 py-0.5 text-[11px] font-bold text-red-600 dark:text-red-400">
                                <XCircle size={12} /> Rejected / Cancelled
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 max-w-[200px]">
                            <div className="text-muted text-[11px]">
                              {new Date(tx.createdAt).toLocaleDateString("en-PK", {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </div>
                            {tx.notes && <div className="text-[11px] text-ink truncate" title={tx.notes}>{tx.notes}</div>}
                          </td>

                          {/* Accept / Reject Action Buttons */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {tx.status !== "approved" && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateStatus(tx.id, "approved")}
                                  disabled={actionId === tx.id}
                                  className="h-8 px-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500 hover:text-white text-emerald-700 dark:text-emerald-300 font-bold text-[11px] transition flex items-center gap-1"
                                  title="Accept & Approve Coins"
                                >
                                  <Check size={13} />
                                  <span>Accept</span>
                                </button>
                              )}

                              {tx.status !== "rejected" && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateStatus(tx.id, "rejected")}
                                  disabled={actionId === tx.id}
                                  className="h-8 px-2.5 rounded-xl bg-red-500/10 hover:bg-red-500 hover:text-white text-red-700 dark:text-red-300 font-bold text-[11px] transition flex items-center gap-1"
                                  title="Reject & Cancel Coins"
                                >
                                  <X size={13} />
                                  <span>Reject</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Manual Coin Adjustment Modal */}
          {manualModalOpen && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in"
              onClick={() => setManualModalOpen(false)}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="card max-w-md w-full p-5 sm:p-6 rounded-[28px] shadow-2xl bg-white dark:bg-[#151821] border border-line space-y-4"
              >
                <div className="flex items-center justify-between pb-3 border-b border-line">
                  <div className="flex items-center gap-2">
                    <Coins size={18} className="text-amber-500" />
                    <h3 className="font-bold text-base text-ink">Manual Coins Adjustment</h3>
                  </div>
                  <button type="button" onClick={() => setManualModalOpen(false)} className="text-muted hover:text-ink">
                    <X size={18} />
                  </button>
                </div>

                <form onSubmit={handleManualAdjustment} className="space-y-3.5">
                  <div>
                    <label className="text-xs font-bold text-ink block mb-1">Customer Phone Number *</label>
                    <input
                      type="text"
                      required
                      value={adjPhone}
                      onChange={(e) => setAdjPhone(e.target.value)}
                      placeholder="e.g. 03001234567"
                      className="input h-10 text-xs w-full"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-ink block mb-1">Customer Name (Optional)</label>
                    <input
                      type="text"
                      value={adjName}
                      onChange={(e) => setAdjName(e.target.value)}
                      placeholder="e.g. Shahab"
                      className="input h-10 text-xs w-full"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-ink block mb-1">
                      Coins Amount (+ to Grant, - to Deduct) *
                    </label>
                    <input
                      type="number"
                      required
                      value={adjCoins}
                      onChange={(e) => setAdjCoins(Number(e.target.value))}
                      className="input h-10 text-xs font-bold w-full tabular-nums"
                      placeholder="100 or -50"
                    />
                    <p className="text-[11px] text-muted mt-1">
                      Positive value (+100) will credit coins; negative (-50) will deduct/cancel coins.
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-ink block mb-1">Reason / Note *</label>
                    <input
                      type="text"
                      required
                      value={adjNotes}
                      onChange={(e) => setAdjNotes(e.target.value)}
                      placeholder="e.g. Customer loyalty gift or order resolution"
                      className="input h-10 text-xs w-full"
                    />
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setManualModalOpen(false)}
                      className="btn btn-secondary h-10 px-4 text-xs font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submittingAdj}
                      className="btn btn-primary h-10 px-5 text-xs font-bold flex items-center gap-1.5"
                    >
                      {submittingAdj ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                      {submittingAdj ? "Applying..." : "Apply Adjustment"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
