"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Lock, ShieldCheck, Truck, X, Zap } from "lucide-react";
import { money, cn } from "@/lib/format";
import { api } from "@/lib/client-api";

const QUICK_CITIES = ["Karachi", "Lahore", "Islamabad", "Rawalpindi", "Faisalabad", "Peshawar", "Multan"];

interface FastCodModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: {
    id: number;
    name: string;
    slug: string;
    price: number;
  };
  modelName?: string;
  colorName?: string;
  colorHex?: string;
  variantId?: number;
  custom?: any;
}

export function FastCodModal({
  isOpen,
  onClose,
  product,
  modelName,
  colorName,
  colorHex,
  variantId,
  custom,
}: FastCodModalProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("Karachi");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const subtotal = product.price;
  const shipping = subtotal >= 3000 ? 0 : 200;
  const total = subtotal + shipping;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!variantId) {
      setError("Please select your phone model and color first.");
      return;
    }
    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }
    if (!phone.trim()) {
      setError("Please enter your mobile phone number.");
      return;
    }
    if (!address.trim()) {
      setError("Please enter your complete delivery address.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await api<{
        data: {
          order: {
            number: string;
            accessToken: string;
            total: number;
          };
        };
      }>("/orders/fast-cod", {
        method: "POST",
        json: {
          variantId,
          qty: 1,
          customer: { name: name.trim(), phone: phone.trim() },
          address: { city: city.trim(), line1: address.trim() },
          notes: notes.trim() || undefined,
          custom: custom || undefined,
        },
      });

      const order = res.data.order;
      onClose();
      // Redirect to confirmed order page
      router.push(`/order/${order.number}?token=${order.accessToken}`);
    } catch (err: any) {
      setError(err?.message || "Could not book order. Please check your phone number and address.");
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg rounded-t-[32px] sm:rounded-[32px] bg-white dark:bg-neutral-900 border border-line p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-line">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-accent/10 text-accent font-bold">
              <Zap size={18} />
            </span>
            <div>
              <h2 className="text-lg font-bold leading-none text-ink">1-Click Quick Order</h2>
              <p className="text-xs text-muted mt-0.5">Cash on Delivery across Pakistan</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full bg-neutral-100 dark:bg-neutral-800 text-muted hover:text-ink transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Selected Product Summary */}
        <div className="rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 p-3.5 flex items-center justify-between">
          <div className="space-y-1">
            <h3 className="font-bold text-sm text-ink">{product.name}</h3>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              {modelName && <span className="chip py-0.5 px-2 text-[11px] font-semibold">{modelName}</span>}
              {colorName && (
                <span className="flex items-center gap-1.5 chip py-0.5 px-2 text-[11px]">
                  {colorHex && <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colorHex }} />}
                  {colorName}
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="font-extrabold text-base text-ink">{money(total)}</p>
            <p className="text-[11px] text-muted">
              {shipping === 0 ? "Free delivery" : "+Rs.200 COD fee"}
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {error && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 p-2.5 text-xs font-semibold text-rose-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-ink mb-1">Your Full Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Muhammad Hamza"
              className="input w-full h-11 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink mb-1">Mobile Phone Number (For Courier Rider)</label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0300 1234567"
              className="input w-full h-11 text-sm font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink mb-1">Delivery City</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {QUICK_CITIES.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setCity(c)}
                  className={cn(
                    "chip text-xs py-1 px-2.5 transition",
                    city === c && "bg-ink text-white font-bold dark:bg-white dark:text-neutral-900",
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
            {city.toLowerCase() !== "karachi" && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-900 dark:text-amber-200">
                <span className="font-bold">⚠️ Notice for {city}:</span> Cash on Delivery is currently available in Karachi only. Your order for {city} will be confirmed via Online Payment (Payoneer / Card / Bank Transfer).
              </div>
            )}
            <input
              type="text"
              required
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="City name"
              className="input w-full h-10 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink mb-1">Complete Street / Delivery Address</label>
            <textarea
              required
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="House #, Street #, Sector / Area or Landmark"
              className="input w-full p-2.5 text-sm resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1">Rider Instructions (Optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Call before delivery, deliver after 2 PM"
              className="input w-full h-9 text-xs"
            />
          </div>

          {/* Submit CTA */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary w-full h-13 text-[15px] font-bold gap-2 shadow-lg hover:shadow-xl"
            >
              {submitting ? (
                "Booking your order..."
              ) : city.toLowerCase() === "karachi" ? (
                <>
                  <Lock size={15} /> Confirm Order · Pay {money(total)} on Delivery
                </>
              ) : (
                <>
                  <Lock size={15} /> Confirm Order · Online Payment ({money(total)})
                </>
              )}
            </button>
            <p className="mt-2 text-center text-[11px] text-muted flex items-center justify-center gap-1.5">
              <ShieldCheck size={13} className="text-emerald-500" />
              {city.toLowerCase() === "karachi"
                ? "Pay rider when you receive the parcel · 7-day easy exchange"
                : `100% Secure payment · Fast tracked delivery to ${city}`}
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
