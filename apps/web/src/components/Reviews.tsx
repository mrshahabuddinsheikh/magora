"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, Star } from "lucide-react";
import { api } from "@/lib/client-api";
import { Stars } from "./ui/Stars";
import { cn } from "@/lib/format";
import type { Review } from "@/lib/types";

type Meta = { hasMore: boolean; breakdown?: { stars: number; n: number }[]; photos?: string[] };

export function Reviews({ slug, ratingAvg, ratingCount }: { slug: string; ratingAvg: number; ratingCount: number }) {
  const [items, setItems] = useState<Review[]>([]);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [form, setForm] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);

  useEffect(() => {
    api<{ data: Review[]; meta: Meta }>(`/products/${slug}/reviews?page=${page}`, { auth: false })
      .then((r) => {
        setItems((x) => (page === 1 ? r.data : [...x, ...r.data]));
        setMeta((m) => (page === 1 ? r.meta : { ...m!, hasMore: r.meta.hasMore }));
      })
      .catch(() => {});
  }, [slug, page]);

  const total = meta?.breakdown?.reduce((a, b) => a + b.n, 0) ?? ratingCount;

  return (
    <section id="reviews" className="card mt-10 scroll-mt-28 p-5 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h2 className="text-2xl font-bold tracking-tight">Customer reviews</h2>
        <button className="btn btn-glass" onClick={() => setForm((f) => !f)}>Write a review</button>
      </div>

      {ratingCount > 0 ? (
        <div className="mt-5 grid gap-6 sm:grid-cols-[auto_1fr] sm:items-center">
          <div className="text-center sm:pr-6">
            <p className="text-[52px] font-bold leading-none tracking-tight">{ratingAvg.toFixed(1)}</p>
            <div className="mt-2"><Stars value={ratingAvg} size={22} /></div>
            <p className="mt-1.5 text-[13px] text-muted">{ratingCount} {ratingCount === 1 ? "review" : "reviews"}</p>
          </div>
          <ul className="space-y-1.5">
            {(meta?.breakdown ?? []).map((b) => (
              <li key={b.stars} className="flex items-center gap-2.5 text-[13px]">
                <span className="w-8 shrink-0 tabular-nums text-muted">{b.stars} ★</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-black/[0.06]">
                  <span className="block h-full rounded-full bg-gradient-to-r from-[#ffd970] to-[#f5b301] transition-[width] duration-700" style={{ width: total ? `${(b.n / total) * 100}%` : 0 }} />
                </span>
                <span className="w-7 shrink-0 text-right tabular-nums text-muted">{b.n}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="mt-5 rounded-[22px] bg-gradient-to-br from-[#fff8e6] to-[#fff3d6] p-5 text-center">
          <Stars value={0} size={26} animate={false} />
          <p className="mt-2 text-[15px] font-semibold">Be the first to review this product</p>
          <p className="mt-1 text-[13px] text-muted">Bought it from us? After delivery we send you a link on WhatsApp to rate your order.</p>
        </div>
      )}

      {!!meta?.photos?.length && (
        <div className="mt-6">
          <p className="mb-2 text-[13px] font-semibold">Photos from customers</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {meta.photos.map((u) => (
              <button key={u} onClick={() => setZoom(u)} className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-black/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u} alt="Customer photo" loading="lazy" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}

      {form && <ReviewForm slug={slug} onDone={() => setForm(false)} />}

      <ul className="mt-6 grid gap-3 md:grid-cols-2">
        {items.map((r) => (
          <li key={r.id} className="rounded-[22px] bg-black/[0.03] p-4">
            <div className="flex items-center justify-between gap-2">
              <Stars value={r.rating} size={15} />
              <span className="text-xs text-muted">{new Date(r.createdAt).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" })}</span>
            </div>
            {r.title && <p dir="auto" className="mt-2 font-semibold">{r.title}</p>}
            <p dir="auto" className="mt-1 whitespace-pre-line text-[14.5px] leading-relaxed text-ink/80 [&:lang(ur)]:text-[16px]">{r.body}</p>
            {!!r.photos?.length && (
              <div className="mt-2.5 flex gap-2">
                {r.photos.map((u) => (
                  <button key={u} onClick={() => setZoom(u)} className="h-16 w-16 overflow-hidden rounded-xl bg-black/5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={u} alt="" loading="lazy" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
            <p className="mt-2.5 flex flex-wrap items-center gap-x-2 text-[13px] font-medium">
              <span dir="auto">{r.name}</span>
              {r.verified && <span className="flex items-center gap-0.5 text-success"><BadgeCheck size={14} /> Verified buyer</span>}
            </p>
            {r.adminReply && (
              <div className="mt-3 rounded-2xl border-l-[3px] border-accent bg-white/80 px-3 py-2 text-[13px]">
                <p className="text-[11.5px] font-semibold uppercase tracking-wide text-accent">Reply from the store</p>
                <p dir="auto" className="mt-0.5 whitespace-pre-line text-ink/80">{r.adminReply}</p>
              </div>
            )}
          </li>
        ))}
      </ul>
      {meta?.hasMore && (
        <div className="mt-4 text-center">
          <button className="btn btn-glass" onClick={() => setPage((p) => p + 1)}>Load more</button>
        </div>
      )}
      {zoom && (
        <button onClick={() => setZoom(null)} className="fixed inset-0 z-[80] grid place-items-center bg-black/80 p-4" aria-label="Close photo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom} alt="Customer photo" className="max-h-full max-w-full rounded-2xl" />
        </button>
      )}
    </section>
  );
}

function ReviewForm({ slug, onDone }: { slug: string; onDone: () => void }) {
  const [rating, setRating] = useState(5);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="mt-5 grid gap-3 rounded-[22px] bg-white/70 p-4 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setBusy(true);
        setErr(null);
        try {
          const r = await api<{ data: { message: string } }>(`/products/${slug}/reviews`, {
            method: "POST",
            json: { name: f.get("name"), rating, title: f.get("title") || undefined, body: f.get("body") },
          });
          setMsg(r.data.message);
          setTimeout(onDone, 2500);
        } catch (e) {
          setErr((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      {msg ? (
        <p className="font-medium text-success sm:col-span-2">{msg}</p>
      ) : (
        <>
          <div className="sm:col-span-2">
            <span className="label">Your rating</span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <button type="button" key={i} onClick={() => setRating(i)} aria-label={`${i} stars`}>
                  <Star size={28} className={cn("transition-transform active:scale-90", i <= rating ? "fill-[#f5b301] text-[#d98e04]" : "fill-black/10 text-transparent")} />
                </button>
              ))}
            </div>
          </div>
          <label><span className="label">Name</span><input name="name" dir="auto" required minLength={2} className="input" /></label>
          <label><span className="label">Title (optional)</span><input name="title" dir="auto" className="input" /></label>
          <label className="sm:col-span-2"><span className="label">Review</span><textarea name="body" dir="auto" required minLength={5} rows={3} placeholder="English, Roman Urdu ya اردو — jo aap ko aasaan lage" className="input h-auto py-3" /></label>
          {err && <p className="text-sm text-danger sm:col-span-2">{err}</p>}
          <button className="btn btn-primary sm:col-span-2 sm:justify-self-start" disabled={busy}>Submit review</button>
        </>
      )}
    </form>
  );
}
