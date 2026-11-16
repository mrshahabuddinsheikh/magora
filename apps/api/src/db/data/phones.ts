import type { CameraSpec } from "../../lib/types";

/**
 * Phone catalogue used by the seed. Dimensions are official manufacturer
 * figures (height × width × depth, mm). Camera positions are close
 * approximations made for the 3D preview — fine-tune any value here and re-seed,
 * or edit it later from the admin API.
 */

export interface PhoneSeed {
  brand: "apple" | "samsung" | "google" | "xiaomi" | "oneplus" | "vivo" | "oppo" | "iqoo" | "motorola";
  slug: string;
  name: string;
  year: number;
  h: number;
  w: number;
  d: number;
  r: number;
  camera: CameraSpec;
  bodyHex: string;
  aliases?: string;
  popular?: boolean;
  priceAdjust?: number;
}

/* ── camera layout helpers ── */

const iphoneProIsland = (size: number): CameraSpec => {
  const x = 5,
    y = 5,
    o = size * 0.27;
  const d = size * 0.34;
  return {
    type: "plateau",
    x,
    y,
    w: size,
    h: size,
    r: 11,
    rise: 1.6,
    lenses: [
      { x: x + o, y: y + o, d },
      { x: x + o, y: y + size - o, d },
      { x: x + size - o * 0.95, y: y + size / 2, d },
      { x: x + size - 9, y: y + 8.5, d: 6, kind: "flash" },
      { x: x + size - 9, y: y + size - 8.5, d: 4.5, kind: "sensor" },
    ],
  };
};

const iphoneProBar = (w: number): CameraSpec => ({
  type: "bar",
  x: 1.6,
  y: 3.5,
  w: w - 3.2,
  h: 42,
  r: 10,
  rise: 1.4,
  lenses: [
    { x: 14, y: 14, d: 15 },
    { x: 14, y: 35, d: 15 },
    { x: 31.5, y: 24.5, d: 15 },
    { x: w - 14, y: 14, d: 6, kind: "flash" },
    { x: w - 14, y: 32, d: 4.5, kind: "sensor" },
  ],
});

const iphonePill = (): CameraSpec => ({
  type: "plateau",
  x: 6,
  y: 6,
  w: 22,
  h: 38,
  r: 11,
  rise: 1.2,
  lenses: [
    { x: 17, y: 16, d: 13 },
    { x: 17, y: 34, d: 13 },
    { x: 34, y: 13, d: 5.5, kind: "flash" },
  ],
});

const iphoneDiagonal = (): CameraSpec => ({
  type: "plateau",
  x: 6,
  y: 6,
  w: 34,
  h: 34,
  r: 9,
  rise: 1.2,
  lenses: [
    { x: 15, y: 15, d: 13 },
    { x: 31, y: 31, d: 13 },
    { x: 31, y: 14.5, d: 5.5, kind: "flash" },
  ],
});

const iphoneAirBar = (w: number): CameraSpec => ({
  type: "bar",
  x: 1.6,
  y: 4,
  w: w - 3.2,
  h: 26,
  r: 10,
  rise: 2.2,
  lenses: [
    { x: 15, y: 17, d: 14 },
    { x: 33, y: 17, d: 5.5, kind: "flash" },
  ],
});

const galaxyBase = (): CameraSpec => ({
  type: "floating",
  rise: 1.2,
  lenses: [
    { x: 13.5, y: 14, d: 11 },
    { x: 13.5, y: 27.5, d: 11 },
    { x: 13.5, y: 41, d: 11 },
    { x: 25.5, y: 14, d: 4.5, kind: "flash" },
  ],
});

const galaxyUltra = (): CameraSpec => ({
  type: "floating",
  rise: 1.4,
  lenses: [
    { x: 14.5, y: 14, d: 13 },
    { x: 14.5, y: 30, d: 14 },
    { x: 14.5, y: 46, d: 13 },
    { x: 31, y: 14, d: 13 },
    { x: 31, y: 28, d: 4.5, kind: "flash" },
    { x: 31, y: 34, d: 3.5, kind: "sensor" },
  ],
});

const pixelVisor = (w: number): CameraSpec => ({
  type: "bar",
  x: 6,
  y: 15,
  w: w - 12,
  h: 22,
  r: 11,
  rise: 2.6,
  hex: "#1d1f22",
  lenses: [
    { x: 18, y: 26, d: 12 },
    { x: 32, y: 26, d: 12 },
    { x: 46, y: 26, d: 11 },
    { x: w - 19, y: 26, d: 4.5, kind: "flash" },
  ],
});

