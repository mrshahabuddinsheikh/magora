import type { CategorySlug, GadgetCategory, Material } from "./types";

export interface Style { id: Material; name: string; hint: string; color: string; accent?: string; /** gadgets: sub-category slug */ cat?: GadgetCategory }
export interface CategoryDef {
  slug: CategorySlug;
  name: string;
  short: string;
  noun: string; // "cases" / "skins" / "protectors" / "gadgets"
  tagline: string;
  /** home page of this section — the whole site re-themes around it */
  home: string;
  /** true when products are made for a specific phone model */
  phoneBased: boolean;
  /** label for the style list ("Materials", "Designs", "Types") */
  stylesLabel: string;
  /** messages for the black announcement strip */
  strip: string[];
  styles: Style[];
}

const COMMON_STRIP = ["💵 Cash on Delivery all over Pakistan", "🚚 Free delivery on orders over Rs.3,000"];

/** Everything the storefront needs to know about each section. */
export const CATEGORIES: CategoryDef[] = [
  {
    slug: "magsafe-cases",
    name: "MagSafe Cases",
    short: "Cases",
    noun: "cases",
    tagline: "Magnetic cases that snap onto every MagSafe & Qi2 accessory",
    home: "/",
    phoneBased: true,
    stylesLabel: "Materials",
    strip: [...COMMON_STRIP, "🧲 Strong N52 MagSafe magnets", "↩️ 7-day easy returns"],
    styles: [
      { id: "clear", name: "Crystal Clear", hint: "Show your phone’s colour", color: "#f4f7fb" },
      { id: "frosted", name: "Frosted Matte", hint: "Soft-touch, no smudges", color: "#c7b8e8" },
      { id: "silicone", name: "Liquid Silicone", hint: "Silky grip", color: "#f08a3c" },
      { id: "leather", name: "Vegan Leather", hint: "Classic & premium", color: "#8a5a3b", accent: "#c9a46c" },
      { id: "carbon", name: "Aramid Carbon", hint: "0.8 mm featherlight", color: "#2a2b2e" },
    ],
  },
  {
    slug: "skins",
    name: "Skins",
    short: "Skins",
    noun: "skins",
    tagline: "Laser-cut vinyl for the back & sides — or print your own photo",
    home: "/skins",
    phoneBased: true,
    stylesLabel: "Designs",
    strip: [...COMMON_STRIP, "📷 Print your own photo on a skin", "✂️ Laser-cut for your exact phone"],
    styles: [
      { id: "skin-custom", name: "Your Photo", hint: "Upload & preview in 3D", color: "#f5d0fe" },
      { id: "skin-solid", name: "Matte Colours", hint: "Soft-touch, no prints", color: "#1d1e21" },
      { id: "skin-carbon", name: "Carbon Fiber", hint: "3D textured grip", color: "#2a2b2e" },
      { id: "skin-marble", name: "Marble", hint: "Glossy stone look", color: "#eef0f2", accent: "#9aa1ab" },
      { id: "skin-wood", name: "Wood Grain", hint: "Warm natural texture", color: "#6b4426" },
      { id: "skin-metal", name: "Brushed Metal", hint: "Aluminium sheen", color: "#9ea3a8" },
    ],
  },
  {
    slug: "screen-protectors",
    name: "Screen Protectors",
    short: "Protectors",
    noun: "protectors",
    tagline: "9H tempered glass, privacy & matte — plus camera lens guards",
    home: "/screen-protectors",
    phoneBased: true,
    stylesLabel: "Types",
    strip: [...COMMON_STRIP, "🛡️ 9H tempered glass", "🎯 Alignment frame in every box"],
    styles: [
      { id: "glass-clear", name: "Tempered Glass", hint: "Crystal clear 9H", color: "#e8f1fb" },
      { id: "glass-privacy", name: "Privacy Glass", hint: "Dark from the sides", color: "#2b2f36" },
      { id: "glass-matte", name: "Matte Anti-Glare", hint: "No glare, smooth glide", color: "#f2f4f7" },
      { id: "lens", name: "Camera Lens", hint: "Guards every lens", color: "#1c1c1e" },
    ],
  },
  {
    slug: "gadgets",
    name: "Gadgets",
    short: "Gadgets",
    noun: "gadgets",
    tagline: "Chargers, cables, earbuds, smart watches & power banks",
    home: "/gadgets",
    phoneBased: false,
    stylesLabel: "Shop by type",
    strip: [...COMMON_STRIP, "🔌 Fast-charging PD & GaN", "🛠️ 6-month replacement warranty"],
    styles: [
      { id: "gadget-earbuds", cat: "earbuds", name: "Earbuds", hint: "ANC & all-day battery", color: "#f4f5f7" },
      { id: "gadget-watch", cat: "smart-watches", name: "Smart Watches", hint: "AMOLED · BT calling", color: "#1f2126", accent: "#2b2e35" },
      { id: "gadget-powerbank", cat: "power-banks", name: "Power Banks", hint: "Magnetic & 20,000 mAh", color: "#c9bde8" },
      { id: "gadget-charger", cat: "chargers", name: "Chargers", hint: "20W–65W fast", color: "#f2f3f5" },
      { id: "gadget-cable", cat: "cables", name: "Charging Cables", hint: "Braided USB-C & Lightning", color: "#1f2023", accent: "#8b8f96" },
      { id: "gadget-handsfree", cat: "handsfree", name: "Handsfree", hint: "Wired with mic", color: "#f4f5f7" },
    ],
  },
];

export const DEFAULT_CATEGORY: CategorySlug = "magsafe-cases";
export const SECTION_SLUGS = CATEGORIES.map((c) => c.slug);

/** section for a section slug OR a gadget sub-category ("earbuds" → gadgets) */
export const categoryOf = (slug?: string | null) =>
  CATEGORIES.find((c) => c.slug === slug) ?? CATEGORIES.find((c) => c.styles.some((s) => s.cat && s.cat === slug)) ?? CATEGORIES[0];

export const categoryOfMaterial = (m: string) =>
  m.startsWith("skin-") ? CATEGORIES[1]
  : m.startsWith("glass-") || m === "lens" ? CATEGORIES[2]
  : m.startsWith("gadget-") ? CATEGORIES[3]
  : CATEGORIES[0];

/** gadget sub-category info ("earbuds" → Style) */
export const gadgetType = (cat?: string | null) => CATEGORIES[3].styles.find((s) => s.cat === cat);

/** section from a pathname — homes only; other pages fall back to the remembered section */
export function sectionFromPath(pathname: string): CategorySlug | null {
  if (pathname === "/") return "magsafe-cases";
  const hit = CATEGORIES.find((c) => c.home !== "/" && (pathname === c.home || pathname.startsWith(`${c.home}/`)));
  return hit?.slug ?? null;
}
