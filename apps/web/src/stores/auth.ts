"use client";
import { create } from "zustand";
import { api, tokenStore } from "@/lib/client-api";
import type { User } from "@/lib/types";

interface AuthState {
  user: User | null;
  ready: boolean;
  init: () => Promise<void>;
  login: (email: string, password: string) => Promise<User>;
  register: (b: { name: string; email: string; phone?: string; password: string }) => Promise<User>;
  logout: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  ready: false,
  async init() {
    if (!tokenStore.get()) return set({ ready: true });
    try {
      const r = await api<{ data: User }>("/me");
      set({ user: r.data, ready: true });
    } catch {
      tokenStore.set(null);
      set({ user: null, ready: true });
    }
  },
  async login(email, password) {
    const r = await api<{ data: { token: string; user: User } }>("/auth/login", { method: "POST", json: { email, password }, auth: false });
    tokenStore.set(r.data.token);
    set({ user: r.data.user });
    return r.data.user;
  },
  async register(b) {
    const r = await api<{ data: { token: string; user: User } }>("/auth/register", { method: "POST", json: b, auth: false });
    tokenStore.set(r.data.token);
    set({ user: r.data.user });
    return r.data.user;
  },
  logout() {
    tokenStore.set(null);
    set({ user: null });
  },
}));