/** big round island centred near the top (vivo X, OPPO Find X8 Pro / X9 Ultra, Xiaomi Ultra) */
const roundCentre = (w: number, d: number, y = 7, rise = 2.4, hex?: string): CameraSpec => {
  const x = (w - d) / 2,
    cx = w / 2,
    cy = y + d / 2,
    o = d * 0.19,
    ld = d * 0.27;
  return {
    type: "plateau",
    x,
    y,
    w: d,
    h: d,
    r: d / 2,
    rise,
    hex,
    lenses: [
      { x: cx - o, y: cy - o, d: ld },
      { x: cx + o, y: cy - o, d: ld },
      { x: cx - o, y: cy + o, d: ld },
      { x: cx + o, y: cy + o, d: ld * 0.8 },
      { x: cx, y: cy + d * 0.41, d: 4.2, kind: "flash" },
    ],
  };
};

/** round island in the top-left corner (OnePlus 13 / 13R) */
const roundCorner = (d: number, x = 6, y = 6, rise = 2.2): CameraSpec => {
  const cx = x + d / 2,
    cy = y + d / 2,
    ld = d * 0.3;
  return {
    type: "plateau",
    x,
    y,
    w: d,
    h: d,
    r: d / 2,
    rise,
    lenses: [
      { x: cx, y: cy - d * 0.22, d: ld },
      { x: cx - d * 0.2, y: cy + d * 0.14, d: ld },
      { x: cx + d * 0.2, y: cy + d * 0.14, d: ld },
      { x: x + d + 5.5, y: y + 9, d: 5, kind: "flash" },
    ],
  };
};

/** squircle island in the top-left corner (OnePlus 15, iQOO, OPPO Find X9, Xiaomi 15/17, Motorola) */
const squareTL = (size: number, r = size * 0.27, rise = 1.9, x = 6, y = 6, hex?: string): CameraSpec => {
  const o = size * 0.27,
    ld = size * 0.33;
  return {
    type: "plateau",
    x,
    y,
    w: size,
    h: size,
    r,
    rise,
    hex,
    lenses: [
      { x: x + o, y: y + o, d: ld },
      { x: x + size - o, y: y + o, d: ld },
      { x: x + o, y: y + size - o, d: ld },
      { x: x + size - o, y: y + size - o, d: 5, kind: "flash" },
    ],
  };
};

/** wide island across the top (Xiaomi 17 Pro Max, with its rear display on the right) */
const wideTop = (w: number): CameraSpec => ({
  type: "plateau",
  x: 5,
  y: 5,
  w: w - 10,
  h: 40,
  r: 12,
  rise: 1.8,
  lenses: [
    { x: 17, y: 16, d: 13.5 },
    { x: 17, y: 34, d: 13.5 },
    { x: 34, y: 25, d: 13.5 },
    { x: 47, y: 14, d: 5, kind: "flash" },
  ],
});

