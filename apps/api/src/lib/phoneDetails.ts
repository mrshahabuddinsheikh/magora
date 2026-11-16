import type { PhoneButton, PhoneDetails } from "./types";

/**
 * Brand defaults for buttons & ports, so every phone gets a detailed 3D model
 * without hand-entering each one. Positions are typical for each brand's
 * current flagships; any phone can override them via phone_models.details.
 * Sides are as seen from the SCREEN; y is the button centre from the top (mm).
 */
export function defaultDetails(brand: string, name: string, year: number, h: number): Required<Omit<PhoneDetails, "trim">> & { trim: boolean } {
  const at = (f: number) => Math.round(h * f * 10) / 10;
  const n = name.toLowerCase();
  let buttons: PhoneButton[];
  let bottom: PhoneDetails["bottom"] = { speaker: "right", sim: "left" };
  let top: PhoneDetails["top"] = { mic: true };
  let frontCam: PhoneDetails["frontCam"] = "punch";

  switch (brand) {
    case "apple": {
      const pro = n.includes("pro") || n.includes("air");
      const actionButton = year >= 2025 || (year >= 2023 && pro) || (year >= 2024);
      buttons = [
        actionButton ? { side: "left", y: at(0.205), len: 7, kind: "action" } : { side: "left", y: at(0.2), len: 5, kind: "slider" },
        { side: "left", y: at(0.29), len: 11, kind: "volume" },
        { side: "left", y: at(0.38), len: 11, kind: "volume" },
        { side: "right", y: at(0.31), len: 17, kind: "power" },
      ];
      if (year >= 2024) buttons.push({ side: "right", y: at(0.63), len: 15, kind: "camera" });
      bottom = { speaker: "both", sim: "none" }; // iPhone SIM tray sits on the side
      top = {};
      frontCam = year >= 2023 || pro ? "island" : "punch";
      break;
    }
    case "samsung":
      buttons = [
        { side: "right", y: at(0.27), len: 22, kind: "volume" },
        { side: "right", y: at(0.42), len: 11, kind: "power" },
      ];
      break;
    case "google":
      buttons = [
        { side: "right", y: at(0.25), len: 12, kind: "power" },
        { side: "right", y: at(0.39), len: 22, kind: "volume" },
      ];
      top = { mic: true };
      break;
    case "oneplus":
      buttons = [
        // OnePlus 15 swapped the alert slider for the "Plus Key"
        n.includes("15") ? { side: "left", y: at(0.24), len: 9, kind: "key" } : { side: "left", y: at(0.24), len: 10, kind: "slider" },
        { side: "right", y: at(0.25), len: 20, kind: "volume" },
        { side: "right", y: at(0.39), len: 11, kind: "power" },
      ];
      top = { mic: true, ir: true };
      break;
    case "motorola":
      buttons = [
        { side: "right", y: at(0.26), len: 20, kind: "volume" },
        { side: "right", y: at(0.41), len: 11, kind: "power" },
      ];
      if (n.includes("signature") || n.includes("70")) buttons.push({ side: "left", y: at(0.3), len: 10, kind: "key" });
      break;
    default: // xiaomi, vivo, iqoo, oppo: volume above power on the right, IR blaster on top
      buttons = [
        { side: "right", y: at(0.26), len: 20, kind: "volume" },
        { side: "right", y: at(0.4), len: 11, kind: "power" },
      ];
      top = { mic: true, ir: brand !== "oppo" };
  }
  return { buttons, bottom, top, frontCam, trim: false };
}

/** Defaults with any stored overrides applied on top. */
export function phoneDetails(brand: string, name: string, year: number, h: number, stored: unknown) {
  const d = defaultDetails(brand, name, year, h);
  const s = (stored && typeof stored === "object" ? stored : {}) as PhoneDetails;
  return {
    buttons: s.buttons?.length ? s.buttons : d.buttons,
    bottom: { ...d.bottom, ...s.bottom },
    top: { ...d.top, ...s.top },
    frontCam: s.frontCam ?? d.frontCam,
    trim: s.trim ?? d.trim,
  };
}
