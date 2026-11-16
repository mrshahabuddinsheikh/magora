"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { usePathname } from "next/navigation";
import type { CategorySlug } from "@/lib/types";
import { categoryOf, sectionFromPath, type CategoryDef } from "@/lib/categories";

/**
 * The storefront section the customer is in (cases / skins / protectors /
 * gadgets). Header, menus, footer and search all follow it, so each section
 * feels like its own shop. Remembered across cart / checkout / account pages.
 */
export const useSection = create<{ section: CategorySlug; setSection: (s: CategorySlug) => void }>()(
  persist((set) => ({ section: "magsafe-cases", setSection: (section) => set({ section }) }), {
    name: "mg-section",
    skipHydration: true,
    storage: createJSONStorage(() => {
      try {
        return sessionStorage;
      } catch {
        return { getItem: () => null, setItem: () => {}, removeItem: () => {} };
      }
    }),
  }),
);

/** The current section: from the URL for section homes, otherwise the one the customer is shopping in. */
export function useCurrentSection(): CategoryDef {
  const pathname = usePathname();
  const stored = useSection((s) => s.section);
  return categoryOf(sectionFromPath(pathname) ?? stored);
}

export interface EmptyBagConfig {
  subtitle: string;
  buttonText: string;
  href: string;
}

export const EMPTY_BAG_BY_SECTION: Record<CategorySlug, EmptyBagConfig> = {
  "magsafe-cases": {
    subtitle: "Pick your phone and find a case that snaps.",
    buttonText: "Shop cases",
    href: "/shop?category=magsafe-cases",
  },
  skins: {
    subtitle: "Pick your phone and find a precision-cut skin.",
    buttonText: "Shop skins",
    href: "/shop?category=skins",
  },
  "screen-protectors": {
    subtitle: "Pick your phone and get edge-to-edge protection.",
    buttonText: "Shop protectors",
    href: "/shop?category=screen-protectors",
  },
  gadgets: {
    subtitle: "Browse chargers, cables, earbuds, smart watches & power banks.",
    buttonText: "Shop gadgets",
    href: "/gadgets",
  },
};

export function getEmptyBagConfig(slug: CategorySlug): EmptyBagConfig {
  return EMPTY_BAG_BY_SECTION[slug] ?? EMPTY_BAG_BY_SECTION["magsafe-cases"];
}
