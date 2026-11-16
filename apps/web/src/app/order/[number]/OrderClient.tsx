"use client";

import Link from "next/link";
import { track } from "@/lib/track";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, MessageCircle } from "lucide-react";
import { api } from "@/lib/client-api";
import { money } from "@/lib/format";
import { WHATSAPP } from "@/lib/config";
import { OrderView } from "@/components/OrderView";
import type { Order } from "@/lib/types";

export function OrderClient() {
  const { number } = useParams<{ number: string }>();
  const sp = useSearchParams();
  const token = sp.get("token");
  const isNew = sp.get("new") === "1";
  const [order, setOrder] = useState<Order | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(
    () =>
      api<{ data: Order }>(`/orders/${number}${token ? `?token=${token}` : ""}`)
        .then((r) => setOrder(r.data))
        .catch((e) => setErr(e.message)),
    [number, token],
  );
  useEffect(() => {
    load();
  }, [load]);

  // ads: count the sale once
  useEffect(() => {
    if (!isNew || !order) return;
    const k = `mg-purchase-${order.number}`;
    try {
      if (sessionStorage.getItem(k)) return;
      sessionStorage.setItem(k, "1");
    } catch {}
    track("purchase", {
      value: order.totals.total,
      orderId: order.number,
      items: order.items.map((i) => ({ id: i.productSlug, name: i.productName, price: i.unitPrice, qty: i.qty })),
    });
  }, [isNew, order]);

  if (err)
    return (
      <div className="card mx-auto max-w-lg p-8 text-center">
        <p className="font-semibold">We couldn’t open this order.</p>
        <p className="mt-1 text-sm text-muted">Use “Track order” with your order number and mobile number.</p>
        <Link href="/track" className="btn btn-primary mt-5">Track order</Link>
      </div>
    );
  if (!order) return <div className="skeleton mx-auto h-96 max-w-3xl rounded-[28px]" />;

  const wa = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(`Hi! I just placed order ${order.number} (${money(order.totals.total)}, Cash on Delivery). Please confirm.`)}`;

  return (
    <div className="mx-auto max-w-3xl">
      {isNew && (
        <div className="card animate-rise mb-5 overflow-hidden p-6 text-center sm:p-8">
          <CheckCircle2 size={56} className="mx-auto text-success" />
          <h1 className="mt-3 text-[28px] font-bold tracking-tight">Thank you, {order.customer.name.split(" ")[0]}!</h1>
          <p className="mt-1 text-muted">
            Your order <b className="text-ink">{order.number}</b> is placed. Keep <b className="text-ink">{money(order.totals.total)}</b> ready in cash for the rider.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <a href={wa} target="_blank" rel="noopener noreferrer" className="btn h-12 bg-[#25d366] text-white">
              <MessageCircle size={18} /> Confirm on WhatsApp
            </a>
            <Link href="/shop" className="btn btn-glass h-12">Continue shopping</Link>
          </div>
          <p className="mt-4 text-xs text-muted">Save your order number to track it any time.</p>
        </div>
      )}
      <OrderView order={order} token={token} refresh={load} />
      {order.canCancel && token && (
        <div className="mt-4 text-center">
          <button
            className="text-sm text-muted underline hover:text-danger"
            disabled={cancelling}
            onClick={async () => {
              if (!confirm("Cancel this order?")) return;
              setCancelling(true);
              try {
                const r = await api<{ data: Order }>(`/orders/${order.number}/cancel`, { method: "POST", json: { token } });
                setOrder(r.data);
              } finally {
                setCancelling(false);
              }
            }}
          >
            Cancel order
          </button>
        </div>
      )}
    </div>
  );
}
