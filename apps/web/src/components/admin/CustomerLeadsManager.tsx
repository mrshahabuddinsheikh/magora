"use client";

import { useEffect, useState, useCallback } from "react";
import { 
  FileSpreadsheet, MessageCircle, Phone, RefreshCw, 
  Search, Trash2, Users, ShoppingBag, Sparkles 
} from "lucide-react";
import { api, tokenStore } from "@/lib/client-api";
import { money } from "@/lib/format";
import { PUBLIC_API_URL } from "@/lib/config";

interface CustomerLead {
  id: number;
  phone: string;
  name: string | null;
  email: string | null;
  city: string | null;
  source: string;
  preferredModel: string | null;
  interests: string | null;
  cartValue: number;
  cartItemsSummary: string | null;
  lastVisitedPage: string | null;
  visitCount: number;
  convertedOrder: boolean;
  whatsappCommunityOptIn: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface LeadsMeta {
  totalLeads: number;
  whatsappCommunityReady: number;
  cartAbandoned: number;
  totalPotentialValue: number;
}

export function CustomerLeadsManager() {
  const [leads, setLeads] = useState<CustomerLead[]>([]);
  const [meta, setMeta] = useState<LeadsMeta>({
    totalLeads: 0,
    whatsappCommunityReady: 0,
    cartAbandoned: 0,
    totalPotentialValue: 0,
  });
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [exporting, setExporting] = useState(false);

  const loadLeads = useCallback(async () => {
    setLoading(true);
    try {
      const u = new URLSearchParams();
      if (q.trim()) u.set("q", q.trim());
      if (sourceFilter) u.set("source", sourceFilter);

      const res = await api<{ data: CustomerLead[]; meta: LeadsMeta }>(`/admin/leads?${u.toString()}`);
      setLeads(res.data);
      if (res.meta) setMeta(res.meta);
    } catch (err) {
      console.error("Load leads error:", err);
    } finally {
      setLoading(false);
    }
  }, [q, sourceFilter]);

  useEffect(() => {
    const timer = setTimeout(loadLeads, 250);
    return () => clearTimeout(timer);
  }, [loadLeads]);

  const deleteLead = async (id: number, phone: string) => {
    if (!confirm(`Delete lead with number ${phone}?`)) return;
    try {
      await api(`/admin/leads/${id}`, { method: "DELETE" });
      loadLeads();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete lead";
      alert(msg);
    }
  };

  const downloadCsv = async () => {
    setExporting(true);
    try {
      const token = tokenStore.get();
      const res = await fetch(`${PUBLIC_API_URL}/api/v1/admin/leads/export.csv`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
        },
      });

      if (!res.ok) throw new Error("Failed to export CSV");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `magora_customer_phone_numbers_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not download Excel file. Please try again.";
      alert(msg);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">
              Audience Growth &amp; Behavioral CRM
            </span>
            <h2 className="text-xl font-bold text-ink">
              Customer Phone Numbers &amp; WhatsApp Leads
            </h2>
            <p className="text-xs text-muted">
              Auto-captured customer mobile numbers, phone models, and abandoned cart behavior ready for WhatsApp Broadcasts &amp; Community marketing.
            </p>
          </div>

          {/* Excel Export Button */}
          <div className="flex items-center gap-2">
            <button
              onClick={downloadCsv}
              disabled={exporting || leads.length === 0}
              className="btn h-11 px-5 text-sm font-bold bg-[#107c41] hover:bg-[#0c6133] text-white shadow-md flex items-center gap-2"
              title="Download entire phone directory as an Excel CSV"
            >
              <FileSpreadsheet size={18} />
              {exporting ? "Exporting Excel…" : "Download Excel / CSV"}
            </button>
            <button
              onClick={loadLeads}
              disabled={loading}
              className="grid h-11 w-11 place-items-center rounded-2xl bg-black/5 hover:bg-black/10 text-ink"
              title="Refresh"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* 4 Metric Badges */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-line bg-black/[0.02] p-3.5">
            <span className="text-xs font-semibold text-muted flex items-center gap-1.5">
              <Phone size={13} className="text-ink" /> Total Numbers
            </span>
            <b className="mt-1 block text-2xl font-extrabold text-ink tabular-nums">
              {meta.totalLeads}
            </b>
            <span className="text-[11px] text-muted">All active contacts</span>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3.5">
            <span className="text-xs font-semibold text-emerald-800 flex items-center gap-1.5">
              <MessageCircle size={13} className="text-emerald-700" /> WhatsApp Ready
            </span>
            <b className="mt-1 block text-2xl font-extrabold text-emerald-950 tabular-nums">
              {meta.whatsappCommunityReady}
            </b>
            <span className="text-[11px] text-emerald-700">Community opt-ins</span>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-3.5">
            <span className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
              <ShoppingBag size={13} className="text-amber-700" /> Cart Abandoned
            </span>
            <b className="mt-1 block text-2xl font-extrabold text-amber-950 tabular-nums">
              {meta.cartAbandoned}
            </b>
            <span className="text-[11px] text-amber-700">High-intent recovery</span>
          </div>

          <div className="rounded-2xl border border-line bg-black/[0.02] p-3.5">
            <span className="text-xs font-semibold text-muted flex items-center gap-1.5">
              <Sparkles size={13} className="text-accent" /> Potential Cart Value
            </span>
            <b className="mt-1 block text-2xl font-extrabold text-ink tabular-nums">
              {money(meta.totalPotentialValue)}
            </b>
            <span className="text-[11px] text-muted">Pending customer bags</span>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={15} className="absolute left-3 top-3 text-muted" />
            <input
              type="text"
              className="input h-10 pl-9 text-xs"
              placeholder="Search by phone, customer name, city, or phone model…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="input h-10 text-xs w-auto"
          >
            <option value="">All Sources</option>
            <option value="lead_popup">VIP Lead Popup (Rs. 300 Off)</option>
            <option value="cart_abandoned">Cart Abandoned</option>
            <option value="checkout">Checkout</option>
            <option value="whatsapp_community">WhatsApp Community</option>
          </select>
        </div>
      </div>

      {/* Leads Table */}
      <div className="card p-4 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-xs">
            <thead className="border-b border-line text-left uppercase text-muted font-bold">
              <tr>
                <th className="py-2.5">Customer / Mobile</th>
                <th>Model &amp; Interest</th>
                <th>Source</th>
                <th>Cart Items / Value</th>
                <th>WhatsApp Opt-in</th>
                <th>Captured Date</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {leads.map((lead) => {
                const cleanPhone = lead.phone.replace(/\D/g, "");
                const waNumber = cleanPhone.startsWith("0") ? `92${cleanPhone.slice(1)}` : cleanPhone;
                const waMsg = encodeURIComponent(
                  `Assalam o Alaikum ${lead.name || "Customer"}! Magora team se rabta kar rahe hain. Aap ke phone (${lead.preferredModel || "device"}) ke liye special 10% discount coupon code active hai: MAGORA10`
                );
                return (
                  <tr key={lead.id} className="hover:bg-black/[0.01]">
                    <td className="py-3">
                      <b className="block text-sm text-ink">{lead.phone}</b>
                      <span className="text-muted">
                        {lead.name || "Guest Visitor"} {lead.city ? `· ${lead.city}` : ""}
                      </span>
                    </td>
                    <td>
                      <b className="block text-ink">{lead.preferredModel || "—"}</b>
                      <span className="text-muted line-clamp-1">{lead.interests || "General accessories"}</span>
                    </td>
                    <td>
                      <span className="rounded-md bg-black/5 px-2 py-0.5 font-semibold text-ink capitalize">
                        {lead.source.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td>
                      <b className="block text-ink">{lead.cartValue > 0 ? money(lead.cartValue) : "—"}</b>
                      <span className="text-muted line-clamp-1">{lead.cartItemsSummary || "—"}</span>
                    </td>
                    <td>
                      {lead.whatsappCommunityOptIn ? (
                        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 font-bold text-emerald-800">
                          YES
                        </span>
                      ) : (
                        <span className="text-muted">NO</span>
                      )}
                    </td>
                    <td className="text-muted">
                      {new Date(lead.createdAt).toLocaleDateString()}
                    </td>
                    <td className="text-right whitespace-nowrap">
                      <a
                        href={`https://wa.me/${waNumber}?text=${waMsg}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="chip h-7 px-2.5 bg-[#25d366] text-white font-bold hover:bg-[#20ba59] mr-1.5"
                        title="Open WhatsApp chat with prefilled greeting"
                      >
                        <MessageCircle size={13} /> Chat
                      </a>
                      <button
                        onClick={() => deleteLead(lead.id, lead.phone)}
                        className="chip h-7 px-2 text-danger hover:bg-rose-50"
                        title="Delete contact"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {leads.length === 0 && !loading && (
            <div className="py-12 text-center text-muted">
              <Users size={32} className="mx-auto mb-2 opacity-30" />
              <p>No customer numbers match your current filter.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
