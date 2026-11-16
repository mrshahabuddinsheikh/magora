"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Banknote, CheckCircle2, MapPin, MessageCircle, Navigation, Phone, Radio, XCircle } from "lucide-react";
import { api } from "@/lib/client-api";
import { cn, money } from "@/lib/format";
import { STORE_NAME } from "@/lib/config";

interface Job {
  orderNumber: string; status: string; statusLabel: string; riderName: string | null;
  customer: { name: string; phone: string };
  address: { line1: string; area: string | null; city: string; notes: string | null };
  collect: number;
  items: { name: string; model: string; color: string; qty: number }[];
  lastLocationAt: string | null;
}

/**
 * Page the rider opens on their phone (secret link from the admin panel).
 * While "sharing" is on, GPS is sent every ~15 s and the customer sees the rider on a map.
 */
export function RiderClient() {
  const { token } = useParams<{ token: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [gpsErr, setGpsErr] = useState<string | null>(null);
  const [sent, setSent] = useState<Date | null>(null);
  const watch = useRef<number | null>(null);
  const last = useRef(0);
  const wake = useRef<{ release: () => Promise<void> } | null>(null);

  const load = useCallback(() => api<{ data: Job }>(`/rider/${token}`, { auth: false }).then((r) => setJob(r.data)).catch((e) => setErr(e.message)), [token]);
  useEffect(() => {
    load();
  }, [load]);

  const stop = useCallback(() => {
    if (watch.current != null) navigator.geolocation.clearWatch(watch.current);
    watch.current = null;
    wake.current?.release().catch(() => {});
    setSharing(false);
  }, []);
  useEffect(() => stop, [stop]);

  const start = async () => {
    if (!("geolocation" in navigator)) return setGpsErr("This phone doesn't support GPS in the browser");
    setGpsErr(null);
    try {
      wake.current = await (navigator as Navigator & { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request("screen") ?? null;
    } catch {}
    watch.current = navigator.geolocation.watchPosition(
      async (pos) => {
        setSharing(true);
        if (Date.now() - last.current < 12_000) return;
        last.current = Date.now();
        try {
          await api(`/rider/${token}/location`, { method: "POST", json: { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }, auth: false });
          setSent(new Date());
        } catch {}
      },
      (e) => {
        setGpsErr(e.code === 1 ? "Location permission denied — allow location for this site in your browser settings" : "Can't get GPS signal");
        setSharing(false);
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
    );
  };

  const setStatus = async (status: "out_for_delivery" | "delivered" | "failed_attempt", note?: string) => {
    const pos = await new Promise<GeolocationPosition | null>((res) => navigator.geolocation?.getCurrentPosition(res, () => res(null), { timeout: 5000 }) ?? res(null));
    await api(`/rider/${token}/status`, { method: "POST", json: { status, note, lat: pos?.coords.latitude, lng: pos?.coords.longitude }, auth: false });
    if (status === "out_for_delivery") start();
    if (status !== "out_for_delivery") stop();
    load();
  };

  if (err) return <div className="card mx-auto mt-6 max-w-md p-8 text-center text-muted">This delivery link is not valid anymore.</div>;
  if (!job) return <div className="skeleton mx-auto mt-6 h-96 max-w-md rounded-[28px]" />;

  const done = job.status === "delivered";
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${job.address.line1}, ${job.address.area ?? ""} ${job.address.city}, Pakistan`)}`;
  const wa = `https://wa.me/${job.customer.phone.replace("+", "")}?text=${encodeURIComponent(`Assalam o Alaikum ${job.customer.name}, main ${STORE_NAME} ka rider hoon. Aapka order ${job.orderNumber} le kar aa raha hoon.`)}`;

  return (
    <div className="mx-auto max-w-md space-y-3 pb-10">
      <div className="card p-5">
        <p className="text-sm text-muted">{STORE_NAME} delivery · {job.riderName ?? "Rider"}</p>
        <div className="mt-1 flex items-center justify-between">
          <h1 className="text-2xl font-bold">{job.orderNumber}</h1>
          <span className={cn("rounded-full px-3 py-1 text-sm font-semibold", done ? "bg-[#e9f8ef] text-success" : "bg-[#eef1ff] text-accent")}>{job.statusLabel}</span>
        </div>
        {job.collect > 0 && !done && (
          <div className="mt-4 flex items-center gap-3 rounded-2xl bg-[#fff4e0] p-4">
            <Banknote className="text-[#a15c00]" />
            <div>
              <p className="text-xs font-semibold uppercase text-[#a15c00]">Collect cash</p>
              <p className="text-2xl font-bold">{money(job.collect)}</p>
            </div>
          </div>
        )}
      </div>

      <div className="card p-5">
        <p className="text-lg font-bold">{job.customer.name}</p>
        <p className="mt-1 flex items-start gap-1.5 text-[15px] text-muted"><MapPin size={17} className="mt-0.5 shrink-0" /> {job.address.line1}{job.address.area ? `, ${job.address.area}` : ""}, {job.address.city}</p>
        {job.address.notes && <p className="mt-2 rounded-xl bg-black/[0.04] p-2.5 text-sm">📝 {job.address.notes}</p>}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <a href={`tel:${job.customer.phone}`} className="btn btn-glass h-12 px-2 text-sm"><Phone size={16} /> Call</a>
          <a href={wa} target="_blank" rel="noopener noreferrer" className="btn h-12 bg-[#25d366] px-2 text-sm text-white"><MessageCircle size={16} /> WhatsApp</a>
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="btn btn-glass h-12 px-2 text-sm"><Navigation size={16} /> Map</a>
        </div>
        <ul className="mt-4 space-y-1 border-t border-line pt-3 text-sm">
          {job.items.map((i, k) => <li key={k}>{i.qty}× {i.name} — {[i.model, i.color].filter(Boolean).join(", ")}</li>)}
        </ul>
      </div>

      {!done && (
        <div className="card space-y-2.5 p-5">
          {job.status !== "out_for_delivery" ? (
            <button className="btn btn-primary h-14 w-full text-base" onClick={() => setStatus("out_for_delivery")}>
              <Radio size={18} /> Start delivery & share live location
            </button>
          ) : (
            <div className={cn("flex items-center justify-between rounded-2xl p-3 text-sm", sharing ? "bg-[#e9f8ef] text-[#0b6b3a]" : "bg-black/[0.04]")}>
              <span className="flex items-center gap-2 font-semibold">
                <span className={cn("h-2.5 w-2.5 rounded-full", sharing ? "animate-pulse bg-success" : "bg-muted")} />
                {sharing ? "Sharing live location" : "Location sharing paused"}
              </span>
              {sharing ? (
                <span className="text-xs">{sent ? `sent ${sent.toLocaleTimeString("en-PK", { hour: "numeric", minute: "2-digit", second: "2-digit" })}` : "starting…"}</span>
              ) : (
                <button className="font-semibold text-accent" onClick={start}>Resume</button>
              )}
            </div>
          )}
          {gpsErr && <p className="text-sm text-danger">{gpsErr}</p>}
          <button
            className="btn h-14 w-full bg-success text-base text-white"
            onClick={() => confirm(`Mark ${job.orderNumber} as delivered${job.collect ? ` and ${money(job.collect)} collected` : ""}?`) && setStatus("delivered")}
          >
            <CheckCircle2 size={18} /> Delivered{job.collect ? " · cash collected" : ""}
          </button>
          <button
            className="btn btn-glass h-12 w-full text-danger"
            onClick={() => {
              const r = prompt("Why couldn't you deliver? (e.g. customer not answering)");
              if (r) setStatus("failed_attempt", r);
            }}
          >
            <XCircle size={17} /> Couldn’t deliver
          </button>
          <p className="text-center text-xs text-muted">Keep this page open while delivering so the customer can see you on the map.</p>
        </div>
      )}
      {done && <div className="card p-6 text-center font-semibold text-success">✓ Delivered — thank you!</div>}
    </div>
  );
}
