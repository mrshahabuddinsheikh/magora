/**
 * Camera layout for the 3D preview. All values are millimetres measured on the
 * BACK of the phone, as you look at it, from its top-left corner.
 *
 *  - plateau: a raised island (iPhone square / pill bump)
 *  - bar:     a raised strip across the full width (iPhone 17 Pro, Pixel visor)
 *  - floating: individual lenses with no island (Samsung Galaxy S)
 */
export interface Lens {
  x: number;
  y: number;
  d: number;
  /** lens = big glass, flash = small warm dot, sensor = small dark dot */
  kind?: "lens" | "flash" | "sensor";
}

export interface CameraSpec {
  type: "plateau" | "bar" | "floating";
  /** island / bar rectangle (not used for floating) */
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  r?: number;
  /** how far the island sticks out from the back, mm */
  rise?: number;
  /** Colour of the island; defaults to phone body */
  hex?: string;
  lenses: Lens[];
  /** Optional explicit case cut-out; defaults to island + margin or a hole per lens */
  cutout?: { x: number; y: number; w: number; h: number; r: number };
}

/**
 * Physical details for the 3D model: side buttons and the ports on the bottom
 * and top edges. Sides are named as you look at the SCREEN. y / len in mm,
 * measured from the top of the phone. Missing fields fall back to brand defaults.
 */
export interface PhoneButton {
  side: "left" | "right";
  y: number;
  len: number;
  kind: "power" | "volume" | "action" | "camera" | "slider" | "key";
}
export interface PhoneDetails {
  buttons?: PhoneButton[];
  bottom?: { speaker?: "right" | "left" | "both"; sim?: "left" | "right" | "none"; usbOffset?: number };
  top?: { mic?: boolean; ir?: boolean; speaker?: boolean };
  frontCam?: "island" | "punch";
  /** round camera islands get a polished metal trim */
  trim?: boolean;
}

export type Material = "clear" | "frosted" | "silicone" | "leather" | "carbon";

export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "out_for_delivery",
  "delivered",
  "cancelled",
  "returned",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const SHIPMENT_STATUSES = [
  "booked",
  "picked_up",
  "in_transit",
  "at_hub",
  "out_for_delivery",
  "delivered",
  "failed_attempt",
  "returned_to_sender",
] as const;
export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

export const RETURN_STATUSES = ["requested", "approved", "rejected", "pickup_scheduled", "received", "refunded", "exchanged", "closed"] as const;
