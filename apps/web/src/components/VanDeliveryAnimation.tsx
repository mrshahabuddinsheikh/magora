"use client";

import { useEffect, useState } from "react";
import { Truck, CheckCircle2, Sparkles } from "lucide-react";

interface VanDeliveryAnimationProps {
  orderNumber: string;
  customerName?: string;
}

export function VanDeliveryAnimation({ orderNumber, customerName }: VanDeliveryAnimationProps) {
  const [stage, setStage] = useState<"loading" | "loaded" | "driving" | "done">("loading");

  useEffect(() => {
    // Stage sequence:
    // 0s - 1.2s: Parcel hops towards van
    // 1.2s - 2.2s: Parcel enters van, doors shut
    // 2.2s - 4.5s: Van accelerates and drives forward
    // 4.5s+: Status confirmed
    const t1 = setTimeout(() => setStage("loaded"), 1400);
    const t2 = setTimeout(() => setStage("driving"), 2400);
    const t3 = setTimeout(() => setStage("done"), 4600);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  return (
    <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-b from-[#111622] to-[#0a0d14] p-5 sm:p-7 text-white shadow-xl border border-white/10 mb-6">
      {/* Background ambient light */}
      <div className="absolute top-0 right-1/4 h-32 w-32 rounded-full bg-accent/20 blur-3xl pointer-events-none" />

      {/* Top Header */}
      <div className="relative z-10 flex items-center justify-between pb-3 border-b border-white/10 text-xs">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-bold text-zinc-300">Order #{orderNumber} Confirmed</span>
        </div>
        <span className="text-[11px] font-mono text-zinc-400">Magora Swift Dispatch · COD</span>
      </div>

      {/* Animation Stage Canvas */}
      <div className="relative h-32 sm:h-36 w-full flex items-end justify-between overflow-hidden mt-3 mb-2">
        {/* Road Surface */}
        <div className="absolute bottom-2 left-0 right-0 h-1 bg-zinc-800">
          <div className="h-full w-full bg-[repeating-linear-gradient(90deg,#4a65ff,#4a65ff_20px,transparent_20px,transparent_40px)] opacity-40 animate-[roadScroll_1s_linear_infinite]" />
        </div>

        {/* Parcel Box (Hops into Van) */}
        <div
          className={`absolute bottom-3 z-20 transition-all duration-700 ease-in-out ${
            stage === "loading"
              ? "left-6 sm:left-14 scale-100 opacity-100 animate-bounce"
              : stage === "loaded"
              ? "left-44 sm:left-56 bottom-10 scale-50 opacity-90"
              : "left-64 bottom-12 scale-0 opacity-0"
          }`}
        >
          <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-amber-600 shadow-md border border-amber-400/50 flex flex-col items-center justify-center text-[10px] font-bold text-amber-100">
            <span>📦</span>
            <span className="text-[8px] font-mono tracking-tighter">MAGORA</span>
          </div>
        </div>

        {/* Magora Delivery Van */}
        <div
          className={`relative z-10 transition-all ease-in-out ${
            stage === "driving"
              ? "duration-[2200ms] translate-x-[450px] sm:translate-x-[650px]"
              : "duration-700 translate-x-32 sm:translate-x-44"
          }`}
        >
          {/* Van Body SVG */}
          <div className="relative w-44 sm:w-52 select-none">
            <svg viewBox="0 0 200 100" className="w-full drop-shadow-2xl">
              {/* Van Body */}
              <path
                d="M 10 70 L 10 30 Q 10 25 15 25 L 130 25 Q 135 25 140 30 L 165 50 Q 170 55 170 60 L 170 70 Q 170 75 165 75 L 10 75 Z"
                fill="#4a65ff"
              />
              {/* Cabin Window */}
              <path
                d="M 132 30 L 138 33 L 160 50 L 132 50 Z"
                fill="#0f172a"
                stroke="#60a5fa"
                strokeWidth="1.5"
              />
              {/* Magora Brand Stripe on Van */}
              <rect x="20" y="44" width="95" height="18" rx="4" fill="#ffffff" />
              <text x="32" y="57" fontSize="9.5" fontWeight="900" fill="#0b0d12" letterSpacing="1">
                MAGORA
              </text>
              {/* Headlight Beam */}
              <polygon points="170,60 220,50 220,75 170,70" fill="url(#headlightGrad)" opacity="0.4" />
              {/* Wheels */}
              <g className={stage === "driving" ? "animate-spin origin-[45px_75px]" : ""}>
                <circle cx="45" cy="75" r="14" fill="#0f172a" stroke="#64748b" strokeWidth="2.5" />
                <circle cx="45" cy="75" r="5" fill="#e2e8f0" />
              </g>
              <g className={stage === "driving" ? "animate-spin origin-[140px_75px]" : ""}>
                <circle cx="140" cy="75" r="14" fill="#0f172a" stroke="#64748b" strokeWidth="2.5" />
                <circle cx="140" cy="75" r="5" fill="#e2e8f0" />
              </g>

              {/* Headlight Gradient Def */}
              <defs>
                <linearGradient id="headlightGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>

            {/* Exhaust Smoke Puffs */}
            {stage === "driving" && (
              <div className="absolute -left-6 bottom-4 flex gap-1 pointer-events-none">
                <span className="inline-block h-3 w-3 rounded-full bg-zinc-600/60 animate-ping" />
                <span className="inline-block h-4 w-4 rounded-full bg-zinc-500/50 animate-ping delay-150" />
                <span className="text-xs">💨</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 text-xs">
        <div className="flex items-center gap-2">
          {stage === "done" ? (
            <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
          ) : (
            <Truck size={18} className="text-accent shrink-0 animate-pulse" />
          )}
          <span className="font-semibold text-zinc-200">
            {stage === "loading" && `Packing parcel for ${customerName || "Customer"}...`}
            {stage === "loaded" && "Parcel secured in the delivery van!"}
            {stage === "driving" && "Delivery van is dispatched and rolling on the road!"}
            {stage === "done" && "Order successfully dispatched to rider! Cash on Delivery confirmed."}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-zinc-400 text-[11px]">
          <Sparkles size={13} className="text-amber-400" />
          <span>7-day easy exchange & open parcel allowed</span>
        </div>
      </div>
    </div>
  );
}
