import type { CameraSpec, CamLayout } from "./types";

/** Camera layout family used by the SVG thumbnails (mirrors the API's layoutOf). */
export function layoutOf(cam: CameraSpec, widthMm: number): CamLayout {
  if (cam.type === "plateau" && cam.w && cam.r && cam.r >= cam.w / 2 - 0.5) {
    const cx = (cam.x ?? 0) + cam.w / 2;
    return Math.abs(cx - widthMm / 2) < 6 ? "circle" : "circle-left";
  }
  // Pixel-style pill "visor" across the back
  if (cam.type === "bar" && cam.h && cam.r && cam.r >= cam.h / 2 - 0.5) return "visor";
  return cam.type;
}

export type ResolvedCameraStyle =
  | "iphone-air"
  | "iphone-pill"
  | "iphone-diagonal"
  | "iphone-pro-bar"
  | "iphone-pro"
  | "galaxy-ultra"
  | "galaxy-base"
  | "pixel-visor"
  | "circle"
  | "circle-left"
  | "squircle";

/**
 * Resolves a model slug or camera layout into a hyper-realistic camera silhouette style
 * for SVG thumbnails (CaseThumb, SkinThumb, ProductCard).
 */
export function resolveCameraStyle(
  slug?: string | null,
  layout?: CamLayout,
  cam?: CameraSpec
): ResolvedCameraStyle {
  if (cam) {
    if (cam.type === "bar") {
      if (cam.lenses && cam.lenses.length <= 2 && cam.h && cam.h < 32) return "iphone-air";
      if (cam.r && cam.h && cam.r >= cam.h / 2 - 0.5) return "pixel-visor";
      return "iphone-pro-bar";
    }
    if (cam.type === "floating") {
      if (cam.lenses && cam.lenses.length > 4) return "galaxy-ultra";
      return "galaxy-base";
    }
    if (cam.type === "plateau") {
      if (cam.w && cam.r && cam.r >= cam.w / 2 - 0.5) {
        return Math.abs((cam.x ?? 0) + cam.w / 2 - 38) < 6 ? "circle" : "circle-left";
      }
      if (cam.lenses && cam.lenses.length === 2) {
        if (cam.w && cam.h && cam.h > cam.w * 1.3) return "iphone-pill";
        return "iphone-diagonal";
      }
      if (cam.lenses && cam.lenses.length === 3 && cam.w && cam.h && cam.w < 30) {
        return "iphone-pill";
      }
    }
  }

  if (slug) {
    const s = slug.toLowerCase();
    // iPhone Air / Slim
    if (s.includes("air")) return "iphone-air";

    // iPhone 16 / 17 vertical 2-lens pill
    if (
      s === "iphone-16" ||
      s === "iphone-16-plus" ||
      s === "iphone-17" ||
      s === "iphone-17-plus" ||
      s === "iphone-16-base" ||
      s === "iphone-17-base"
    ) {
      return "iphone-pill";
    }

    // iPhone 17 Pro / 18 Pro horizontal pro bar
    if (s.includes("iphone-17-pro") || s.includes("iphone-18-pro")) {
      return "iphone-pro-bar";
    }

    // iPhone 13, 14, 15 diagonal dual lenses
    if (
      s === "iphone-15" ||
      s === "iphone-15-plus" ||
      s === "iphone-14" ||
      s === "iphone-14-plus" ||
      s === "iphone-13" ||
      s === "iphone-13-mini"
    ) {
      return "iphone-diagonal";
    }

    // iPhone Pro models (14 Pro, 15 Pro, 16 Pro)
    if (
      s.includes("iphone") &&
      (s.includes("pro") || s.includes("promax") || s.includes("pro-max"))
    ) {
      return "iphone-pro";
    }

    // Samsung Galaxy Ultra
    if (s.includes("ultra") && (s.includes("s2") || s.includes("galaxy"))) {
      return "galaxy-ultra";
    }

    // Samsung Galaxy Base / Plus
    if (
      s.includes("galaxy") ||
      s.includes("s26") ||
      s.includes("s25") ||
      s.includes("s24") ||
      s.includes("s23") ||
      s.includes("s22")
    ) {
      return "galaxy-base";
    }

    // Google Pixel
    if (s.includes("pixel")) {
      return "pixel-visor";
    }

    // OnePlus
    if (s.includes("oneplus") || s.includes("op1")) {
      return "circle-left";
    }

    // Vivo / Oppo Ultra / Xiaomi Ultra
    if (s.includes("vivo") || s.includes("find-x") || s.includes("ultra")) {
      return "circle";
    }

    // Squircle models (iQOO, Motorola, Xiaomi, etc.)
    if (
      s.includes("iqoo") ||
      s.includes("motorola") ||
      s.includes("moto") ||
      s.includes("xiaomi") ||
      s.includes("oppo")
    ) {
      return "squircle";
    }
  }

  // Fallbacks by layout
  if (layout === "visor") return "pixel-visor";
  if (layout === "floating") return "galaxy-ultra";
  if (layout === "circle") return "circle";
  if (layout === "circle-left") return "circle-left";
  if (layout === "bar") return "iphone-air";
  return "iphone-pro";
}
