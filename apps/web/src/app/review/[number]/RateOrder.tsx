"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { BadgeCheck, Camera, Check, Copy, Star, X } from "lucide-react";
import { api } from "@/lib/client-api";
import { PUBLIC_API_URL } from "@/lib/config";
import { cn } from "@/lib/format";
import { ProductThumb } from "@/components/CaseThumb";

type Item = { productId: number; slug: string; name: string; model: string; color: string; colorHex: string; material: string | null; reviewed: number | null };
type Invite = { number: string; name: string; thanksCoupon: string | null; items: Item[] };
type Draft = { rating: number; body: string; photos: string[]; uploading?: boolean };

const WORDS = ["", "Bilkul pasand nahi aaya", "Theek nahi tha", "Theek hai", "Achha hai", "Zabardast!"];

/** The page customers open from the WhatsApp "rate your order" link */
export function RateOrder() {
  const { number } = useParams<{ number: string }>();
  const t = useSearchParams().get("t") ?? "";
  const [inv, setInv] = useState<Invite | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ saved: number; coupon: string | null } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api<{ data: Invite }>(`/review-invite/${encodeURIComponent(number)}?t=${encodeURIComponent(t)}`, { auth: false })
      .then((r) => {
        setInv(r.data);
        setName(r.data.name);
      })
      .catch((e) => setErr((e as Error).message));
  }, [number, t]);

  const blank: Draft = { rating: 0, body: "", photos: [] };
  const set = (id: number, d: Partial<Draft>) => setDrafts((x) => ({ ...x, [id]: { ...blank, ...x[id], ...d } }));

  const upload = async (id: number, files: FileList | null) => {
    if (!files?.length) return;
    set(id, { uploading: true });
    const urls: string[] = [];
    for (const f of [...files].slice(0, 3)) {
      const fd = new FormData();
      fd.append("file", f);
      try {
        const r = await fetch(`${PUBLIC_API_URL}/uploads`, { method: "POST", body: fd }).then((x) => x.json());
        if (r?.data?.url) urls.push(r.data.url);
      } catch {}
    }
    setDrafts((x) => ({ ...x, [id]: { ...x[id], photos: [...(x[id]?.photos ?? []), ...urls].slice(0, 3), uploading: false } }));
  };

  const ready = Object.entries(drafts).filter(([, d]) => d.rating > 0 && d.body.trim().length >= 3);

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ data: { saved: number; thanksCoupon: string | null } }>(`/review-invite/${encodeURIComponent(number)}?t=${encodeURIComponent(t)}`, {
        method: "POST",
        auth: false,
        json: { name, reviews: ready.map(([id, d]) => ({ productId: Number(id), rating: d.rating, body: d.body, photos: d.photos })) },
      });
      setDone({ saved: r.data.saved, coupon: r.data.thanksCoupon });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (err && !inv)
    return (
      <section className="mx-auto max-w-md px-4 py-16 text-center">
        <div className="card p-8">
          <p className="text-3xl">🔗</p>
          <h1 className="mt-2 text-xl font-bold">This link isn’t working</h1>
          <p className="mt-2 text-sm text-muted">{err}</p>
          <Link href="/" className="btn btn-primary mt-5 h-11">Go to the store</Link>
        </div>
      </section>
    );
  if (!inv) return <div className="mx-auto mt-10 max-w-lg px-4"><div className="skeleton h-80 rounded-[28px]" /></div>;

  if (done)
    return (
      <section className="mx-auto max-w-md px-4 py-12 text-center">
        <div className="card p-8">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#fff3d6] text-[30px]">⭐</div>
          <h1 className="mt-3 text-[22px] font-bold">Shukriya, {name.split(" ")[0]}!</h1>
          <p className="mt-2 text-[14.5px] text-muted">Aap ka review mil gaya. Check ke baad product page par “Verified buyer” ke saath nazar aayega.</p>
          {done.coupon && (
            <div className="mt-5 rounded-2xl border-2 border-dashed border-[#f5b301] bg-[#fff8e6] p-4">
              <p className="text-[13px] font-semibold">Agle order par discount code</p>
              <button
                onClick={async () => {
                  try { await navigator.clipboard.writeText(done.coupon!); setCopied(true); } catch {}
                }}
                className="mt-1 inline-flex items-center gap-2 font-mono text-[22px] font-bold tracking-widest"
              >
                {done.coupon} {copied ? <Check size={18} className="text-success" /> : <Copy size={16} className="text-muted" />}
              </button>
            </div>
          )}
          <Link href="/" className="btn btn-primary mt-6 h-12 w-full">Continue shopping</Link>
        </div>
      </section>
    );

  return (
    <section className="mx-auto max-w-lg px-4 pb-28 pt-6">
      <h1 className="text-[26px] font-bold tracking-tight">Order kaisa laga?</h1>
      <p className="mt-1 text-[14.5px] text-muted">
        Order <b className="font-mono text-ink">#{inv.number}</b> · aap ki asli raye doosre customers ki madad karti hai, achhi ho ya buri.
      </p>

      <div className="mt-5 space-y-4">
        {inv.items.map((it) => {
          const d = drafts[it.productId] ?? { rating: 0, body: "", photos: [] };
          return (
            <article key={it.productId} className="card p-4">
              <div className="flex items-center gap-3">
                <span className="grid h-16 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-b from-[#f4f5f9] to-[#e9ebf1]">
                  <ProductThumb material={it.material ?? "clear"} color={it.colorHex} className="h-[86%] w-auto" />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold">{it.name}</p>
                  <p className="text-[12.5px] text-muted">{[it.model, it.color].filter(Boolean).join(" · ")}</p>
                </div>
              </div>

              {it.reviewed ? (
                <p className="mt-3 flex items-center gap-2 rounded-2xl bg-[#e9f8ef] px-3 py-2 text-[13px] font-medium text-success"><BadgeCheck size={16} /> Already reviewed — shukriya!</p>
              ) : (
                <>
                  <div className="mt-3 flex items-center gap-1" role="radiogroup" aria-label={`Rating for ${it.name}`}>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <button key={i} type="button" role="radio" aria-checked={d.rating === i} aria-label={`${i} star${i > 1 ? "s" : ""}`} onClick={() => set(it.productId, { rating: i })} className="p-0.5">
                        <Star size={34} className={cn("transition-transform duration-150 active:scale-90", i <= d.rating ? "scale-105 fill-[#f5b301] text-[#d98e04]" : "fill-black/[0.07] text-black/15")} />
                      </button>
                    ))}
                    <span className="ml-2 text-[13px] font-medium text-muted">{WORDS[d.rating]}</span>
                  </div>
                  {d.rating > 0 && (
                    <>
                      <textarea
                        dir="auto"
                        rows={3}
                        value={d.body}
                        onChange={(e) => set(it.productId, { body: e.target.value })}
                        placeholder={d.rating >= 4 ? "Kya achha laga? Fitting, quality, delivery…" : "Kya theek nahi tha? Hum behtar karenge."}
                        className="input mt-3 h-auto w-full py-3 text-[15px]"
                      />
                      <p className="mt-1 text-[11.5px] text-muted">English, Roman Urdu ya اردو — jo aasaan lage</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {d.photos.map((u) => (
                          <span key={u} className="relative h-16 w-16 overflow-hidden rounded-xl">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={u} alt="" className="h-full w-full object-cover" />
                            <button onClick={() => set(it.productId, { photos: d.photos.filter((x) => x !== u) })} className="absolute right-0.5 top-0.5 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-white" aria-label="Remove photo"><X size={12} /></button>
                          </span>
                        ))}
                        {d.photos.length < 3 && (
                          <label className="grid h-16 w-16 cursor-pointer place-items-center rounded-xl border-2 border-dashed border-black/15 text-muted hover:border-accent hover:text-accent">
                            {d.uploading ? <span className="text-[11px]">…</span> : <Camera size={20} />}
                            <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => upload(it.productId, e.target.files)} />
                          </label>
                        )}
                        <span className="text-[12px] text-muted">Photo lagayein (optional)</span>
                      </div>
                    </>
                  )}
                </>
              )}
            </article>
          );
        })}
      </div>

      <label className="mt-4 block">
        <span className="label">Review par naam</span>
        <input dir="auto" value={name} onChange={(e) => setName(e.target.value)} className="input w-full" maxLength={60} />
      </label>
      {err && <p className="mt-3 text-sm text-danger">{err}</p>}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/90 p-3 backdrop-blur">
        <div className="mx-auto max-w-lg">
          <button disabled={busy || !ready.length || name.trim().length < 2} onClick={submit} className="btn btn-primary h-12 w-full">
            {ready.length ? `Submit ${ready.length} review${ready.length > 1 ? "s" : ""}` : "Stars dein aur 2-4 lafz likhein"}
          </button>
        </div>
      </div>
    </section>
  );
}
