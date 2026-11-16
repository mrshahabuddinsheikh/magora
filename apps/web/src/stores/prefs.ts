"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface SavedPhone { slug: string; name: string; brand: string }

/** Remembers the customer's phone so every product opens on it. */
export const usePrefs = create<{
  phone: SavedPhone | null;
  setPhone: (p: SavedPhone | null) => void;
}>()(
  persist((set) => ({ phone: null, setPhone: (phone) => set({ phone }) }), {
    name: "mg-prefs",
    skipHydration: true, // rehydrated in <Header> after mount → no SSR mismatch
    storage: createJSONStorage(() => {
      try { return localStorage; } catch { return { getItem: () => null, setItem: () => {}, removeItem: () => {} }; }
    }),
  }),
);
