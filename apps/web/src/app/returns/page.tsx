"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  AlertTriangle, ArrowRight, CheckCircle2, HelpCircle, 
  RotateCcw 
} from "lucide-react";
import { api } from "@/lib/client-api";
import { money } from "@/lib/format";
import { WHATSAPP } from "@/lib/config";
import { ProductThumb } from "@/components/CaseThumb";

interface OrderItem {
  id: number;
  productSlug: string;
  productName: string;
  modelName?: string;
  colorName?: string;
  colorHex: string;
  unitPrice: number;
  qty: number;
  lineTotal: number;
  material: string;
}

interface OrderLookupResult {
  number: string;
  status: string;
  statusLabel: string;
  canReturn: boolean;
  returnDeadline: string | null;
  customer: { name: string; phone: string; email?: string };
  address: { city: string; area?: string; line1: string };
  items: OrderItem[];
  totals: { total: number };
  returns: { number: string; status: string; statusLabel: string; resolution: string; reason: string; createdAt: string }[];
}

interface ReturnDetail {
  number: string;
  orderNumber: string;
  status: string;
  statusLabel?: string;
  resolution: string;
  reason: string;
  exchangeNote?: string | null;
  refundMethod?: string | null;
  timeline?: { status: string; label?: string; note?: string | null; at: string }[];
}

const REASONS = [
  "Ordered the wrong phone model",
  "Doesn't fit properly",
  "Colour looks different",
  "Damaged or defective item",
  "Magnets are weak",
  "Received the wrong item",
  "Changed my mind",
  "Other",
];

