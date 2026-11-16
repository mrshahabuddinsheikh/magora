"use client";
import { usePathname } from "next/navigation";

/** Hides the store footer on the admin panel and the rider page. */
export function FooterGate({ children }: { children: React.ReactNode }) {
  const p = usePathname();
  if (p.startsWith("/admin") || p.startsWith("/rider")) return null;
  return <>{children}</>;
}
