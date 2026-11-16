"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/format";

/** Full-screen photo viewer: arrows / swipe / keyboard, tap to zoom. */
export function Lightbox({ images, index, onClose, alt }: { images: string[]; index: number; onClose: () => void; alt: string }) {
  const [i, setI] = useState(index);
  const [zoom, setZoom] = useState(false);
  const [touchX, setTouchX] = useState<number | null>(null);
  const go = (d: number) => {
    setZoom(false);
    setI((x) => (x + d + images.length) % images.length);
  };
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", k);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", k);
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-[#0b0d12]/92"
      role="dialog"
      aria-modal="true"
      aria-label="Photos"
      onClick={onClose}
      onTouchStart={(e) => setTouchX(e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX === null || zoom) return;
        const dx = e.changedTouches[0].clientX - touchX;
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
        setTouchX(null);
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={images[i]}
        alt={`${alt} — photo ${i + 1}`}
        onClick={(e) => {
          e.stopPropagation();
          setZoom((z) => !z);
        }}
        className={cn("max-h-[88vh] max-w-[92vw] select-none object-contain transition-transform duration-300", zoom ? "scale-[1.8] cursor-zoom-out" : "cursor-zoom-in")}
      />
      <button onClick={onClose} className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25" aria-label="Close">
        <X size={20} />
      </button>
      {images.length > 1 && (
        <>
          <button onClick={(e) => { e.stopPropagation(); go(-1); }} className="absolute left-3 grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25" aria-label="Previous photo">
            <ChevronLeft size={22} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); go(1); }} className="absolute right-3 grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25" aria-label="Next photo">
            <ChevronRight size={22} />
          </button>
          <span className="absolute bottom-5 rounded-full bg-white/15 px-3 py-1 text-sm text-white">{i + 1} / {images.length}</span>
        </>
      )}
    </div>
  );
}
