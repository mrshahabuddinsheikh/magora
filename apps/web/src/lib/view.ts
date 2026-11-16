import type { Color, ProductView } from "./types";

/** A product's view settings with defaults filled in. */
export function viewOf(v?: ProductView | null) {
  return {
    mode: v?.mode ?? "auto",
    first: v?.first ?? "3d",
    designUrl: v?.designUrl || null,
    designFit: v?.designFit ?? "cover",
    modelUrl: v?.modelUrl || null,
    modelBytes: v?.modelBytes ?? 0,
  } as const;
}

/** The print design for an option: its own design, else the product's. Only in "design" mode. */
export function designFor(v: ReturnType<typeof viewOf>, color?: Pick<Color, "designUrl"> | null) {
  if (v.mode !== "design") return null;
  const url = color?.designUrl || v.designUrl;
  return url ? { url, fit: v.designFit } : null;
}

/** Product cards show a real photo when the product leads with photos. */
export function cardPhoto(images: string[] | undefined, v: ReturnType<typeof viewOf>) {
  if (!images?.length) return null;
  return v.mode === "photos" || v.first === "photos" ? images[0] : null;
}
