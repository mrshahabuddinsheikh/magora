import { useId } from "react";

/**
 * SVG illustrations for gadgets (earbuds, watch, power bank, charger, cable,
 * handsfree). Like the case thumbs they cost zero image downloads, so gadget
 * listings stay as fast as the rest of the store. Uploaded product photos,
 * when an admin adds them, are shown instead.
 */
export function GadgetThumb({ material, color, accent, className }: { material: string; color: string; accent?: string | null; className?: string }) {
  const id = useId().replace(/:/g, "");
  const dark = isDark(color);
  const edge = dark ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.12)";
  const acc = accent ?? (dark ? "#3b3e45" : "#d5d8dd");
  const sheen = (
    <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor="#fff" stopOpacity={dark ? 0.22 : 0.7} />
      <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
      <stop offset="1" stopColor="#000" stopOpacity={dark ? 0.3 : 0.12} />
    </linearGradient>
  );
  const shadow = (
    <filter id={`s${id}`} x="-30%" y="-30%" width="160%" height="170%">
      <feDropShadow dx="0" dy="8" stdDeviation="7" floodColor="#0b0d12" floodOpacity="0.2" />
    </filter>
  );
  const common = { viewBox: "0 0 200 200", className, role: "img" as const };

  switch (material) {
    case "gadget-earbuds":
      return (
        <svg {...common} aria-label="Earbuds">
          <defs>{sheen}{shadow}</defs>
          <g filter={`url(#s${id})`}>
            {/* case */}
            <rect x="46" y="88" width="108" height="82" rx="34" fill={color} stroke={edge} />
            <path d="M47 112 H153" stroke={edge} strokeWidth="2" />
            <rect x="46" y="88" width="108" height="82" rx="34" fill={`url(#g${id})`} />
            <circle cx="100" cy="140" r="3" fill="#34d399" />
            {/* buds */}
            {[-1, 1].map((d) => (
              <g key={d} transform={`translate(${100 + d * 30} 58) rotate(${d * 14})`}>
                <rect x="-6" y="0" width="12" height="40" rx="6" fill={color} stroke={edge} />
                <ellipse cx="0" cy="0" rx="16" ry="14" fill={color} stroke={edge} />
                <ellipse cx={d * -6} cy="-2" rx="6" ry="5" fill={acc} />
                <ellipse cx="0" cy="0" rx="16" ry="14" fill={`url(#g${id})`} />
                <rect x="-3" y="34" width="6" height="5" rx="2" fill={dark ? "#888" : "#b9bdc4"} />
              </g>
            ))}
          </g>
        </svg>
      );
    case "gadget-watch":
      return (
        <svg {...common} aria-label="Smart watch">
          <defs>
            {sheen}
            {shadow}
            <linearGradient id={`sc${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#141726" /><stop offset="1" stopColor="#07080c" /></linearGradient>
          </defs>
          <g filter={`url(#s${id})`}>
            <rect x="72" y="8" width="56" height="62" rx="12" fill={acc} />
            <rect x="72" y="130" width="56" height="62" rx="12" fill={acc} />
            {[20, 34, 48].map((y) => <rect key={y} x="96" y={150 + y / 3} width="8" height="3" rx="1.5" fill="#000" opacity="0.18" />)}
            <rect x="56" y="48" width="88" height="104" rx="26" fill={color} stroke={edge} strokeWidth="2" />
            <rect x="62" y="54" width="76" height="92" rx="21" fill={`url(#sc${id})`} />
            <rect x="144" y="82" width="7" height="20" rx="3" fill={color} stroke={edge} />
            <text x="100" y="94" textAnchor="middle" fill="#fff" fontSize="21" fontWeight="700" fontFamily="system-ui">10:09</text>
            <circle cx="82" cy="120" r="10" fill="none" stroke="#f43f5e" strokeWidth="3.5" strokeDasharray="44 63" />
            <circle cx="100" cy="120" r="10" fill="none" stroke="#a3e635" strokeWidth="3.5" strokeDasharray="34 63" />
            <circle cx="118" cy="120" r="10" fill="none" stroke="#22d3ee" strokeWidth="3.5" strokeDasharray="52 63" />
            <rect x="56" y="48" width="88" height="104" rx="26" fill={`url(#g${id})`} opacity="0.6" />
          </g>
        </svg>
      );
    case "gadget-powerbank":
      return (
        <svg {...common} aria-label="Power bank">
          <defs>{sheen}{shadow}</defs>
          <g filter={`url(#s${id})`}>
            <rect x="52" y="22" width="96" height="156" rx="22" fill={color} stroke={edge} strokeWidth="2" />
            <circle cx="100" cy="92" r="34" fill="none" stroke={acc} strokeWidth="5" opacity="0.9" />
            <circle cx="100" cy="92" r="4" fill={acc} />
            {[0, 1, 2, 3].map((i) => <circle key={i} cx={88 + i * 8} cy="150" r="2.6" fill={i < 3 ? "#34d399" : edge} />)}
            <rect x="88" y="171" width="24" height="5" rx="2.5" fill={dark ? "#111" : "#9aa0a8"} />
            <rect x="52" y="22" width="96" height="156" rx="22" fill={`url(#g${id})`} />
          </g>
        </svg>
      );
    case "gadget-charger":
      return (
        <svg {...common} aria-label="Wall charger">
          <defs>{sheen}{shadow}</defs>
          <g filter={`url(#s${id})`}>
            {/* pins */}
            <rect x="80" y="22" width="9" height="34" rx="4.5" fill="#c9ccd2" stroke="#9aa0a8" />
            <rect x="111" y="22" width="9" height="34" rx="4.5" fill="#c9ccd2" stroke="#9aa0a8" />
            <rect x="50" y="50" width="100" height="112" rx="24" fill={color} stroke={edge} strokeWidth="2" />
            <path d="M50 74 H150" stroke={edge} />
            {/* ports */}
            <rect x="80" y="104" width="40" height="11" rx="5.5" fill={dark ? "#0b0b0d" : "#2b2d33"} />
            <rect x="80" y="126" width="40" height="11" rx="5.5" fill={dark ? "#0b0b0d" : "#2b2d33"} opacity="0.85" />
            <text x="100" y="94" textAnchor="middle" fontSize="11" fontWeight="800" fontFamily="system-ui" fill={dark ? "#fff" : "#0f172a"} opacity="0.55">PD</text>
            <rect x="50" y="50" width="100" height="112" rx="24" fill={`url(#g${id})`} />
          </g>
        </svg>
      );
    case "gadget-cable":
      return (
        <svg {...common} aria-label="Charging cable">
          <defs>{shadow}</defs>
          <g filter={`url(#s${id})`} fill="none" strokeLinecap="round">
            <path d="M58 156 C 20 120, 40 60, 100 62 C 160 64, 178 120, 140 146 C 110 166, 80 130, 110 112 C 132 98, 150 120, 146 150" stroke={color} strokeWidth="9" />
            <path d="M58 156 C 20 120, 40 60, 100 62 C 160 64, 178 120, 140 146 C 110 166, 80 130, 110 112 C 132 98, 150 120, 146 150" stroke={acc} strokeWidth="9" strokeDasharray="2 6" opacity="0.45" />
          </g>
          {/* connector heads */}
          <g filter={`url(#s${id})`}>
            <g transform="translate(58 156) rotate(35)">
              <rect x="-9" y="-2" width="18" height="30" rx="5" fill={acc} />
              <rect x="-6" y="26" width="12" height="13" rx="3" fill="#c9ccd2" stroke="#9aa0a8" />
            </g>
            <g transform="translate(146 150) rotate(-8)">
              <rect x="-9" y="-2" width="18" height="30" rx="5" fill={acc} />
              <rect x="-6" y="26" width="12" height="13" rx="3" fill="#c9ccd2" stroke="#9aa0a8" />
            </g>
          </g>
        </svg>
      );
    case "gadget-handsfree":
      return (
        <svg {...common} aria-label="Handsfree earphones">
          <defs>{sheen}{shadow}</defs>
          <g fill="none" strokeLinecap="round" stroke={color} strokeWidth="4" filter={`url(#s${id})`}>
            <path d="M66 62 C 70 100, 92 110, 100 122" />
            <path d="M134 62 C 130 100, 108 110, 100 122" />
            <path d="M100 122 C 100 150, 90 160, 100 178" />
          </g>
          <g filter={`url(#s${id})`}>
            {[66, 134].map((x, i) => (
              <g key={x} transform={`translate(${x} 48) rotate(${i ? 18 : -18})`}>
                <ellipse cx="0" cy="0" rx="17" ry="15" fill={color} stroke={edge} />
                <ellipse cx={i ? -6 : 6} cy="-2" rx="7" ry="6" fill={acc} />
                <rect x="-5" y="10" width="10" height="16" rx="5" fill={color} stroke={edge} />
              </g>
            ))}
            <rect x="94" y="134" width="12" height="24" rx="6" fill={color} stroke={edge} />
            <rect x="94" y="172" width="12" height="14" rx="3" fill={acc} />
            <rect x="97" y="185" width="6" height="11" rx="2" fill="#c9ccd2" stroke="#9aa0a8" />
          </g>
        </svg>
      );
    default:
      return (
        <svg {...common} aria-label="Gadget">
          <rect x="50" y="40" width="100" height="120" rx="24" fill={color} />
        </svg>
      );
  }
}

function isDark(hex: string) {
  const h = hex.replace("#", "");
  if (h.length < 6) return false;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return r * 0.299 + g * 0.587 + b * 0.114 < 120;
}
