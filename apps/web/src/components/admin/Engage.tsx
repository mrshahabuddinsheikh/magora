"use client";

import { useCallback, useEffect, useState } from "react";
import { Ban, Bell, Check, MessageCircle, Phone, PhoneOff, RefreshCw, ShieldAlert, ShieldCheck, Trash2, X } from "lucide-react";
import { api } from "@/lib/client-api";
import { STORE_NAME } from "@/lib/config";
import { cn, dateTime, money } from "@/lib/format";
import { Empty } from "./ui";

/* ───────────── shared ───────────── */

type Risk = { level: "blocked" | "high" | "medium" | "new" | "trusted"; orders: number; delivered: number; refused: number; blocked: boolean; blockReason: string | null };

const RISK: Record<Risk["level"], [string, string]> = {
  blocked: ["Blocked", "bg-danger text-white"],
  high: ["High risk", "bg-[#fde8e8] text-danger"],
  medium: ["Caution", "bg-[#fff4e0] text-[#a15c00]"],
  new: ["New customer", "bg-black/[0.05] text-ink/70"],
  trusted: ["Trusted", "bg-[#e9f8ef] text-success"],
};

export function RiskBadge({ risk }: { risk?: Risk | null }) {
  if (!risk) return null;
  const [label, cls] = RISK[risk.level];
  const Icon = risk.level === "trusted" ? ShieldCheck : risk.level === "new" ? null : ShieldAlert;
  return (
    <span
      className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-semibold", cls)}
      title={`${risk.orders} orders · ${risk.delivered} delivered · ${risk.refused} cancelled/returned${risk.blockReason ? ` · ${risk.blockReason}` : ""}`}
    >
      {Icon && <Icon size={12} />} {label}
      {risk.orders > 1 && <span className="font-normal opacity-80">· {risk.delivered}/{risk.orders} delivered</span>}
    </span>
  );
}

const waDigits = (phone: string) => phone.replace(/\D/g, "");

/* ───────────── COD confirmation ───────────── */

type QueueItem = {
  number: string; createdAt: string; name: string; phone: string; city: string; address: string; total: number;
  items: { name: string; model: string; color: string; qty: number }[];
  attempts: number; lastNote: string | null; risk: Risk;
};

function confirmMessage(o: QueueItem) {
  const items = o.items.map((i) => `• ${i.name}${i.model ? ` (${i.model})` : ""} — ${i.color}${i.qty > 1 ? ` ×${i.qty}` : ""}`).join("\n");
  return (
    `Assalam o Alaikum ${o.name.split(" ")[0]}! 👋\n` +
    `${STORE_NAME} se aap ka order *#${o.number}*:\n${items}\n\n` +
    `Total: *${money(o.total)}* (Cash on Delivery)\n` +
    `Address: ${o.address}, ${o.city}\n\n` +
    `Kya hum ye order confirm kar ke dispatch kar dein? Please reply *YES* ✅`
  );
}

