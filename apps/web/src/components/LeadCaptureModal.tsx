"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Check, Copy, Gift, Sparkles, X, MessageCircle } from "lucide-react";
import { api } from "@/lib/client-api";
import { WHATSAPP } from "@/lib/config";

const POPULAR_MODELS = [
  "iPhone 16 Pro Max",
  "iPhone 16 Pro",
  "iPhone 15 Pro Max",
  "Galaxy S25 Ultra",
  "Galaxy S24 Ultra",
  "iPhone 14 Pro Max",
  "Google Pixel 9 Pro",
  "Other Model",
];

export function LeadCaptureModal() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [model, setModel] = useState(POPULAR_MODELS[0]);
  const [optIn, setOptIn] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Check if user already submitted lead or dismissed recently
    const submitted = localStorage.getItem("mg_lead_submitted");
    if (submitted) return;

    const dismissed = localStorage.getItem("mg_lead_dismissed");
    if (dismissed && Date.now() - Number(dismissed) < 24 * 3600 * 1000) {
      queueMicrotask(() => setMinimized(true));
      return;
    }

    // Auto open modal after 12 seconds
    const timer = setTimeout(() => {
      setOpen(true);
    }, 12000);

    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!phone.trim()) {
      setError("Please enter your WhatsApp mobile number.");
      return;
    }

    setSubmitting(true);
    try {
      await api("/leads", {
        method: "POST",
        auth: false,
        json: {
          phone: phone.trim(),
          name: name.trim() || undefined,
          preferredModel: model,
          source: "lead_popup",
          whatsappCommunityOptIn: optIn,
          lastVisitedPage: typeof window !== "undefined" ? window.location.pathname : "/",
        },
      });

      localStorage.setItem("mg_lead_submitted", "true");
      setSuccess(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Please enter a valid Pakistani mobile number (e.g. 0300 1234567).";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const dismiss = () => {
    setOpen(false);
    setMinimized(true);
    localStorage.setItem("mg_lead_dismissed", String(Date.now()));
  };

  const copyCoupon = () => {
    navigator.clipboard.writeText("VIP300");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (pathname?.startsWith("/admin")) return null;

  // Minimized floating trigger pill removed per user request
  if (minimized && !open) {
    return null;
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="relative w-full max-w-md overflow-hidden rounded-[28px] border border-line bg-white p-6 shadow-2xl sm:p-8">
        {/* Close Button */}
        <button
          onClick={dismiss}
          className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-black/5 text-muted hover:bg-black/10 hover:text-ink"
          aria-label="Close"
        >
          <X size={16} />
        </button>

        {!success ? (
          <div>
            {/* Header */}
            <div className="text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
                <Sparkles size={14} className="text-amber-700" /> Instant Welcome Voucher
              </span>
              <h3 className="mt-2 text-2xl font-bold tracking-tight text-ink">
                Get <span className="text-amber-600">Rs. 300 OFF</span> &amp; Join VIP WhatsApp Club
              </h3>
              <p className="mt-1 text-xs text-muted leading-relaxed">
                Enter your WhatsApp number to unlock your instant discount voucher and get exclusive access to unreleased case drops &amp; flash deals.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="mt-6 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-ink mb-1">
                  WhatsApp Mobile Number *
                </label>
                <input
                  type="tel"
                  className="input text-sm"
                  placeholder="e.g. 0300 1234567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">
                    Your Name (Optional)
                  </label>
                  <input
                    type="text"
                    className="input text-sm"
                    placeholder="e.g. Ahmed"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">
                    Your Phone Model
                  </label>
                  <select
                    className="input text-xs"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                  >
                    {POPULAR_MODELS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* WhatsApp Community Opt-in */}
              <label className="flex items-start gap-2.5 text-xs text-ink/80 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={optIn}
                  onChange={(e) => setOptIn(e.target.checked)}
                  className="h-4 w-4 mt-0.5 rounded cursor-pointer"
                />
                <span>
                  Add me to Magora&apos;s VIP WhatsApp Community for early access to new cases &amp; secret giveaways.
                </span>
              </label>

              {error && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 p-2.5 text-xs text-danger text-center">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="btn btn-primary h-12 w-full text-sm font-bold shadow-md bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white border-none mt-2"
              >
                {submitting ? "Unlocking Voucher…" : "Unlock Rs. 300 Discount Voucher"}
              </button>
            </form>

            <p className="mt-3 text-center text-[11px] text-muted">
              🔒 We respect your privacy. No spam, only genuine discount drops.
            </p>
          </div>
        ) : (
          /* Success Screen */
          <div className="text-center py-4 space-y-4">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-700">
              <Check size={32} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-ink">You&apos;re in the VIP Club!</h3>
              <p className="text-xs text-muted mt-1">Here is your exclusive Rs. 300 discount code:</p>
            </div>

            <div className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/60 p-3">
              <span className="font-mono text-xl font-extrabold text-amber-900 tracking-wider">
                VIP300
              </span>
              <button
                onClick={copyCoupon}
                className="chip h-8 text-xs font-semibold bg-white shadow-sm"
              >
                {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />} {copied ? "Copied" : "Copy"}
              </button>
            </div>

            <p className="text-xs text-muted">Use this code at checkout on any order over Rs. 2,000.</p>

            <div className="pt-2">
              <a
                href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent("Assalam o Alaikum! I joined the VIP community with code VIP300.")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn bg-[#25d366] text-white text-xs h-11 w-full font-bold flex items-center justify-center gap-2 shadow-sm"
              >
                <MessageCircle size={16} /> Open VIP WhatsApp Chat
              </a>
              <button
                onClick={() => setOpen(false)}
                className="mt-2 text-xs text-muted hover:underline"
              >
                Continue Shopping
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
