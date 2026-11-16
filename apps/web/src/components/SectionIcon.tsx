import { Headphones, Layers, ShieldCheck, Smartphone } from "lucide-react";
import type { CategorySlug } from "@/lib/types";

export function SectionIcon({ slug, size = 17, className }: { slug: CategorySlug; size?: number; className?: string }) {
  const I = slug === "skins" ? Layers : slug === "screen-protectors" ? ShieldCheck : slug === "gadgets" ? Headphones : Smartphone;
  return <I size={size} className={className} />;
}
