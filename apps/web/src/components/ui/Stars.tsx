"use client";

import { useEffect, useId, useRef, useState } from "react";

const PATH = "M12 2.6l2.83 6.02 6.6.74-4.92 4.47 1.37 6.5L12 17.06l-5.88 3.27 1.37-6.5L2.57 9.36l6.6-.74z";

/** One shared observer for every star row on the page (cheap even with 50 product cards) */
let io: IntersectionObserver | null = null;
const cbs = new Map<Element, () => void>();
function watch(el: Element, cb: () => void) {
  if (typeof IntersectionObserver === "undefined") return cb();
  io ??= new IntersectionObserver(
    (entries) => {
      for (const e of entries)
        if (e.isIntersecting) {
          cbs.get(e.target)?.();
          cbs.delete(e.target);
          io!.unobserve(e.target);
        }
    },
    { threshold: 0.6 },
  );
  cbs.set(el, cb);
  io.observe(el);
  return () => {
    cbs.delete(el);
    io?.unobserve(el);
  };
}

/**
 * Gold rating stars. They "pop" in one after another the first time they scroll into view
 * (no animation for people who turned motion off). Supports halves: 4.3 → 4 full + 30 % star.
 */
export function Stars({ value, count, size = 14, animate = true, twinkle = false }: { value: number; count?: number; size?: number; animate?: boolean; /** gentle shine every few seconds (product cards) */ twinkle?: boolean }) {
  const id = useId().replace(/:/g, "");
  const ref = useRef<HTMLSpanElement>(null);
  const [state, setState] = useState<"idle" | "armed" | "on">("idle");

  useEffect(() => {
    if (!animate || !ref.current || !value) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    queueMicrotask(() => setState("armed"));
    return watch(ref.current, () => requestAnimationFrame(() => setState("on")));
  }, [animate, value]);

  return (
    <span
      ref={ref}
      className={`stars inline-flex items-center gap-1 ${state === "armed" ? "stars-armed" : state === "on" ? "stars-on" : ""} ${twinkle && value ? "stars-twinkle" : ""}`}
      aria-label={count ? `${value.toFixed(1)} out of 5, ${count} reviews` : value ? `${value} out of 5` : "No reviews yet"}
      role="img"
    >
      <span className="flex" aria-hidden>
        <svg width={0} height={0} className="absolute">
          <defs>
            <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ffd970" />
              <stop offset=".55" stopColor="#f5b301" />
              <stop offset="1" stopColor="#d98e04" />
            </linearGradient>
          </defs>
        </svg>
        {[0, 1, 2, 3, 4].map((i) => {
          const fill = Math.max(0, Math.min(1, value - i));
          return (
            <svg key={i} width={size} height={size} viewBox="0 0 24 24" style={{ ["--i" as string]: i }} className="star">
              <path d={PATH} fill="#e3e5ea" />
              {fill > 0 && (
                <>
                  <clipPath id={`c${id}${i}`}>
                    <rect x="0" y="0" width={24 * (fill > 0.85 ? 1 : fill < 0.15 ? 0 : fill)} height="24" />
                  </clipPath>
                  <path className="star-fill" d={PATH} fill={`url(#g${id})`} stroke="#c98502" strokeWidth=".6" clipPath={`url(#c${id}${i})`} />
                </>
              )}
            </svg>
          );
        })}
      </span>
      {count !== undefined && <span className="text-xs text-muted">{count > 0 ? `${value.toFixed(1)} (${count})` : "New"}</span>}
    </span>
  );
}
