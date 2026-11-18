"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, MessageCircle, PackagePlus, RefreshCw, ShoppingCart, Sparkles, TrendingDown } from "lucide-react";
import { api } from "@/lib/client-api";
import { money } from "@/lib/format";

interface LowStockItem {
  variantId: number;
  productId: number;
  productName: string;
  productSlug: string;
  modelId: number | null;
  modelName: string | null;
  colorId: number;
  colorName: string;
  sku: string;
  stock: number;
  price: number;
}

interface LowStockResponse {
  count: number;
  threshold: number;
  items: LowStockItem[];
  whatsappSupplierMessage: string;
}

export function InventoryAlerts() {
  const [data, setData] = useState<LowStockResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [restockingId, setRestockingId] = useState<number | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const res = await api<LowStockResponse>("/admin/inventory/low-stock?threshold=5");
      setData(res);
    } catch {}
    finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, []);

  const handleQuickRestock = async (variantId: number, addQty: number) => {
    setRestockingId(variantId);
    try {
      await api("/admin/inventory/quick-restock", {
        method: "POST",
        json: { variantId, addQty },
      });
      setSuccessMsg(`✓ Stock updated: +${addQty} items added!`);
      setTimeout(() => setSuccessMsg(null), 3000);
      await loadAlerts();
    } catch (e: any) {
      alert(e.message || "Restock failed");
    } finally {
      setRestockingId(null);
    }
  };

  if (loading) {
    return <div className="skeleton h-32 w-full rounded-2xl" />;
  }

  const items = data?.items || [];

  return (
    <div className="card p-5 sm:p-6 space-y-4 border border-amber-500/20 bg-gradient-to-b from-amber-500/[0.03] to-transparent">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-line">
        <div className="flex items-center gap-2.5">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold">
            <AlertTriangle size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-ink flex items-center gap-2">
              <span>Low Stock Alerts & Inventory Guard</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                items.length > 0 ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" : "bg-success/15 text-success"
              }`}>
                {items.length > 0 ? `${items.length} Variants Low` : "Stock Healthy"}
              </span>
            </h3>
            <p className="text-xs text-muted">
              Threshold: stock &le; 5 units. Auto-detects fast-depleting phone case and skin variants.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {data?.whatsappSupplierMessage && items.length > 0 && (
            <a
              target="_blank"
              rel="noopener noreferrer"
              href={`https://wa.me/?text=${encodeURIComponent(data.whatsappSupplierMessage)}`}
              className="btn btn-secondary h-9 px-3 text-xs font-bold text-[#25D366] hover:bg-[#25D366]/10 flex items-center gap-1.5 shadow-sm"
              title="Share restock list with warehouse supplier via WhatsApp"
            >
              <MessageCircle size={14} />
              <span>WhatsApp Supplier Reorder</span>
            </a>
          )}
          <button
            type="button"
            onClick={loadAlerts}
            className="btn btn-ghost h-9 px-2 text-xs"
            aria-label="Refresh stock alerts"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="rounded-xl border border-success/30 bg-success/10 p-2.5 text-xs font-bold text-success flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 size={15} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Items List */}
      {items.length === 0 ? (
        <div className="text-center py-6 text-xs text-muted">
          ✓ All active products and phone models have sufficient inventory (above threshold).
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.variantId}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl border border-line bg-white/70 dark:bg-white/[0.02] hover:border-accent/40 transition"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-ink truncate">{item.productName}</span>
                  <span className="rounded-md bg-black/[0.04] dark:bg-white/10 px-1.5 py-0.2 text-[10px] font-mono text-muted">
                    {item.sku}
                  </span>
                </div>
                <div className="text-xs text-muted flex items-center gap-2 mt-0.5">
                  <span>📱 {item.modelName || "Standard Model"}</span>
                  <span>·</span>
                  <span>🎨 {item.colorName}</span>
                  <span>·</span>
                  <span>{money(item.price)}</span>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">Stock Left</span>
                  <span className={`font-mono text-sm font-bold ${
                    item.stock <= 1 ? "text-danger animate-pulse" : "text-amber-600 dark:text-amber-400"
                  }`}>
                    {item.stock} left
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={restockingId === item.variantId}
                    onClick={() => handleQuickRestock(item.variantId, 10)}
                    className="btn btn-secondary h-8 px-2 text-[11px] font-bold"
                    title="Add +10 units"
                  >
                    +10
                  </button>
                  <button
                    type="button"
                    disabled={restockingId === item.variantId}
                    onClick={() => handleQuickRestock(item.variantId, 25)}
                    className="btn btn-secondary h-8 px-2 text-[11px] font-bold"
                    title="Add +25 units"
                  >
                    +25
                  </button>
                  <button
                    type="button"
                    disabled={restockingId === item.variantId}
                    onClick={() => handleQuickRestock(item.variantId, 50)}
                    className="btn btn-primary h-8 px-2.5 text-[11px] font-bold"
                    title="Add +50 units"
                  >
                    +50
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
