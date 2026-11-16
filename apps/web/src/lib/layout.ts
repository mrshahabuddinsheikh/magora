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
