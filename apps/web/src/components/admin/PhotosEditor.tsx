"use client";

import { useState } from "react";
import { PUBLIC_API_URL } from "@/lib/config";

/** Upload / remove / reorder product photos (first photo = card image). */
export function PhotosEditor({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setErr(null);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files).slice(0, 10 - value.length)) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch(`${PUBLIC_API_URL}/uploads`, { method: "POST", body: fd });
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error?.message ?? "Upload failed");
        urls.push(body.data.url);
      }
      onChange([...value, ...urls]);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {value.map((src, i) => (
          <span key={src} className="relative h-20 w-20 overflow-hidden rounded-2xl bg-white shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="h-full w-full object-cover" />
            <button type="button" onClick={() => onChange(value.filter((x) => x !== src))} className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-xs text-white" aria-label="Remove photo">×</button>
            {i > 0 && (
              <button type="button" onClick={() => onChange([src, ...value.filter((x) => x !== src)])} className="absolute bottom-1 left-1 rounded-full bg-white/90 px-1.5 text-[10px] font-semibold">Main</button>
            )}
          </span>
        ))}
        {value.length < 10 && (
          <label className="grid h-20 w-20 cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-black/15 text-xs text-muted hover:border-accent">
            {busy ? "Uploading…" : "+ Photo"}
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => upload(e.target.files)} />
          </label>
        )}
      </div>
      {err && <p className="mt-1 text-xs text-danger">{err}</p>}
    </div>
  );
}

