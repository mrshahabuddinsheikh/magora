/**
 * Advanced Client-side Device & Phone Model Detection Engine
 * Combines User-Agent, Screen Geometry, Device Pixel Ratio, WebGL GPU Renderer,
 * and Client Hints (navigator.userAgentData) to identify real user devices.
 */

export interface DetectedDevice {
  isMobile: boolean;
  brand: string | null; // e.g. "apple", "samsung", "google", "xiaomi"
  modelName: string | null; // e.g. "iPhone 15 Pro Max"
  confidence: "high" | "medium" | "low";
  signal: string;
}

/** Synchronous, fast detection suitable for initial render hydration */
export function detectUserDevice(): DetectedDevice {
  if (typeof window === "undefined") {
    return { isMobile: false, brand: null, modelName: null, confidence: "low", signal: "ssr" };
  }

  const ua = navigator.userAgent || "";
  const isTouch = navigator.maxTouchPoints > 0;
  const isMobile = /iPhone|iPad|iPod|Android|Mobile/i.test(ua) || (isTouch && window.screen.width < 768);

  // If user is on a Desktop PC / Laptop, we must NOT fake a phone detection!
  if (!isMobile) {
    return {
      isMobile: false,
      brand: null,
      modelName: null,
      confidence: "high",
      signal: "desktop",
    };
  }

  // 1. Detect Apple iPhone
  if (/iPhone/i.test(ua)) {
    const w = Math.min(window.screen.width, window.screen.height);
    const h = Math.max(window.screen.width, window.screen.height);
    const dpr = Math.round(window.devicePixelRatio || 1);

    // Probe WebGL GPU renderer for Apple A-series chipset
    let gpu = "";
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      if (gl) {
        const ext = (gl as WebGLRenderingContext).getExtension("WEBGL_debug_renderer_info");
        if (ext) {
          gpu = ((gl as WebGLRenderingContext).getParameter(ext.UNMASKED_RENDERER_WEBGL) || "").toString();
        }
      }
    } catch {}

    const hasA18 = /A18/i.test(gpu);
    const hasA17 = /A17/i.test(gpu);
    const hasA16 = /A16/i.test(gpu);
    const hasA15 = /A15/i.test(gpu);

    let modelName = "iPhone 15 Pro Max";
    let confidence: "high" | "medium" | "low" = "medium";

    // Calibrated iOS Screen Dimension Matrix (in logical CSS points):
    if (w === 440 && h === 956) {
      modelName = "iPhone 16 Pro Max";
      confidence = "high";
    } else if (w === 402 && h === 874) {
      modelName = "iPhone 16 Pro";
      confidence = "high";
    } else if (w === 430 && h === 932) {
      if (hasA17) {
        modelName = "iPhone 15 Pro Max";
        confidence = "high";
      } else if (hasA16) {
        modelName = "iPhone 14 Pro Max";
        confidence = "high";
      } else {
        modelName = "iPhone 15 Pro Max"; // Most prevalent current flagship
      }
    } else if (w === 393 && h === 852) {
      if (hasA18) {
        modelName = "iPhone 16";
        confidence = "high";
      } else if (hasA17) {
        modelName = "iPhone 15 Pro";
        confidence = "high";
      } else if (hasA16) {
        modelName = "iPhone 15";
      } else {
        modelName = "iPhone 15 Pro";
      }
    } else if (w === 428 && h === 926) {
      if (hasA15) {
        modelName = "iPhone 13 Pro Max";
        confidence = "high";
      } else {
        modelName = "iPhone 14 Plus";
      }
    } else if (w === 390 && h === 844) {
      if (hasA15) {
        modelName = "iPhone 14";
      } else {
        modelName = "iPhone 13";
      }
    } else if (w === 414 && h === 896) {
      modelName = dpr >= 3 ? "iPhone 11 Pro Max" : "iPhone 11";
      confidence = "high";
    } else if (w === 375 && h === 812) {
      modelName = "iPhone 13 mini";
    } else if (w === 375 && h === 667) {
      modelName = "iPhone SE";
      confidence = "high";
    }

    return {
      isMobile: true,
      brand: "apple",
      modelName,
      confidence,
      signal: `iOS: ${w}x${h}@${dpr}x, GPU: ${gpu || "Standard"}`,
    };
  }

  // 2. Detect Android Devices from User-Agent
  if (/Android/i.test(ua)) {
    // Check Samsung Galaxy models
    if (/SM-S938/i.test(ua)) return { isMobile: true, brand: "samsung", modelName: "Galaxy S25 Ultra", confidence: "high", signal: ua };
    if (/SM-S928/i.test(ua)) return { isMobile: true, brand: "samsung", modelName: "Galaxy S24 Ultra", confidence: "high", signal: ua };
    if (/SM-S918/i.test(ua)) return { isMobile: true, brand: "samsung", modelName: "Galaxy S23 Ultra", confidence: "high", signal: ua };
    if (/SM-S908/i.test(ua)) return { isMobile: true, brand: "samsung", modelName: "Galaxy S22 Ultra", confidence: "high", signal: ua };
    if (/SM-S936/i.test(ua)) return { isMobile: true, brand: "samsung", modelName: "Galaxy S25+", confidence: "high", signal: ua };
    if (/SM-S926/i.test(ua)) return { isMobile: true, brand: "samsung", modelName: "Galaxy S24+", confidence: "high", signal: ua };
    if (/SM-S931/i.test(ua)) return { isMobile: true, brand: "samsung", modelName: "Galaxy S25", confidence: "high", signal: ua };
    if (/SM-S921/i.test(ua)) return { isMobile: true, brand: "samsung", modelName: "Galaxy S24", confidence: "high", signal: ua };
    if (/Samsung|SM-/i.test(ua)) return { isMobile: true, brand: "samsung", modelName: "Galaxy S24 Ultra", confidence: "medium", signal: ua };

    // Google Pixel
    if (/Pixel 9 Pro XL/i.test(ua)) return { isMobile: true, brand: "google", modelName: "Pixel 9 Pro XL", confidence: "high", signal: ua };
    if (/Pixel 9 Pro/i.test(ua)) return { isMobile: true, brand: "google", modelName: "Pixel 9 Pro", confidence: "high", signal: ua };
    if (/Pixel 9/i.test(ua)) return { isMobile: true, brand: "google", modelName: "Pixel 9", confidence: "high", signal: ua };
    if (/Pixel 8 Pro/i.test(ua)) return { isMobile: true, brand: "google", modelName: "Pixel 8 Pro", confidence: "high", signal: ua };
    if (/Pixel 8/i.test(ua)) return { isMobile: true, brand: "google", modelName: "Pixel 8", confidence: "high", signal: ua };
    if (/Pixel 7 Pro/i.test(ua)) return { isMobile: true, brand: "google", modelName: "Pixel 7 Pro", confidence: "high", signal: ua };
    if (/Pixel/i.test(ua)) return { isMobile: true, brand: "google", modelName: "Pixel 9 Pro XL", confidence: "medium", signal: ua };

    // Xiaomi / Redmi
    if (/24030PN60G|14 Ultra/i.test(ua)) return { isMobile: true, brand: "xiaomi", modelName: "Xiaomi 14 Ultra", confidence: "high", signal: ua };
    if (/23117RK66C|13 Ultra/i.test(ua)) return { isMobile: true, brand: "xiaomi", modelName: "Xiaomi 13 Ultra", confidence: "high", signal: ua };
    if (/Xiaomi|Redmi|POCO/i.test(ua)) return { isMobile: true, brand: "xiaomi", modelName: "Xiaomi 14 Ultra", confidence: "medium", signal: ua };

    // OnePlus
    if (/CPH2581|OnePlus 12/i.test(ua)) return { isMobile: true, brand: "oneplus", modelName: "OnePlus 12", confidence: "high", signal: ua };
    if (/CPH2449|OnePlus 11/i.test(ua)) return { isMobile: true, brand: "oneplus", modelName: "OnePlus 11", confidence: "high", signal: ua };
    if (/OnePlus/i.test(ua)) return { isMobile: true, brand: "oneplus", modelName: "OnePlus 12", confidence: "medium", signal: ua };

    // Vivo / iQOO
    if (/vivo|V23|V24/i.test(ua)) return { isMobile: true, brand: "vivo", modelName: "vivo X100", confidence: "medium", signal: ua };
    if (/iQOO/i.test(ua)) return { isMobile: true, brand: "iqoo", modelName: "iQOO 12", confidence: "medium", signal: ua };

    // OPPO
    if (/OPPO|CPH/i.test(ua)) return { isMobile: true, brand: "oppo", modelName: "OPPO Find X7", confidence: "medium", signal: ua };

    // Generic Android fallback
    return {
      isMobile: true,
      brand: "android",
      modelName: "Galaxy S24 Ultra",
      confidence: "low",
      signal: "Generic Android",
    };
  }

  return { isMobile: false, brand: null, modelName: null, confidence: "low", signal: "unknown" };
}

/** Async refinement using Navigator Client Hints (Chromium / Android) */
export async function refineWithClientHints(): Promise<string | null> {
  if (typeof window === "undefined" || !("userAgentData" in navigator)) return null;

  try {
    const uaData = (navigator as unknown as { userAgentData?: { getHighEntropyValues: (hints: string[]) => Promise<{ model?: string; platform?: string }> } }).userAgentData;
    if (uaData && typeof uaData.getHighEntropyValues === "function") {
      const hints = await uaData.getHighEntropyValues(["model", "platform"]);
      if (hints.model) {
        return hints.model;
      }
    }
  } catch {}

  return null;
}
