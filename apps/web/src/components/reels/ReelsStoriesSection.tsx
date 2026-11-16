"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Play, Sparkles, Heart, ChevronRight } from "lucide-react";
import { api } from "@/lib/client-api";
import { money } from "@/lib/format";
import { ShoppableReel, ShoppableReelModal, getYouTubeId } from "./ShoppableReelModal";

export function ReelsStoriesSection() {
  const [reels, setReels] = useState<ShoppableReel[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeReelIndex, setActiveReelIndex] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    api<{ data: ShoppableReel[] }>("/reels", { auth: false })
      .then((res) => {
        if (mounted && res.data && res.data.length > 0) {
          setReels(res.data);
        }
      })
      .catch((err) => {
        console.error("Failed to load reels:", err);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (loading || reels.length === 0) return null;

  return (
    <section className="relative my-10 px-4 sm:px-6 max-w-7xl mx-auto">
      {/* Section Header */}
      <div className="flex items-end justify-between mb-5">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 px-3 py-1 text-xs font-bold text-rose-500 mb-1.5">
            <span className="flex h-2 w-2 rounded-full bg-rose-500 animate-ping" />
            <span>TikTok & Insta Reels</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-ink tracking-tight flex items-center gap-2">
            <span>Watch in Action & Shop</span>
            <Sparkles size={20} className="text-amber-500" />
          </h2>
          <p className="text-xs sm:text-sm text-muted">
            Real customer unboxings, 10ft drop tests, and live MagSafe magnetic demonstrations.
          </p>
        </div>
        
        <button
          onClick={() => setActiveReelIndex(0)}
          className="hidden sm:inline-flex items-center gap-1 text-xs font-bold text-ink hover:text-accent transition"
        >
          <span>Watch All Reels</span>
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Reels Carousel Horizontal Row */}
      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-none snap-x snap-mandatory">
        {reels.map((reel, idx) => {
          const ytId = getYouTubeId(reel.videoUrl);
          const thumb = reel.thumbnailUrl || (ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : null);

          return (
            <div
              key={reel.id}
              onClick={() => setActiveReelIndex(idx)}
              className="group relative h-[320px] w-[185px] sm:h-[360px] sm:w-[210px] shrink-0 cursor-pointer overflow-hidden rounded-2xl bg-neutral-900 border border-line shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:border-rose-500/50 snap-start"
            >
              {/* Background Thumbnail Image */}
              {thumb ? (
                <Image
                  src={thumb}
                  alt={reel.title}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="h-full w-full bg-gradient-to-b from-neutral-800 to-black" />
              )}

            {/* Gradient Dark Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/60 group-hover:from-black/95 transition-colors" />

            {/* Top Badges */}
            <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between z-10">
              <span className="rounded-full bg-rose-600/90 backdrop-blur-sm px-2 py-0.5 text-[10px] font-black text-white uppercase tracking-wider">
                Reel
              </span>
              <span className="flex items-center gap-1 rounded-full bg-black/50 backdrop-blur-sm px-2 py-0.5 text-[10px] font-bold text-white">
                <Heart size={10} className="fill-rose-500 text-rose-500" />
                {reel.likesCount >= 1000 ? `${(reel.likesCount / 1000).toFixed(1)}k` : reel.likesCount}
              </span>
            </div>

            {/* Center Play Button Overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="rounded-full bg-white/20 p-3.5 text-white backdrop-blur-md transition-all duration-300 group-hover:scale-110 group-hover:bg-rose-500 shadow-lg">
                <Play size={20} className="fill-white translate-x-0.5" />
              </div>
            </div>

            {/* Bottom Attached Product Tag & Title */}
            <div className="absolute bottom-2.5 inset-x-2.5 z-10 space-y-1.5">
              <p className="text-xs font-bold text-white line-clamp-2 leading-tight drop-shadow-md">
                {reel.title}
              </p>

              {reel.productName && (
                <div className="flex items-center justify-between rounded-lg bg-white/15 p-1.5 backdrop-blur-md border border-white/20">
                  <div className="truncate mr-1">
                    <p className="text-[10px] font-semibold text-white/90 truncate">
                      {reel.productName}
                    </p>
                    <p className="text-[11px] font-black text-emerald-400">
                      {money(reel.productPrice || 2499)}
                    </p>
                  </div>
                  <span className="shrink-0 rounded bg-emerald-500 px-1.5 py-0.5 text-[9px] font-black text-black">
                    BUY
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>

      {/* Active Modal Viewer */}
      {activeReelIndex !== null && (
        <ShoppableReelModal
          reels={reels}
          initialIndex={activeReelIndex}
          onClose={() => setActiveReelIndex(null)}
        />
      )}
    </section>
  );
}
