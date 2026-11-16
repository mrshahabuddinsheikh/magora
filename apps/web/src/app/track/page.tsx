"use client";

import { useState } from "react";
import { PackageSearch } from "lucide-react";
import { api } from "@/lib/client-api";
import { OrderView } from "@/components/OrderView";
import type { Order } from "@/lib/types";

export default function TrackPage() {
  const [order, setOrder] = useState<Order | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [creds, setCreds] = useState<{ number: string; phone: string } | null>(null);
  const refresh = async () => {
    if (!creds) return;
    const r = await api<{ data: Order }>("/orders/track", { method: "POST", json: creds, auth: false });
    setOrder(r.data);
  };
  return (
    <div className="mx-auto max-w-3xl">
      <div className="card p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#eef1ff] text-accent"><PackageSearch size={22} /></span>
          <div>
            <h1 className="text-2xl font-bold">Track your order</h1>
            <p className="text-sm text-muted">Enter the order number from your confirmation and the mobile number you ordered with.</p>
          </div>
        </div>
        <form
          className="mt-6 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setBusy(true);
            setErr(null);
            try {
              const c = { number: String(f.get("number")), phone: String(f.get("phone")) };
              const r = await api<{ data: Order }>("/orders/track", { method: "POST", json: c, auth: false });
              setCreds(c);
              setOrder(r.data);
            } catch {
              setOrder(null);
              setErr("We couldn’t find an order with these details. Please check and try again.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <input name="number" required placeholder="Order no. e.g. MG100001" className="input uppercase" aria-label="Order number" />
          <input name="phone" required placeholder="Mobile e.g. 0300 1234567" inputMode="tel" className="input" aria-label="Mobile number" />
          <button className="btn btn-primary h-12" disabled={busy}>{busy ? "Checking…" : "Track"}</button>
        </form>
        {err && <p className="mt-3 text-sm text-danger">{err}</p>}
      </div>
      {order && <div className="mt-5"><OrderView order={order} refresh={refresh} phone={creds?.phone} /></div>}
    </div>
  );
}
