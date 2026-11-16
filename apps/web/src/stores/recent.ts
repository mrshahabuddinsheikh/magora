"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/** Products the customer looked at on this device (newest first, max 12) + their city for delivery times */
export const useRecent = create<{
  slugs: string[];
  city: string | null;
  seen: (slug: string) => void;
  setCity: (c: string) => void;
}>()(
  persist(
    (set) => ({
      slugs: [],
      city: null,
      seen: (slug) => set((s) => ({ slugs: [slug, ...s.slugs.filter((x) => x !== slug)].slice(0, 12) })),
      setCity: (city) => set({ city }),
    }),
    {
      name: "mg-recent",
      skipHydration: true,
      storage: createJSONStorage(() => {
        try { return localStorage; } catch { return { getItem: () => null, setItem: () => {}, removeItem: () => {} }; }
      }),
    },
  ),
);