export function CodConfirm({ openOrder }: { openOrder: (n: string) => void }) {
  const [rows, setRows] = useState<QueueItem[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [blockAlso, setBlockAlso] = useState(true);
  const [askFake, setAskFake] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(() => api<{ data: QueueItem[] }>("/admin/cod-queue").then((r) => setRows(r.data)), []);
  useEffect(() => {
    load();
  }, [load]);

  const flash = (t: string) => {
    setToast(t);
    setTimeout(() => setToast(null), 2200);
  };

  const act = async (o: QueueItem, kind: "confirm" | "no_answer" | "fake") => {
    setBusy(o.number);
    try {
      if (kind === "confirm") await api(`/admin/orders/${o.number}`, { method: "PATCH", json: { status: "confirmed", note: "Call: confirmed by customer" } });
      if (kind === "no_answer") await api(`/admin/orders/${o.number}`, { method: "PATCH", json: { note: `Call: no answer (try ${o.attempts + 1})` } });
      if (kind === "fake") {
        await api(`/admin/orders/${o.number}`, { method: "PATCH", json: { status: "cancelled", note: "Call: fake / refused at confirmation" } });
        if (blockAlso) await api("/admin/blacklist", { method: "POST", json: { phone: o.phone, reason: `Fake order #${o.number}` } });
      }
      flash(kind === "confirm" ? `✓ #${o.number} confirmed` : kind === "fake" ? `#${o.number} cancelled${blockAlso ? " & number blocked" : ""}` : `No answer noted for #${o.number}`);
      setAskFake(null);
      await load();
    } catch (e) {
      flash((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
      <div className="space-y-3">
        <div className="card flex flex-wrap items-center gap-3 p-4 text-[13.5px]">
          <p className="min-w-0 flex-1 text-muted">
            Har naye Cash-on-Delivery order ko dispatch se pehle confirm karein: <b className="text-ink">WhatsApp</b> bhejein ya <b className="text-ink">call</b> karein, phir
            Confirmed / No answer / Fake dabayein. Fake order ka number block ho jata hai, phir woh COD order nahi kar sakta.
          </p>
          <button onClick={load} className="btn btn-ghost h-9 px-3 text-sm"><RefreshCw size={14} /> Refresh</button>
        </div>

        {!rows ? (
          <div className="skeleton h-60 rounded-[24px]" />
        ) : !rows.length ? (
          <div className="card"><Empty>🎉 Sab orders confirm ho chuke hain. Koi naya COD order nahi.</Empty></div>
        ) : (
          rows.map((o) => (
            <article key={o.number} className={cn("card p-4 transition", busy === o.number && "opacity-60", o.risk.level === "blocked" || o.risk.level === "high" ? "ring-2 ring-danger/30" : "")}>
              <div className="flex flex-wrap items-start gap-x-3 gap-y-1.5">
                <button onClick={() => openOrder(o.number)} className="font-mono text-[15px] font-bold hover:text-accent">#{o.number}</button>
                <RiskBadge risk={o.risk} />
                {o.attempts > 0 && <span className="rounded-full bg-[#fff4e0] px-2.5 py-1 text-[11.5px] font-semibold text-[#a15c00]">{o.attempts}× no answer</span>}
                <span className="ml-auto text-[12px] text-muted">{dateTime(o.createdAt)}</span>
              </div>
              <div className="mt-2 grid gap-3 sm:grid-cols-[1fr_auto]">
                <div className="min-w-0 text-[13.5px]">
                  <p><b>{o.name}</b> · <a href={`tel:${o.phone}`} className="font-mono hover:text-accent">{o.phone}</a></p>
                  <p className="text-muted">{o.address}, <b className="font-medium text-ink">{o.city}</b></p>
                  <ul className="mt-1.5 space-y-0.5 text-[12.5px]">
                    {o.items.map((i, k) => (
                      <li key={k}>{i.qty}× {i.name}{i.model ? ` · ${i.model}` : ""} · {i.color}</li>
                    ))}
                  </ul>
                  {o.risk.blockReason && <p className="mt-1 text-[12px] text-danger">Blocked: {o.risk.blockReason}</p>}
                </div>
                <p className="text-right text-[20px] font-bold tabular-nums">{money(o.total)}</p>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={`https://wa.me/${waDigits(o.phone)}?text=${encodeURIComponent(confirmMessage(o))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn h-10 bg-[#25d366] px-4 text-sm text-white hover:brightness-95"
                >
                  <MessageCircle size={16} /> WhatsApp
                </a>
                <a href={`tel:${o.phone}`} className="btn btn-ghost h-10 px-4 text-sm"><Phone size={15} /> Call</a>
                <span className="mx-1 hidden w-px bg-line sm:block" />
                <button disabled={!!busy} onClick={() => act(o, "confirm")} className="btn btn-dark h-10 px-4 text-sm"><Check size={16} /> Confirmed</button>
                <button disabled={!!busy} onClick={() => act(o, "no_answer")} className="btn btn-ghost h-10 px-4 text-sm"><PhoneOff size={15} /> No answer</button>
                <button disabled={!!busy} onClick={() => setAskFake(askFake === o.number ? null : o.number)} className="btn h-10 bg-[#fde8e8] px-4 text-sm text-danger"><X size={16} /> Fake</button>
              </div>
              {askFake === o.number && (
                <div className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl bg-[#fde8e8]/60 p-3 text-[13px]">
                  <span className="flex-1">Order cancel ho jayega aur stock wapas aa jayega.</span>
                  <label className="flex items-center gap-2 font-medium">
                    <input type="checkbox" checked={blockAlso} onChange={(e) => setBlockAlso(e.target.checked)} className="accent-[#e11d48]" /> Is number ko block karo
                  </label>
                  <button onClick={() => act(o, "fake")} className="btn h-9 bg-danger px-4 text-sm text-white">Cancel order</button>
                </div>
              )}
            </article>
          ))
        )}
      </div>
      <Blacklist />
      {toast && <div className="fixed bottom-5 left-1/2 z-[70] -translate-x-1/2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white shadow-lg">{toast}</div>}
    </div>
  );
}

/* ───────────── blacklist ───────────── */

type Blocked = { phone: string; reason: string | null; createdAt: string; orders: number; refused: number };

function Blacklist() {
  const [rows, setRows] = useState<Blocked[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const load = () => api<{ data: Blocked[] }>("/admin/blacklist").then((r) => setRows(r.data));
  useEffect(() => {
    load();
  }, []);
  return (
    <aside className="card h-fit p-4">
      <h2 className="flex items-center gap-2 text-[15px] font-bold"><Ban size={16} className="text-danger" /> Blocked numbers</h2>
      <p className="mt-1 text-[12.5px] text-muted">Ye numbers Cash on Delivery se order nahi kar sakte (unhein WhatsApp par rabta karne ko kaha jata hai).</p>
      <form
        className="mt-3 grid gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
          try {
            setErr(null);
            await api("/admin/blacklist", { method: "POST", json: { phone: f.phone, reason: f.reason || undefined } });
            (e.target as HTMLFormElement).reset();
            load();
          } catch (x) {
            setErr((x as Error).message);
          }
        }}
      >
        <input name="phone" required placeholder="03xx xxxxxxx" className="input h-10" />
        <input name="reason" placeholder="Reason (e.g. refused 2 parcels)" className="input h-10" />
        {err && <p className="text-sm text-danger">{err}</p>}
        <button className="btn btn-dark h-10 text-sm">Block number</button>
      </form>
      <ul className="mt-3 divide-y divide-line text-[13px]">
        {rows.map((b) => (
          <li key={b.phone} className="flex items-center gap-2 py-2">
            <span className="min-w-0 flex-1">
              <b className="font-mono">{b.phone}</b>
              <span className="block truncate text-[12px] text-muted">{b.reason ?? "—"} · {b.orders} orders</span>
            </span>
            <button
              title="Unblock"
              aria-label={`Unblock ${b.phone}`}
              onClick={async () => {
                await api(`/admin/blacklist/${encodeURIComponent(b.phone)}`, { method: "DELETE" });
                load();
              }}
              className="grid h-8 w-8 place-items-center rounded-full hover:bg-black/5"
            >
              <Trash2 size={14} />
            </button>
          </li>
        ))}
        {!rows.length && <li className="py-3 text-center text-[12.5px] text-muted">Koi number block nahi</li>}
      </ul>
    </aside>
  );
}

/* ───────────── back-in-stock requests ───────────── */

type Alert = {
  id: number; phone: string; name: string | null; createdAt: string; notifiedAt: string | null;
  productId: number; productSlug: string; productName: string;
  colorName: string | null; colorHex: string | null; modelSlug: string | null; modelName: string | null;
  stock: number; inStock: boolean;
};

export function StockAlerts() {
  const [status, setStatus] = useState<"waiting" | "notified">("waiting");
  const [rows, setRows] = useState<Alert[] | null>(null);
  const load = useCallback(() => api<{ data: Alert[] }>(`/admin/stock-alerts?status=${status}`).then((r) => setRows(r.data)), [status]);
  useEffect(() => {
    queueMicrotask(() => setRows(null));
    load();
  }, [load]);

  const link = (a: Alert) => {
    const u = new URL(`/product/${a.productSlug}`, window.location.origin);
    if (a.modelSlug) u.searchParams.set("model", a.modelSlug);
    return u.toString();
  };
  const msg = (a: Alert) =>
    `Assalam o Alaikum${a.name ? ` ${a.name}` : ""}! 🎉 ${a.productName}${a.modelName ? ` (${a.modelName})` : ""}${a.colorName ? ` — ${a.colorName}` : ""} ab ${STORE_NAME} par wapas stock mein hai. Jaldi order karein, stock limited hai:\n${link(a)}`;

  // group by product+option so you see demand at a glance
  const groups = new Map<string, Alert[]>();
  for (const a of rows ?? []) {
    const k = `${a.productName}|${a.modelName ?? ""}|${a.colorName ?? ""}`;
    groups.set(k, [...(groups.get(k) ?? []), a]);
  }

  return (
    <div className="space-y-3">
      <div className="card flex flex-wrap items-center gap-2 p-3">
        {(["waiting", "notified"] as const).map((s) => (
          <button key={s} onClick={() => setStatus(s)} className={cn("rounded-full px-4 py-2 text-sm font-medium", status === s ? "bg-ink text-white" : "bg-black/[0.04]")}>
            {s === "waiting" ? "Waiting" : "Already told"}
          </button>
        ))}
        <p className="ml-auto text-[12.5px] text-muted">Customers jo &quot;Notify me&quot; dabate hain. Stock aane par <b>WhatsApp</b> dabayein, phir <b>Done</b>.</p>
      </div>
      {!rows ? (
        <div className="skeleton h-48 rounded-[24px]" />
      ) : !rows.length ? (
        <div className="card"><Empty>{status === "waiting" ? "Abhi koi request nahi." : "Abhi tak kisi ko message nahi kiya."}</Empty></div>
      ) : (
        [...groups.entries()].map(([k, list]) => {
          const a0 = list[0];
          return (
            <section key={k} className="card p-4">
              <div className="flex flex-wrap items-center gap-2">
                {a0.colorHex && <span className="h-4 w-4 rounded-full ring-1 ring-black/10" style={{ background: a0.colorHex }} />}
                <b className="text-[15px]">{a0.productName}</b>
                <span className="text-[13px] text-muted">{[a0.modelName, a0.colorName].filter(Boolean).join(" · ")}</span>
                <span className="rounded-full bg-[#eef1ff] px-2.5 py-0.5 text-[12px] font-semibold text-accent"><Bell size={11} className="mr-1 inline" />{list.length} waiting</span>
                <span className={cn("ml-auto rounded-full px-2.5 py-1 text-[12px] font-semibold", a0.inStock ? "bg-[#e9f8ef] text-success" : "bg-[#fde8e8] text-danger")}>
                  {a0.inStock ? `In stock now (${a0.stock})` : "Still out of stock"}
                </span>
              </div>
              <ul className="mt-2 divide-y divide-line text-[13px]">
                {list.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-2 py-2">
                    <span className="min-w-0 flex-1"><b>{a.name ?? "Customer"}</b> · <span className="font-mono">{a.phone}</span> <span className="text-[12px] text-muted">· {dateTime(a.createdAt)}</span></span>
                    {status === "waiting" && (
                      <>
                        <a
                          href={`https://wa.me/${waDigits(a.phone)}?text=${encodeURIComponent(msg(a))}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn("btn h-8 px-3 text-[12.5px]", a.inStock ? "bg-[#25d366] text-white" : "btn-ghost")}
                        >
                          <MessageCircle size={14} /> WhatsApp
                        </a>
                        <button onClick={async () => { await api(`/admin/stock-alerts/${a.id}/notified`, { method: "POST" }); load(); }} className="btn btn-dark h-8 px-3 text-[12.5px]">
                          <Check size={14} /> Done
                        </button>
                      </>
                    )}
                    <button title="Delete" aria-label="Delete request" onClick={async () => { await api(`/admin/stock-alerts/${a.id}`, { method: "DELETE" }); load(); }} className="grid h-8 w-8 place-items-center rounded-full hover:bg-black/5">
                      <Trash2 size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}
