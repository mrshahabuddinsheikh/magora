"use client";

import { Search } from "lucide-react";
import { cn } from "@/lib/format";

export const ORDER_STATUSES = ["pending", "confirmed", "processing", "shipped", "out_for_delivery", "delivered", "cancelled", "returned"];

export const statusColor: Record<string, string> = {
  pending: "bg-[#fff4e0] text-[#a15c00]",
  confirmed: "bg-[#eef1ff] text-accent",
  processing: "bg-[#f3e8ff] text-[#7c3aed]",
  shipped: "bg-[#e0f2fe] text-[#0369a1]",
  out_for_delivery: "bg-[#fef3c7] text-[#92400e]",
  delivered: "bg-[#e9f8ef] text-success",
  cancelled: "bg-[#fde8e8] text-danger",
  returned: "bg-[#f1f2f6] text-muted",
  requested: "bg-[#fff4e0] text-[#a15c00]",
  approved: "bg-[#eef1ff] text-accent",
  rejected: "bg-[#fde8e8] text-danger",
  pickup_scheduled: "bg-[#f3e8ff] text-[#7c3aed]",
  received: "bg-[#e0f2fe] text-[#0369a1]",
  refunded: "bg-[#e9f8ef] text-success",
  exchanged: "bg-[#e9f8ef] text-success",
  closed: "bg-[#f1f2f6] text-muted",
};

export function Pill({ s, label }: { s: string; label?: string }) {
  return <span className={cn("whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold capitalize", statusColor[s] ?? "bg-black/5")}>{label ?? s.replace(/_/g, " ")}</span>;
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="flex h-10 min-w-[200px] flex-1 items-center gap-2 rounded-full bg-black/[0.04] px-3">
      <Search size={15} className="text-muted" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="flex-1 bg-transparent text-sm outline-none" />
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="py-10 text-center text-sm text-muted">{children}</div>;
}

export function InlineNum({ value, onSave, width = "w-20" }: { value: number; onSave: (v: number) => void; width?: string }) {
  return (
    <input
      key={value}
      defaultValue={value}
      inputMode="numeric"
      onBlur={(e) => {
        const n = Number(e.target.value);
        if (Number.isFinite(n) && n !== value) onSave(n);
      }}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      className={cn("h-8 rounded-lg bg-black/[0.04] px-2 tabular-nums", width)}
    />
  );
}
