import { useId } from "react";
import type { CamLayout, Material } from "@/lib/types";
import { GadgetThumb } from "./GadgetThumb";

/**
 * Lightweight SVG illustration of a MagSafe case (back view). Used for product
 * cards, cart lines and as the instant poster while the 3D viewer loads —
 * zero image downloads, so listing pages stay fast with thousands of products.
 */
export type ThumbDesign = { url: string; fit?: "cover" | "contain" | "logo" };

/** A printed design on the thumbnail's back, clipped to the case shape. */
function DesignArt({ id, design }: { id: string; design: ThumbDesign }) {
  const fit = design.fit ?? "cover";
  const box = fit === "logo" ? { x: 33, y: 96, w: 54, h: 62 } : { x: 10, y: 8, w: 100, h: 214 };
  return (
    <g clipPath={`url(#dclip${id})`}>
      <clipPath id={`dclip${id}`}><rect x="10" y="8" width="100" height="214" rx="20" /></clipPath>
      <image href={design.url} x={box.x} y={box.y} width={box.w} height={box.h} preserveAspectRatio={fit === "cover" ? "xMidYMid slice" : "xMidYMid meet"} />
    </g>
  );
}

export function CaseThumb({
  material,
  color,
  accent,
  phoneHex = "#c9ccd2",
  layout = "bar",
  className,
  design,
}: {
  material: Material;
  color: string;
  accent?: string | null;
  phoneHex?: string;
  layout?: CamLayout;
  className?: string;
  design?: ThumbDesign | null;
}) {
  const id = useId().replace(/:/g, "");
  const clear = material === "clear";
  const fill = clear ? phoneHex : color;
  const ring = clear ? "#eef0f3" : material === "frosted" ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.14)";

  return (
    <svg viewBox="0 0 120 230" className={className} role="img" aria-label="Case preview">
      <defs>
        <linearGradient id={`sheen${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity={clear ? 0.55 : 0.32} />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.16" />
        </linearGradient>
        <pattern id={`carbon${id}`} width="8" height="8" patternUnits="userSpaceOnUse">
          <rect width="8" height="8" fill={color} />
          <rect width="4" height="4" fill="#fff" opacity="0.12" />
          <rect x="4" y="4" width="4" height="4" fill="#fff" opacity="0.12" />
        </pattern>
        <pattern id={`grain${id}`} width="6" height="6" patternUnits="userSpaceOnUse">
          <rect width="6" height="6" fill={color} />
          <circle cx="1.5" cy="1.5" r="0.8" fill="#000" opacity="0.12" />
          <circle cx="4.5" cy="4" r="0.9" fill="#fff" opacity="0.08" />
        </pattern>
        <filter id={`shadow${id}`} x="-30%" y="-20%" width="160%" height="150%">
          <feDropShadow dx="0" dy="8" stdDeviation="7" floodColor="#0b0d12" floodOpacity="0.22" />
        </filter>
      </defs>

      <g filter={`url(#shadow${id})`}>
        {/* case body */}
        <rect x="8" y="6" width="104" height="218" rx="22" fill={material === "carbon" ? `url(#carbon${id})` : material === "leather" ? `url(#grain${id})` : fill} />
        {clear && <rect x="8" y="6" width="104" height="218" rx="22" fill={color} opacity={color.toLowerCase() === "#f4f7fb" ? 0.15 : 0.45} />}
        {material === "frosted" && <rect x="8" y="6" width="104" height="218" rx="22" fill="#fff" opacity="0.18" />}
        {design && <DesignArt id={id} design={design} />}
        <rect x="8.75" y="6.75" width="102.5" height="216.5" rx="21.5" fill="none" stroke={clear ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.12)"} strokeWidth="1.5" />

        {/* camera */}
        {layout === "bar" && (
          <g>
            <rect x="12" y="11" width="96" height="56" rx="16" fill="rgba(0,0,0,0.18)" />
            <rect x="13.5" y="12.5" width="93" height="53" rx="15" fill={clear ? phoneHex : "#1a1b1f"} opacity={clear ? 1 : 0.9} />
          </g>
        )}
        {layout === "plateau" && <rect x="14" y="13" width="56" height="56" rx="16" fill={clear ? phoneHex : "#1a1b1f"} stroke="rgba(0,0,0,0.2)" strokeWidth="2" />}
        {(layout === "bar" || layout === "plateau") &&
          [
            [30, 29],
            [30, 53],
            [52, 41],
          ].map(([cx, cy], i) => (
            <g key={i}>
              <circle cx={cx} cy={cy} r="10" fill="#2b2d33" />
              <circle cx={cx} cy={cy} r="7" fill="#07080c" />
              <circle cx={cx - 2} cy={cy - 2} r="2" fill="#6c7ab8" opacity="0.7" />
            </g>
          ))}
        {layout === "floating" &&
          [24, 44, 64].map((cy, i) => (
            <g key={i}>
              <circle cx="27" cy={cy} r="9.5" fill={accent ?? "#2b2d33"} stroke="rgba(0,0,0,0.25)" strokeWidth="1.5" />
              <circle cx="27" cy={cy} r="6" fill="#07080c" />
            </g>
          ))}
        {layout === "bar" && <circle cx="92" cy="29" r="4" fill="#f3ead2" />}
        {layout === "visor" && (
          <g>
            <rect x="12" y="30" width="96" height="30" rx="15" fill={clear ? phoneHex : "#1a1b1f"} stroke="rgba(0,0,0,0.22)" strokeWidth="1.5" />
            {[30, 48, 66].map((cx, i) => (
              <g key={i}>
                <circle cx={cx} cy="45" r="8" fill="#2b2d33" />
                <circle cx={cx} cy="45" r="5.4" fill="#07080c" />
                <circle cx={cx - 1.6} cy="43.4" r="1.6" fill="#6c7ab8" opacity="0.7" />
              </g>
            ))}
            <circle cx="88" cy="45" r="3.4" fill="#f3ead2" />
          </g>
        )}
        {layout === "circle" && (
          <g>
            <circle cx="60" cy="52" r="37" fill={clear ? phoneHex : "#1a1b1f"} stroke="#d7d9de" strokeWidth="2.5" />
            {[[47, 39], [73, 39], [47, 65], [73, 65]].map(([cx, cy], i) => (
              <g key={i}>
                <circle cx={cx} cy={cy} r="9.5" fill="#2b2d33" />
                <circle cx={cx} cy={cy} r="6.5" fill="#07080c" />
                <circle cx={cx - 2} cy={cy - 2} r="2" fill="#6c7ab8" opacity="0.7" />
              </g>
            ))}
          </g>
        )}
        {layout === "circle-left" && (
          <g>
            <circle cx="41" cy="41" r="28" fill={clear ? phoneHex : "#1a1b1f"} stroke="#d7d9de" strokeWidth="2" />
            {[[41, 29], [30, 48], [52, 48]].map(([cx, cy], i) => (
              <g key={i}>
                <circle cx={cx} cy={cy} r="8.5" fill="#2b2d33" />
                <circle cx={cx} cy={cy} r="5.8" fill="#07080c" />
              </g>
            ))}
            <circle cx="80" cy="24" r="3.6" fill="#f3ead2" />
          </g>
        )}

        {/* MagSafe ring */}
        {material !== "carbon" && (
          <g>
            <circle cx="60" cy="128" r="33" fill="none" stroke={ring} strokeWidth={clear ? 7 : 2} />
            {clear && <rect x="57.5" y="164" width="5" height="11" rx="1.5" fill={ring} />}
          </g>
        )}
        <rect x="8" y="6" width="104" height="218" rx="22" fill={`url(#sheen${id})`} />
      </g>
    </svg>
  );
}

/** Phone back wrapped in a skin (pattern / photo), camera left uncovered. */
export function SkinThumb({ material, color, accent, imageUrl: photo, className, design, layout = "plateau", phoneHex = "#c9ccd2" }: { material: string; color: string; accent?: string | null; imageUrl?: string | null; className?: string; design?: ThumbDesign | null; layout?: CamLayout; phoneHex?: string }) {
  const id = useId().replace(/:/g, "");
  // a printed design on a regular skin fills the back like a photo
  const imageUrl = photo ?? (design && material !== "skin-custom" ? design.url : null);
  const fill =
    imageUrl && material !== "skin-custom" ? `url(#img${id})` :
    material === "skin-custom" ? (imageUrl ? `url(#img${id})` : `url(#ph${id})`)
    : material === "skin-carbon" ? `url(#cb${id})`
    : material === "skin-marble" ? `url(#mb${id})`
    : material === "skin-wood" ? `url(#wd${id})`
    : material === "skin-metal" ? `url(#mt${id})`
    : color;
  return (
    <svg viewBox="0 0 120 230" className={className} role="img" aria-label="Skin preview">
      <defs>
        <clipPath id={`clip${id}`}><rect x="10" y="8" width="100" height="214" rx="20" /></clipPath>
        <pattern id={`cb${id}`} width="7" height="7" patternUnits="userSpaceOnUse"><rect width="7" height="7" fill={color} /><rect width="3.5" height="3.5" fill="#fff" opacity="0.16" /><rect x="3.5" y="3.5" width="3.5" height="3.5" fill="#fff" opacity="0.16" /></pattern>
        <pattern id={`wd${id}`} width="120" height="10" patternUnits="userSpaceOnUse"><rect width="120" height="10" fill={color} /><path d="M0 3 Q30 0 60 4 T120 3" stroke="#000" strokeOpacity="0.2" fill="none" /><path d="M0 8 Q40 6 80 9 T120 7" stroke="#fff" strokeOpacity="0.1" fill="none" /></pattern>
        <linearGradient id={`mt${id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff" stopOpacity="0.6" /><stop offset="0.5" stopColor={color} /><stop offset="1" stopColor="#000" stopOpacity="0.25" /></linearGradient>
        <pattern id={`mb${id}`} width="120" height="230" patternUnits="userSpaceOnUse"><rect width="120" height="230" fill={color} /><path d="M10 20 C40 60 30 90 70 120 S90 190 110 220" stroke={accent ?? "#999"} strokeWidth="1.4" fill="none" opacity="0.6" /><path d="M90 10 C70 50 95 80 60 140 S30 200 20 225" stroke={accent ?? "#999"} strokeWidth="0.8" fill="none" opacity="0.45" /></pattern>
        <linearGradient id={`ph${id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#c7d2fe" /><stop offset="0.5" stopColor="#f5d0fe" /><stop offset="1" stopColor="#fecdd3" /></linearGradient>
        {imageUrl && <pattern id={`img${id}`} width="1" height="1" patternContentUnits="objectBoundingBox"><image href={imageUrl} width="1" height="1" preserveAspectRatio="xMidYMid slice" /></pattern>}
        <linearGradient id={`sh${id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff" stopOpacity="0.35" /><stop offset="0.45" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity="0.15" /></linearGradient>
        <filter id={`sd${id}`} x="-30%" y="-20%" width="160%" height="150%"><feDropShadow dx="0" dy="8" stdDeviation="7" floodColor="#0b0d12" floodOpacity="0.22" /></filter>
      </defs>
      <g filter={`url(#sd${id})`}>
        <rect x="8" y="6" width="104" height="218" rx="22" fill="#b9bdc4" />
        <rect x="10" y="8" width="100" height="214" rx="20" fill={fill} />
        {material === "skin-custom" && !imageUrl && (
          <g fill="#0f172a" opacity="0.55" textAnchor="middle" fontFamily="system-ui" fontWeight="700">
            <text x="60" y="128" fontSize="11">Your photo</text>
            <rect x="34" y="96" width="52" height="44" rx="6" fill="none" stroke="#0f172a" strokeDasharray="4 3" />
          </g>
        )}
        {/* camera cut-out showing the phone */}
        <SkinCutout layout={layout} phoneHex={phoneHex} />
        <rect x="10" y="8" width="100" height="214" rx="20" fill={`url(#sh${id})`} clipPath={`url(#clip${id})`} />
      </g>
    </svg>
  );
}

/** The hole in a skin where the phone's own camera shows through, shaped like that phone's camera */
function SkinCutout({ layout, phoneHex }: { layout: CamLayout; phoneHex: string }) {
  const lens = (cx: number, cy: number, r = 9.5) => (
    <g key={`${cx}-${cy}`}><circle cx={cx} cy={cy} r={r} fill="#2b2d33" /><circle cx={cx} cy={cy} r={r * 0.68} fill="#07080c" /></g>
  );
  const edge = { fill: phoneHex, stroke: "rgba(0,0,0,0.25)" };
  switch (layout) {
    case "bar":
      return <g><rect x="13" y="11" width="94" height="54" rx="15" {...edge} />{lens(30, 27)}{lens(30, 50)}{lens(52, 38)}<circle cx="90" cy="27" r="3.6" fill="#f3ead2" /></g>;
    case "visor":
      return <g><rect x="12" y="30" width="96" height="30" rx="15" {...edge} />{lens(30, 45, 8)}{lens(48, 45, 8)}{lens(66, 45, 8)}<circle cx="88" cy="45" r="3.4" fill="#f3ead2" /></g>;
    case "circle":
      return <g><circle cx="60" cy="52" r="36" {...edge} />{lens(47, 39, 9)}{lens(73, 39, 9)}{lens(47, 65, 9)}{lens(73, 65, 9)}</g>;
    case "circle-left":
      return <g><circle cx="41" cy="41" r="28" {...edge} />{lens(41, 29, 8.5)}{lens(30, 48, 8.5)}{lens(52, 48, 8.5)}</g>;
    case "floating":
      return <g>{[24, 44, 64].map((cy) => <g key={cy}><circle cx="27" cy={cy} r="10.5" {...edge} />{lens(27, cy, 8.5)}</g>)}</g>;
    default:
      return <g><rect x="14" y="12" width="56" height="56" rx="15" {...edge} />{lens(30, 28)}{lens(30, 52)}{lens(52, 40)}</g>;
  }
}

/** Phone front with a glass protector (or the camera with lens guards). */
export function ProtectorThumb({ material, color, className }: { material: string; color: string; className?: string }) {
  const id = useId().replace(/:/g, "");
  if (material === "lens")
    return (
      <svg viewBox="0 0 120 230" className={className} role="img" aria-label="Lens protector preview">
        <rect x="8" y="6" width="104" height="218" rx="22" fill="#c9ccd2" />
        <rect x="12" y="10" width="62" height="62" rx="17" fill="#b5b9c0" />
        {[[31, 29], [31, 55], [56, 42]].map(([cx, cy], i) => (
          <g key={i}><circle cx={cx} cy={cy} r="12" fill={color} /><circle cx={cx} cy={cy} r="9.5" fill="#07080c" /><circle cx={cx - 3} cy={cy - 3} r="3" fill="#9fb4ff" opacity="0.7" /></g>
        ))}
        <path d="M14 14 L70 14 L20 70 Z" fill="#fff" opacity="0.18" />
      </svg>
    );
  const tint = material === "glass-privacy" ? 0.55 : material === "glass-matte" ? 0.1 : 0.04;
  return (
    <svg viewBox="0 0 120 230" className={className} role="img" aria-label="Screen protector preview">
      <defs>
        <linearGradient id={`wp${id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#1b1f4b" /><stop offset="0.55" stopColor="#5b2a86" /><stop offset="1" stopColor="#f0773c" /></linearGradient>
        <linearGradient id={`gl${id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff" stopOpacity="0.55" /><stop offset="0.35" stopColor="#fff" stopOpacity="0.05" /><stop offset="0.6" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#fff" stopOpacity="0.2" /></linearGradient>
      </defs>
      <rect x="8" y="6" width="104" height="218" rx="22" fill="#1a1b1f" />
      <rect x="12" y="10" width="96" height="210" rx="18" fill={`url(#wp${id})`} />
      <rect x="45" y="17" width="30" height="9" rx="4.5" fill="#050505" />
      <text x="60" y="66" textAnchor="middle" fill="#fff" fontSize="22" fontWeight="700" fontFamily="system-ui" opacity="0.9">9:41</text>
      <rect x="10" y="8" width="100" height="214" rx="20" fill={material === "glass-privacy" ? "#000" : "#fff"} opacity={tint} />
      <rect x="10" y="8" width="100" height="214" rx="20" fill={`url(#gl${id})`} stroke="#fff" strokeOpacity="0.7" />
    </svg>
  );
}

/** Picks the right thumbnail for any product */
export function ProductThumb(p: { material: string; color: string; accent?: string | null; imageUrl?: string | null; phoneHex?: string; layout?: CamLayout; className?: string; design?: ThumbDesign | null }) {
  if (p.material.startsWith("gadget-")) return <GadgetThumb {...p} />;
  if (p.material.startsWith("skin-")) return <SkinThumb {...p} />;
  if (p.material.startsWith("glass-") || p.material === "lens") return <ProtectorThumb {...p} />;
  return <CaseThumb {...(p as Parameters<typeof CaseThumb>[0])} />;
}