export const phones: PhoneSeed[] = [
  /* ── Apple ── */
  { brand: "apple", slug: "iphone-18-pro-max", name: "iPhone 18 Pro Max", year: 2026, h: 163.4, w: 78.0, d: 8.75, r: 12.5, camera: iphoneProBar(78.0), bodyHex: "#5c1a2b", aliases: "18pm 18promax ip18pm", popular: true, priceAdjust: 300 },
  { brand: "apple", slug: "iphone-18-pro", name: "iPhone 18 Pro", year: 2026, h: 150.0, w: 71.9, d: 8.75, r: 11.5, camera: iphoneProBar(71.9), bodyHex: "#5c1a2b", aliases: "18p 18pro ip18p", popular: true },
  { brand: "apple", slug: "iphone-17-pro-max", name: "iPhone 17 Pro Max", year: 2025, h: 163.4, w: 78.0, d: 8.75, r: 12.5, camera: iphoneProBar(78.0), bodyHex: "#e0703a", aliases: "17pm 17promax ip17pm", popular: true, priceAdjust: 300 },
  { brand: "apple", slug: "iphone-17-pro", name: "iPhone 17 Pro", year: 2025, h: 150.0, w: 71.9, d: 8.75, r: 11.5, camera: iphoneProBar(71.9), bodyHex: "#2f3c5a", aliases: "17p 17pro ip17p", popular: true },
  { brand: "apple", slug: "iphone-air", name: "iPhone Air", year: 2025, h: 156.2, w: 74.7, d: 5.64, r: 12, camera: iphoneAirBar(74.7), bodyHex: "#dfe3e8", aliases: "air iphoneair", priceAdjust: 200 },
  { brand: "apple", slug: "iphone-17", name: "iPhone 17", year: 2025, h: 149.6, w: 71.5, d: 7.95, r: 11.5, camera: iphonePill(), bodyHex: "#b9c6d8", aliases: "ip17" },
  { brand: "apple", slug: "iphone-16-pro-max", name: "iPhone 16 Pro Max", year: 2024, h: 163.0, w: 77.6, d: 8.25, r: 12.5, camera: iphoneProIsland(44), bodyHex: "#bfa48f", aliases: "16pm 16promax A3084 A3295 A3296", popular: true, priceAdjust: 300 },
  { brand: "apple", slug: "iphone-16-pro", name: "iPhone 16 Pro", year: 2024, h: 149.6, w: 71.5, d: 8.25, r: 11.5, camera: iphoneProIsland(41), bodyHex: "#3c3c3d", aliases: "16p 16pro A3083 A3292" },
  { brand: "apple", slug: "iphone-16-plus", name: "iPhone 16 Plus", year: 2024, h: 160.9, w: 77.8, d: 7.8, r: 12.5, camera: iphonePill(), bodyHex: "#9db3d6", aliases: "16plus 16+", priceAdjust: 300 },
  { brand: "apple", slug: "iphone-16", name: "iPhone 16", year: 2024, h: 147.6, w: 71.6, d: 7.8, r: 11.5, camera: iphonePill(), bodyHex: "#a6c9c0", aliases: "ip16 A3081 A3286" },
  { brand: "apple", slug: "iphone-15-pro-max", name: "iPhone 15 Pro Max", year: 2023, h: 159.9, w: 76.7, d: 8.25, r: 12, camera: iphoneProIsland(43), bodyHex: "#8e8a83", aliases: "15pm 15promax A2849 A3105 A3106", popular: true, priceAdjust: 300 },
  { brand: "apple", slug: "iphone-15-pro", name: "iPhone 15 Pro", year: 2023, h: 146.6, w: 70.6, d: 8.25, r: 11, camera: iphoneProIsland(40), bodyHex: "#3d4250", aliases: "15p 15pro A2848 A3101 A3102" },
  { brand: "apple", slug: "iphone-15-plus", name: "iPhone 15 Plus", year: 2023, h: 160.9, w: 77.8, d: 7.8, r: 12.5, camera: iphoneDiagonal(), bodyHex: "#e8d8dc", aliases: "15plus 15+", priceAdjust: 300 },
  { brand: "apple", slug: "iphone-15", name: "iPhone 15", year: 2023, h: 147.6, w: 71.6, d: 7.8, r: 11.5, camera: iphoneDiagonal(), bodyHex: "#dfe6dc", aliases: "ip15 A2846 A3089 A3090" },
  { brand: "apple", slug: "iphone-14-pro-max", name: "iPhone 14 Pro Max", year: 2022, h: 160.7, w: 77.6, d: 7.85, r: 12, camera: iphoneProIsland(43), bodyHex: "#4b4453", aliases: "14pm 14promax", priceAdjust: 300 },
  { brand: "apple", slug: "iphone-14-pro", name: "iPhone 14 Pro", year: 2022, h: 147.5, w: 71.5, d: 7.85, r: 11, camera: iphoneProIsland(40), bodyHex: "#4b4453", aliases: "14p 14pro" },
  { brand: "apple", slug: "iphone-14", name: "iPhone 14", year: 2022, h: 146.7, w: 71.5, d: 7.8, r: 11, camera: iphoneDiagonal(), bodyHex: "#a9bfd6", aliases: "ip14" },
  { brand: "apple", slug: "iphone-13", name: "iPhone 13", year: 2021, h: 146.7, w: 71.5, d: 7.65, r: 11, camera: iphoneDiagonal(), bodyHex: "#f2d7da", aliases: "ip13" },

  /* ── Samsung ── */
  { brand: "samsung", slug: "galaxy-s26-ultra", name: "Galaxy S26 Ultra", year: 2026, h: 163.6, w: 78.1, d: 7.9, r: 9, camera: galaxyUltra(), bodyHex: "#2c2e33", aliases: "s26u s26ultra", popular: true, priceAdjust: 300 },
  { brand: "samsung", slug: "galaxy-s26-plus", name: "Galaxy S26+", year: 2026, h: 158.4, w: 75.8, d: 7.3, r: 10, camera: galaxyBase(), bodyHex: "#cdd6e4", aliases: "s26plus s26+", priceAdjust: 300 },
  { brand: "samsung", slug: "galaxy-s26", name: "Galaxy S26", year: 2026, h: 149.6, w: 71.7, d: 7.2, r: 9.5, camera: galaxyBase(), bodyHex: "#cdd6e4", aliases: "s26", popular: true },
  { brand: "samsung", slug: "galaxy-s25-ultra", name: "Galaxy S25 Ultra", year: 2025, h: 162.8, w: 77.6, d: 8.2, r: 9, camera: galaxyUltra(), bodyHex: "#5a5f66", aliases: "s25u s25ultra SM-S938B SM-S938U SM-S938", popular: true, priceAdjust: 300 },
  { brand: "samsung", slug: "galaxy-s25-plus", name: "Galaxy S25+", year: 2025, h: 158.4, w: 75.8, d: 7.3, r: 10, camera: galaxyBase(), bodyHex: "#b9c3cf", aliases: "s25plus s25+ SM-S936B SM-S936", priceAdjust: 300 },
  { brand: "samsung", slug: "galaxy-s25", name: "Galaxy S25", year: 2025, h: 146.9, w: 70.5, d: 7.2, r: 9.5, camera: galaxyBase(), bodyHex: "#a7c2d9", aliases: "s25 SM-S931B SM-S931" },
  { brand: "samsung", slug: "galaxy-s24-ultra", name: "Galaxy S24 Ultra", year: 2024, h: 162.3, w: 79.0, d: 8.6, r: 3.5, camera: galaxyUltra(), bodyHex: "#4a4b4f", aliases: "s24u s24ultra SM-S928B SM-S928U SM-S928", priceAdjust: 300 },
  { brand: "samsung", slug: "galaxy-s24-plus", name: "Galaxy S24+", year: 2024, h: 158.5, w: 75.9, d: 7.7, r: 10, camera: galaxyBase(), bodyHex: "#c9b8d9", aliases: "s24plus s24+ SM-S926B SM-S926", priceAdjust: 300 },
  { brand: "samsung", slug: "galaxy-s24", name: "Galaxy S24", year: 2024, h: 147.0, w: 70.6, d: 7.6, r: 9.5, camera: galaxyBase(), bodyHex: "#e8d38f", aliases: "s24 SM-S921B SM-S921" },

  /* ── Google ── */
  { brand: "google", slug: "pixel-10-pro-xl", name: "Pixel 10 Pro XL", year: 2025, h: 162.8, w: 76.6, d: 8.5, r: 11, camera: pixelVisor(76.6), bodyHex: "#5b6b62", aliases: "p10proxl 10proxl", priceAdjust: 300 },
  { brand: "google", slug: "pixel-10-pro", name: "Pixel 10 Pro", year: 2025, h: 152.8, w: 72.0, d: 8.6, r: 10.5, camera: pixelVisor(72.0), bodyHex: "#d8d6cf", aliases: "p10pro 10pro" },
  { brand: "google", slug: "pixel-10", name: "Pixel 10", year: 2025, h: 152.8, w: 72.0, d: 8.6, r: 10.5, camera: pixelVisor(72.0), bodyHex: "#7a8fc9", aliases: "p10" },
  { brand: "google", slug: "pixel-9-pro-xl", name: "Pixel 9 Pro XL", year: 2024, h: 162.8, w: 76.6, d: 8.5, r: 11, camera: pixelVisor(76.6), bodyHex: "#e6d8cf", aliases: "p9proxl 9proxl", priceAdjust: 300 },
  { brand: "google", slug: "pixel-9-pro", name: "Pixel 9 Pro", year: 2024, h: 152.8, w: 72.0, d: 8.5, r: 10.5, camera: pixelVisor(72.0), bodyHex: "#3a3b3d", aliases: "p9pro 9pro" },

  /* ── Xiaomi ── */
  { brand: "xiaomi", slug: "xiaomi-17-ultra", name: "Xiaomi 17 Ultra", year: 2026, h: 162.9, w: 77.6, d: 8.3, r: 10, camera: roundCentre(77.6, 58, 7, 3.0, "#1b1c1f"), bodyHex: "#1e1f22", aliases: "mi17ultra 17ultra 17u xiaomi17u", popular: true, priceAdjust: 300 },
  { brand: "xiaomi", slug: "xiaomi-17-pro-max", name: "Xiaomi 17 Pro Max", year: 2025, h: 162.9, w: 77.6, d: 8.0, r: 10, camera: wideTop(77.6), bodyHex: "#2b2e33", aliases: "mi17promax 17promax 17pm", priceAdjust: 300 },
  { brand: "xiaomi", slug: "xiaomi-17", name: "Xiaomi 17", year: 2025, h: 151.1, w: 71.8, d: 8.06, r: 10, camera: squareTL(36, 10), bodyHex: "#cfd8dc", aliases: "mi17 xiaomi17" },
  { brand: "xiaomi", slug: "xiaomi-15-ultra", name: "Xiaomi 15 Ultra", year: 2025, h: 161.3, w: 75.3, d: 9.35, r: 10, camera: roundCentre(75.3, 58, 6, 3.0, "#2a2a2c"), bodyHex: "#d8d4cc", aliases: "mi15ultra 15ultra 15u", popular: true, priceAdjust: 300 },
  { brand: "xiaomi", slug: "xiaomi-15t-pro", name: "Xiaomi 15T Pro", year: 2025, h: 162.7, w: 77.9, d: 8.0, r: 10, camera: squareTL(40, 10), bodyHex: "#2e3035", aliases: "mi15tpro 15tpro", priceAdjust: 300 },
  { brand: "xiaomi", slug: "xiaomi-15", name: "Xiaomi 15", year: 2024, h: 152.3, w: 71.2, d: 8.08, r: 10, camera: squareTL(36, 10), bodyHex: "#2a2c30", aliases: "mi15 xiaomi15" },

  /* ── OnePlus ── */
  { brand: "oneplus", slug: "oneplus-15", name: "OnePlus 15", year: 2025, h: 161.4, w: 76.7, d: 8.1, r: 10, camera: squareTL(40, 11), bodyHex: "#8a7f6e", aliases: "op15 1+15 oneplus15", popular: true, priceAdjust: 300 },
  { brand: "oneplus", slug: "oneplus-15r", name: "OnePlus 15R", year: 2025, h: 163.4, w: 77.0, d: 8.1, r: 10, camera: squareTL(38, 10), bodyHex: "#2d2f33", aliases: "op15r 1+15r oneplus15r", priceAdjust: 300 },
  { brand: "oneplus", slug: "oneplus-13", name: "OnePlus 13", year: 2024, h: 162.9, w: 76.5, d: 8.5, r: 11, camera: roundCorner(40), bodyHex: "#3a5568", aliases: "op13 1+13 oneplus13", popular: true, priceAdjust: 300 },
  { brand: "oneplus", slug: "oneplus-13r", name: "OnePlus 13R", year: 2025, h: 161.7, w: 75.8, d: 8.0, r: 10.5, camera: roundCorner(37), bodyHex: "#2a2d33", aliases: "op13r 1+13r oneplus13r", priceAdjust: 300 },

  /* ── vivo ── */
  { brand: "vivo", slug: "vivo-x300-ultra", name: "vivo X300 Ultra", year: 2026, h: 163.1, w: 76.8, d: 8.7, r: 11, camera: roundCentre(76.8, 60, 6, 3.0, "#1c1d20"), bodyHex: "#2a2b2e", aliases: "x300ultra x300u vivox300ultra", priceAdjust: 300 },
  { brand: "vivo", slug: "vivo-x300-pro", name: "vivo X300 Pro", year: 2025, h: 161.2, w: 75.5, d: 8.0, r: 11, camera: roundCentre(75.5, 54), bodyHex: "#2b2d31", aliases: "x300pro vivox300pro", popular: true, priceAdjust: 300 },
  { brand: "vivo", slug: "vivo-x300", name: "vivo X300", year: 2025, h: 150.6, w: 71.9, d: 8.0, r: 10, camera: roundCentre(71.9, 46), bodyHex: "#d9c9d6", aliases: "x300 vivox300" },
  { brand: "vivo", slug: "vivo-x200-pro", name: "vivo X200 Pro", year: 2024, h: 162.4, w: 75.95, d: 8.5, r: 11, camera: roundCentre(75.95, 55), bodyHex: "#8d8e8a", aliases: "x200pro vivox200pro", priceAdjust: 300 },

  /* ── OPPO ── */
  { brand: "oppo", slug: "oppo-find-x9-ultra", name: "OPPO Find X9 Ultra", year: 2026, h: 163.2, w: 77.0, d: 8.7, r: 10, camera: roundCentre(77.0, 58, 6, 3.0, "#24211f"), bodyHex: "#5c4636", aliases: "findx9ultra x9ultra x9u", priceAdjust: 300 },
  { brand: "oppo", slug: "oppo-find-x9-pro", name: "OPPO Find X9 Pro", year: 2025, h: 161.3, w: 76.5, d: 8.3, r: 10, camera: squareTL(42, 12), bodyHex: "#c9c9c4", aliases: "findx9pro x9pro", popular: true, priceAdjust: 300 },
  { brand: "oppo", slug: "oppo-find-x9", name: "OPPO Find X9", year: 2025, h: 157.0, w: 73.9, d: 8.0, r: 10, camera: squareTL(38, 11), bodyHex: "#3b3d42", aliases: "findx9 x9" },
  { brand: "oppo", slug: "oppo-find-x8-pro", name: "OPPO Find X8 Pro", year: 2024, h: 162.3, w: 76.7, d: 8.24, r: 11, camera: roundCentre(76.7, 54), bodyHex: "#e9e6e1", aliases: "findx8pro x8pro", priceAdjust: 300 },

  /* ── iQOO ── */
  { brand: "iqoo", slug: "iqoo-15", name: "iQOO 15", year: 2025, h: 163.7, w: 76.8, d: 8.1, r: 10, camera: squareTL(42, 12), bodyHex: "#d6d2c8", aliases: "iqoo15", popular: true, priceAdjust: 300 },
  { brand: "iqoo", slug: "iqoo-13", name: "iQOO 13", year: 2024, h: 163.4, w: 76.7, d: 8.0, r: 10, camera: squareTL(40, 12), bodyHex: "#3a3c40", aliases: "iqoo13", priceAdjust: 300 },

  /* ── Motorola ── */
  { brand: "motorola", slug: "motorola-signature", name: "Motorola Signature", year: 2026, h: 162.1, w: 76.4, d: 7.0, r: 10, camera: squareTL(40, 10), bodyHex: "#4a4e45", aliases: "motosignature signature", popular: true, priceAdjust: 300 },
  { brand: "motorola", slug: "motorola-edge-70-pro", name: "Motorola Edge 70 Pro", year: 2026, h: 162.7, w: 75.6, d: 7.2, r: 10, camera: squareTL(38, 10), bodyHex: "#3c4a5c", aliases: "edge70pro moto70pro", priceAdjust: 300 },
  { brand: "motorola", slug: "motorola-edge-70", name: "Motorola Edge 70", year: 2025, h: 159.9, w: 74.0, d: 6.0, r: 10, camera: squareTL(36, 10), bodyHex: "#7d8a6a", aliases: "edge70 moto70" },
  { brand: "motorola", slug: "motorola-edge-60-pro", name: "Motorola Edge 60 Pro", year: 2025, h: 160.7, w: 73.1, d: 8.2, r: 10, camera: squareTL(38, 9), bodyHex: "#2f4b6e", aliases: "edge60pro moto60pro" },
  { brand: "motorola", slug: "motorola-edge-50-ultra", name: "Motorola Edge 50 Ultra", year: 2024, h: 161.1, w: 72.4, d: 8.6, r: 10, camera: squareTL(38, 9), bodyHex: "#7b5a43", aliases: "edge50ultra moto50ultra" },
];

export const brandSeeds = [
  { slug: "apple", name: "iPhone", sort: 1 },
  { slug: "samsung", name: "Samsung", sort: 2 },
  { slug: "google", name: "Google Pixel", sort: 3 },
  { slug: "xiaomi", name: "Xiaomi", sort: 4 },
  { slug: "oneplus", name: "OnePlus", sort: 5 },
  { slug: "vivo", name: "vivo", sort: 6 },
  { slug: "oppo", name: "OPPO", sort: 7 },
  { slug: "iqoo", name: "iQOO", sort: 8 },
  { slug: "motorola", name: "Motorola", sort: 9 },
];
