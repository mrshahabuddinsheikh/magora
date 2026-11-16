"use client";
import { create } from "zustand";
import { track } from "@/lib/track";
import { api } from "@/lib/client-api";
import type { Cart, ItemCustom } from "@/lib/types";

const CART_KEY = "mg-cart-id";
const readId = () => { try { return localStorage.getItem(CART_KEY); } catch { return null; } };
const writeId = (id: string | null) => {
  try {
    if (id) {
      localStorage.setItem(CART_KEY, id);
    } else {
      localStorage.removeItem(CART_KEY);
    }
  } catch {}
};

interface CartState {
  cart: Cart | null;
  open: boolean;
  busy: boolean;
  error: string | null;
  lastAdded: { name: string; model: string; color: string; hex: string } | null;
  load: () => Promise<void>;
  ensure: () => Promise<string>;
  add: (variantId: number, qty: number, info?: CartState["lastAdded"], custom?: ItemCustom) => Promise<boolean>;
  setQty: (itemId: number, qty: number) => Promise<void>;
  remove: (itemId: number) => Promise<void>;
  applyCoupon: (code: string) => Promise<string | null>;
  removeCoupon: () => Promise<void>;
  setOpen: (o: boolean) => void;
  reset: () => void;
}

export const useCart = create<CartState>((set, get) => ({
  cart: null,
  open: false,
  busy: false,
  error: null,
  lastAdded: null,

  async load() {
    const id = readId();
    if (!id) return;
    try {
      const r = await api<{ data: Cart }>(`/carts/${id}`, { auth: false });
      set({ cart: r.data });
    } catch {
      writeId(null);
    }
  },

  async ensure() {
    const existing = get().cart?.id ?? readId();
    if (existing) return existing;
    const r = await api<{ data: Cart }>("/carts", { method: "POST" });
    writeId(r.data.id);
    set({ cart: r.data });
    return r.data.id;
  },

  async add(variantId, qty, info, custom) {
    set({ busy: true, error: null });
    try {
      let id = await get().ensure();
      let r;
      try {
        r = await api<{ data: Cart }>(`/carts/${id}/items`, { method: "POST", json: { variantId, qty, custom } });
      } catch (e) {
        // cart expired on the server → start a fresh one
        if ((e as { status?: number }).status === 404) {
          writeId(null); set({ cart: null });
          id = await get().ensure();
          r = await api<{ data: Cart }>(`/carts/${id}/items`, { method: "POST", json: { variantId, qty, custom } });
        } else throw e;
      }
      set({ cart: r.data, open: true, lastAdded: info ?? null });
      const line = r.data.items.find((i) => i.variantId === variantId);
      if (line) track("add_to_cart", { value: line.unitPrice * qty, items: [{ id: line.product.slug, name: line.product.name, price: line.unitPrice, qty }] });
      return true;
    } catch (e) {
      set({ error: (e as Error).message });
      return false;
    } finally {
      set({ busy: false });
    }
  },

  async setQty(itemId, qty) {
    const c = get().cart;
    if (!c) return;
    // optimistic update for an instant feel
    set({ cart: { ...c, items: c.items.map((i) => (i.id === itemId ? { ...i, qty, lineTotal: i.unitPrice * qty } : i)).filter((i) => i.qty > 0) } });
    const r = await api<{ data: Cart }>(`/carts/${c.id}/items/${itemId}`, { method: "PATCH", json: { qty } });
    set({ cart: r.data });
  },

  async remove(itemId) {
    const c = get().cart;
    if (!c) return;
    set({ cart: { ...c, items: c.items.filter((i) => i.id !== itemId) } });
    const r = await api<{ data: Cart }>(`/carts/${c.id}/items/${itemId}`, { method: "DELETE" });
    set({ cart: r.data });
  },

  async applyCoupon(code) {
    const c = get().cart;
    if (!c) return "Cart is empty";
    try {
      const r = await api<{ data: Cart }>(`/carts/${c.id}/coupon`, { method: "POST", json: { code } });
      set({ cart: r.data });
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  },

  async removeCoupon() {
    const c = get().cart;
    if (!c) return;
    const r = await api<{ data: Cart }>(`/carts/${c.id}/coupon`, { method: "DELETE" });
    set({ cart: r.data });
  },

  setOpen: (open) => set({ open }),
  reset: () => { set({ cart: null }); },
}));