export default function ReturnsPortalPage() {
  const [tab, setTab] = useState<"request" | "track">("request");

  // Lookup state
  const [orderNumber, setOrderNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderLookupResult | null>(null);

  // Return request form state
  const [selectedItems, setSelectedItems] = useState<Record<number, number>>({});
  const [resolution, setResolution] = useState<"exchange" | "refund">("exchange");
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState("");
  const [exchangeNote, setExchangeNote] = useState("");
  const [refundMethodType, setRefundMethodType] = useState<"jazzcash" | "easypaisa" | "bank">("easypaisa");
  const [accountTitle, setAccountTitle] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submittedReturnNumber, setSubmittedReturnNumber] = useState<string | null>(null);

  // Return tracking lookup state
  const [trackingReturnNumber, setTrackingReturnNumber] = useState("");
  const [trackingResult, setTrackingResult] = useState<ReturnDetail | null>(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingError, setTrackingError] = useState<string | null>(null);

  const lookupOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setOrder(null);
    setSubmittedReturnNumber(null);
    if (!orderNumber.trim() || !phone.trim()) {
      setError("Please enter both your Order Number and Mobile Number.");
      return;
    }
    setLoading(true);
    try {
      const res = await api<{ data: OrderLookupResult }>("/orders/track", {
        method: "POST",
        auth: false,
        json: { number: orderNumber.trim(), phone: phone.trim() },
      });
      setOrder(res.data);
      // Pre-select all items by default
      const initialSelected: Record<number, number> = {};
      res.data.items.forEach((item) => {
        initialSelected[item.id] = item.qty;
      });
      setSelectedItems(initialSelected);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Order not found. Please double check your order number (e.g. MG-10294) and 11-digit mobile number.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const submitReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;
    setError(null);

    const itemsToReturn = Object.entries(selectedItems)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => ({ orderItemId: Number(id), qty }));

    if (itemsToReturn.length === 0) {
      setError("Please select at least one item to return or exchange.");
      return;
    }

    if (resolution === "exchange" && !exchangeNote.trim()) {
      setError("Please tell us which phone model, color, or item you would like in exchange.");
      return;
    }

    if (resolution === "refund") {
      if (!accountTitle.trim() || !accountNumber.trim()) {
        setError("Please enter your account title and account/wallet number for the refund.");
        return;
      }
    }

    setSubmitting(true);
    const refundMethodString = resolution === "refund" ? `${refundMethodType.toUpperCase()} · ${accountTitle.trim()} · ${accountNumber.trim()}` : undefined;

    try {
      const res = await api<{ data: { number: string } }>(`/orders/${order.number}/returns`, {
        method: "POST",
        auth: false,
        json: {
          phone: phone.trim(),
          resolution,
          reason,
          details: details.trim() || undefined,
          exchangeNote: resolution === "exchange" ? exchangeNote.trim() : undefined,
          refundMethod: refundMethodString,
          items: itemsToReturn,
        },
      });
      setSubmittedReturnNumber(res.data.number);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not submit return request. Please try again or message us on WhatsApp.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const lookupReturnStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    setTrackingError(null);
    setTrackingResult(null);
    if (!trackingReturnNumber.trim()) {
      setTrackingError("Please enter your Return ID (e.g. RT10001).");
      return;
    }
    setTrackingLoading(true);
    try {
      const res = await api<{ data: ReturnDetail }>(`/returns/${trackingReturnNumber.trim()}`, {
        auth: false,
      });
      setTrackingResult(res.data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Return request not found. Please verify the Return ID.";
      setTrackingError(msg);
    } finally {
      setTrackingLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2 text-sm text-muted">
        <Link href="/" className="hover:text-ink">Home</Link>
        <span>/</span>
        <Link href="/help" className="hover:text-ink">Help</Link>
        <span>/</span>
        <span className="font-semibold text-ink">Online Returns &amp; Exchange Portal</span>
      </div>

      <div className="glass rounded-[32px] p-6 sm:p-10">
        {/* Header */}
        <div className="border-b border-line pb-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
            <RotateCcw size={14} /> 7-Day Hassle-Free Returns
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            Online Return &amp; Exchange Center
          </h1>
          <p className="mt-1 text-sm text-muted">
            Ordered the wrong model or not satisfied? Submit your request below in less than 2 minutes.
          </p>

          {/* Mode Switcher */}
          <div className="mt-6 flex gap-2">
            <button
              onClick={() => { setTab("request"); setError(null); }}
              className={`chip h-10 px-5 text-sm font-semibold transition ${
                tab === "request" ? "bg-ink text-white" : "bg-black/[0.04] text-ink hover:bg-black/[0.08]"
              }`}
            >
              Start New Return / Exchange
            </button>
            <button
              onClick={() => { setTab("track"); setError(null); }}
              className={`chip h-10 px-5 text-sm font-semibold transition ${
                tab === "track" ? "bg-ink text-white" : "bg-black/[0.04] text-ink hover:bg-black/[0.08]"
              }`}
            >
              Track Existing Return
            </button>
          </div>
        </div>

        {/* Tab 1: Start New Return */}
        {tab === "request" && (
          <div className="mt-8">
            {!order && !submittedReturnNumber && (
              <div>
                <h2 className="text-base font-bold text-ink">Step 1: Look Up Your Order</h2>
                <p className="mt-0.5 text-xs text-muted">Enter the order number from your receipt/SMS and the mobile number used.</p>

                <form onSubmit={lookupOrder} className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-ink mb-1.5">Order Number *</label>
                    <input
                      type="text"
                      className="input uppercase"
                      placeholder="e.g. MG-10294"
                      value={orderNumber}
                      onChange={(e) => setOrderNumber(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-ink mb-1.5">Mobile Number *</label>
                    <input
                      type="tel"
                      className="input"
                      placeholder="e.g. 0300 1234567"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                    />
                  </div>
                  {error && (
                    <div className="sm:col-span-2 rounded-2xl bg-rose-50 border border-rose-200 p-3.5 text-xs text-danger flex items-start gap-2">
                      <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}
                  <div className="sm:col-span-2">
                    <button type="submit" disabled={loading} className="btn btn-primary h-11 w-full sm:w-auto px-6 text-sm">
                      {loading ? "Searching Order…" : "Find Order & Continue"} <ArrowRight size={15} />
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Found Order - Details & Return Submission Form */}
            {order && !submittedReturnNumber && (
              <div className="space-y-6">
                {/* Order Summary Card */}
                <div className="rounded-2xl border border-line bg-black/[0.02] p-4 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
                    <div>
                      <span className="font-bold text-sm text-ink">{order.number}</span>
                      <span className="ml-2 text-muted">· {order.customer.name} ({order.address.city})</span>
                    </div>
                    <span className="rounded-full bg-white px-2.5 py-1 font-semibold text-ink shadow-sm">
                      Status: {order.statusLabel}
                    </span>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between text-muted">
                    <span>Total: <b>{money(order.totals.total)}</b></span>
                    <button
                      type="button"
                      onClick={() => setOrder(null)}
                      className="text-accent underline font-semibold"
                    >
                      Search another order
                    </button>
                  </div>
                </div>

                {/* Return eligibility check */}
                {!order.canReturn ? (
                  <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-900 space-y-2">
                    <p className="font-bold text-sm flex items-center gap-1.5">
                      <HelpCircle size={16} /> Order Not Eligible for Online Return
                    </p>
                    <p>
                      {order.status !== "delivered"
                        ? `This order is currently "${order.statusLabel}". Returns can only be submitted once the package is delivered to you by the courier rider.`
                        : "The 7-day return window for this order has expired, or a return request is already active for this order."}
                    </p>
                    {order.returns.length > 0 && (
                      <div className="mt-2 rounded-xl bg-white p-3 border border-amber-100">
                        <b className="text-ink">Active Return: {order.returns[0].number}</b>
                        <p className="text-muted">Status: {order.returns[0].statusLabel} ({order.returns[0].resolution})</p>
                      </div>
                    )}
                    <a
                      href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(`Assalam o Alaikum, I need assistance regarding return for order ${order.number}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 font-bold text-emerald-700 underline mt-2"
                    >
                      Need help? Message WhatsApp Support
                    </a>
                  </div>
                ) : (
                  /* Form */
                  <form onSubmit={submitReturn} className="space-y-6">
                    {/* Item selection */}
                    <div>
                      <h3 className="text-sm font-bold text-ink mb-1">Select Item(s) to Return</h3>
                      <p className="text-xs text-muted mb-3">Choose the item(s) you wish to exchange or return.</p>
                      <div className="divide-y divide-line rounded-2xl border border-line bg-white">
                        {order.items.map((item) => {
                          const isChecked = (selectedItems[item.id] ?? 0) > 0;
                          return (
                            <div key={item.id} className="flex items-center gap-3 p-3 text-xs">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  setSelectedItems((prev) => ({
                                    ...prev,
                                    [item.id]: e.target.checked ? item.qty : 0,
                                  }));
                                }}
                                className="h-4 w-4 cursor-pointer rounded"
                              />
                              <div className="grid h-10 w-9 shrink-0 place-items-center rounded-lg bg-[#f1f2f6]">
                                <ProductThumb material={item.material} color={item.colorHex} className="h-7 w-auto" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <b className="block truncate text-ink">{item.productName}</b>
                                <span className="text-muted">
                                  {[item.modelName, item.colorName].filter(Boolean).join(", ")} · {money(item.unitPrice)}
                                </span>
                              </div>
                              <span className="font-semibold text-ink">{money(item.lineTotal)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Resolution Choice */}
                    <div>
                      <label className="block text-sm font-bold text-ink mb-1">What would you prefer?</label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setResolution("exchange")}
                          className={`rounded-2xl border p-3.5 text-left transition ${
                            resolution === "exchange"
                              ? "border-ink bg-white shadow-sm ring-2 ring-black"
                              : "border-line bg-black/[0.02] hover:bg-white"
                          }`}
                        >
                          <b className="block text-sm text-ink">🔄 Exchange Item</b>
                          <span className="text-xs text-muted">Exchange for another phone model, color, or item</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setResolution("refund")}
                          className={`rounded-2xl border p-3.5 text-left transition ${
                            resolution === "refund"
                              ? "border-ink bg-white shadow-sm ring-2 ring-black"
                              : "border-line bg-black/[0.02] hover:bg-white"
                          }`}
                        >
                          <b className="block text-sm text-ink">💵 Money Refund</b>
                          <span className="text-xs text-muted">Disbursed to JazzCash, EasyPaisa, or Bank</span>
                        </button>
                      </div>
                    </div>

                    {/* Exchange Requirement */}
                    {resolution === "exchange" && (
                      <div>
                        <label className="block text-xs font-semibold text-ink mb-1.5">
                          Which phone model or color do you want in exchange? *
                        </label>
                        <input
                          type="text"
                          className="input"
                          placeholder="e.g. Please send iPhone 16 Pro Max instead in Midnight Blue"
                          value={exchangeNote}
                          onChange={(e) => setExchangeNote(e.target.value)}
                          required
                        />
                      </div>
                    )}

                    {/* Refund Requirement */}
                    {resolution === "refund" && (
                      <div className="rounded-2xl border border-line bg-black/[0.02] p-4 space-y-3">
                        <b className="block text-xs font-bold text-ink">Refund Account Details (JazzCash / EasyPaisa / Bank)</b>
                        <div className="flex gap-2">
                          {(["easypaisa", "jazzcash", "bank"] as const).map((m) => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => setRefundMethodType(m)}
                              className={`chip h-8 text-xs font-semibold uppercase ${
                                refundMethodType === m ? "bg-ink text-white" : "bg-white text-ink"
                              }`}
                            >
                              {m}
                            </button>
                          ))}
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <input
                            type="text"
                            className="input bg-white text-xs"
                            placeholder="Account Title / Full Name *"
                            value={accountTitle}
                            onChange={(e) => setAccountTitle(e.target.value)}
                            required
                          />
                          <input
                            type="text"
                            className="input bg-white text-xs"
                            placeholder={refundMethodType === "bank" ? "IBAN / Bank Account Number *" : "03XX Mobile Wallet Number *"}
                            value={accountNumber}
                            onChange={(e) => setAccountNumber(e.target.value)}
                            required
                          />
                        </div>
                      </div>
                    )}

                    {/* Return Reason */}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-semibold text-ink mb-1.5">Reason for Return *</label>
                        <select
                          className="input"
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                        >
                          {REASONS.map((r) => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-ink mb-1.5">Additional Details (Optional)</label>
                        <input
                          type="text"
                          className="input"
                          placeholder="Any specific comments for the team"
                          value={details}
                          onChange={(e) => setDetails(e.target.value)}
                        />
                      </div>
                    </div>

                    {error && (
                      <div className="rounded-2xl bg-rose-50 border border-rose-200 p-3.5 text-xs text-danger">
                        {error}
                      </div>
                    )}

                    <div className="border-t border-line pt-4 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setOrder(null)}
                        className="btn btn-glass h-11 text-xs"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="btn btn-primary h-11 px-6 text-sm"
                      >
                        {submitting ? "Submitting Request…" : "Submit Return Request"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* Success state */}
            {submittedReturnNumber && (
              <div className="rounded-3xl border border-emerald-200 bg-emerald-50/70 p-6 sm:p-8 text-center space-y-4">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                  <CheckCircle2 size={32} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-ink">Return Request Submitted Successfully!</h3>
                  <p className="mt-1 text-sm text-muted">
                    Your Return Reference Number is: <b className="font-mono text-ink text-base">{submittedReturnNumber}</b>
                  </p>
                </div>
                <div className="mx-auto max-w-md rounded-2xl bg-white p-4 text-xs text-left space-y-2 border border-line">
                  <p className="font-semibold text-ink">What happens next?</p>
                  <ol className="list-decimal pl-4 space-y-1 text-muted">
                    <li>Our fulfillment team will review and approve your return within 12–24 hours.</li>
                    <li>Keep the product in its original packaging. A rider will pick it up or we will provide a prepaid drop-off label.</li>
                    <li>Upon receiving and inspection, your exchange item will be dispatched or refund disbursed.</li>
                  </ol>
                </div>
                <div className="flex flex-wrap justify-center gap-3 pt-2">
                  <a
                    href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(`Assalam o Alaikum, I just submitted return request ${submittedReturnNumber} for order ${orderNumber}.`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn bg-[#25d366] text-white text-xs h-10 px-5"
                  >
                    Confirm on WhatsApp
                  </a>
                  <button
                    onClick={() => {
                      setSubmittedReturnNumber(null);
                      setOrder(null);
                      setOrderNumber("");
                    }}
                    className="btn btn-glass text-xs h-10 px-4"
                  >
                    Return to Portal
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Track Existing Return */}
        {tab === "track" && (
          <div className="mt-8 space-y-6">
            <div>
              <h2 className="text-base font-bold text-ink">Track Your Return Request</h2>
              <p className="mt-0.5 text-xs text-muted">Enter the Return Reference Number (e.g. RT10001) provided when you submitted your request.</p>

              <form onSubmit={lookupReturnStatus} className="mt-4 flex flex-wrap gap-2">
                <input
                  type="text"
                  className="input uppercase max-w-sm"
                  placeholder="e.g. RT10001"
                  value={trackingReturnNumber}
                  onChange={(e) => setTrackingReturnNumber(e.target.value)}
                  required
                />
                <button type="submit" disabled={trackingLoading} className="btn btn-primary h-11 px-5 text-sm">
                  {trackingLoading ? "Checking…" : "Track Status"}
                </button>
              </form>
            </div>

            {trackingError && (
              <div className="rounded-2xl bg-rose-50 border border-rose-200 p-3.5 text-xs text-danger">
                {trackingError}
              </div>
            )}

            {trackingResult && (
              <div className="rounded-2xl border border-line bg-white p-5 text-xs space-y-4">
                <div className="flex items-center justify-between border-b border-line pb-3">
                  <div>
                    <b className="text-sm text-ink">{trackingResult.number}</b>
                    <p className="text-muted">Order: {trackingResult.orderNumber}</p>
                  </div>
                  <span className="rounded-full bg-black/5 px-3 py-1 font-bold capitalize text-ink">
                    {trackingResult.statusLabel || trackingResult.status}
                  </span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 text-muted">
                  <p>Type: <b className="capitalize text-ink">{trackingResult.resolution}</b></p>
                  <p>Reason: <b className="text-ink">{trackingResult.reason}</b></p>
                  {trackingResult.exchangeNote && <p className="sm:col-span-2">Exchange Request: <b className="text-ink">{trackingResult.exchangeNote}</b></p>}
                  {trackingResult.refundMethod && <p className="sm:col-span-2">Refund Method: <b className="text-ink">{trackingResult.refundMethod}</b></p>}
                </div>
                {/* Timeline */}
                {trackingResult.timeline && trackingResult.timeline.length > 0 && (
                  <div className="border-t border-line pt-3">
                    <p className="font-semibold text-ink mb-2">Progress Timeline:</p>
                    <div className="space-y-2">
                      {trackingResult.timeline.map((event, idx: number) => (
                        <div key={idx} className="flex items-start gap-2">
                          <CheckCircle2 size={14} className="text-emerald-600 mt-0.5 shrink-0" />
                          <div>
                            <span className="font-semibold text-ink capitalize">{event.label || event.status}</span>
                            {event.note && <span className="text-muted"> — {event.note}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Support Footer */}
        <div className="mt-10 border-t border-line pt-6 flex items-center justify-between text-xs text-muted">
          <span>Need direct help? Contact customer support.</span>
          <a
            href={`https://wa.me/${WHATSAPP}?text=Assalam%20o%20Alaikum%2C%20I%20have%20a%20question%20about%20returns`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-emerald-700 hover:underline"
          >
            Chat on WhatsApp →
          </a>
        </div>
      </div>
    </div>
  );
}
