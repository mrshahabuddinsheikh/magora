import type { ShipmentStatus } from "../lib/types";

/**
 * Courier integrations. "own" = your own riders (live GPS from the rider page).
 * For TCS / Leopards / PostEx / Trax / M&P / Call Courier: add the API key in .env,
 * implement fetchTracking() with their tracking API (or point their webhook at
 * POST /api/v1/shipping/:courier/webhook) and status updates flow in automatically.
 */
export interface CourierEvent {
  status: ShipmentStatus;
  location?: string;
  note?: string;
  at: Date;
}

export interface Courier {
  id: string;
  name: string;
  trackingUrl?: (trackingNumber: string) => string;
  /** Pull latest events from the courier API. Return null when not configured. */
  fetchTracking?: (trackingNumber: string) => Promise<CourierEvent[] | null>;
  /** Map the courier's own status text to ours */
  mapStatus?: (raw: string) => ShipmentStatus | null;
  /** Shared secret expected in the x-webhook-secret header */
  webhookSecret?: () => string | undefined;
}

/** Generic mapping that covers the wording most Pakistani couriers use */
export function guessStatus(raw: string): ShipmentStatus | null {
  const s = raw.toLowerCase();
  if (/deliver(ed)?\b(?!.*(fail|attempt|out))/.test(s) && !/out for/.test(s)) return "delivered";
  if (/out for delivery|with rider|dispatched to consignee/.test(s)) return "out_for_delivery";
  if (/fail|attempt|refused|not available|closed/.test(s)) return "failed_attempt";
  if (/return(ed)? to (shipper|origin|sender)|rts/.test(s)) return "returned_to_sender";
  if (/arriv(ed|al) at|hub|facility|warehouse|station/.test(s)) return "at_hub";
  if (/transit|depart|en route|on the way/.test(s)) return "in_transit";
  if (/pick(ed)? ?up|collected|received at origin/.test(s)) return "picked_up";
  if (/book|created|pending/.test(s)) return "booked";
  return null;
}

const notConfigured = async () => null;

export const couriers: Courier[] = [
  { id: "own", name: "Own rider (live GPS)" },
  {
    id: "tcs",
    name: "TCS",
    trackingUrl: (n) => `https://www.tcsexpress.com/track/${encodeURIComponent(n)}`,
    fetchTracking: process.env.TCS_API_KEY ? notConfigured /* TODO: call TCS tracking API */ : undefined,
    mapStatus: guessStatus,
    webhookSecret: () => process.env.TCS_WEBHOOK_SECRET,
  },
  {
    id: "leopards",
    name: "Leopards Courier",
    trackingUrl: (n) => `https://www.leopardscourier.com/tracking?cn=${encodeURIComponent(n)}`,
    fetchTracking: process.env.LEOPARDS_API_KEY ? notConfigured : undefined,
    mapStatus: guessStatus,
    webhookSecret: () => process.env.LEOPARDS_WEBHOOK_SECRET,
  },
  {
    id: "postex",
    name: "PostEx",
    trackingUrl: (n) => `https://postex.pk/tracking?cn=${encodeURIComponent(n)}`,
    fetchTracking: process.env.POSTEX_API_TOKEN ? notConfigured : undefined,
    mapStatus: guessStatus,
    webhookSecret: () => process.env.POSTEX_WEBHOOK_SECRET,
  },
  { id: "trax", name: "Trax", trackingUrl: (n) => `https://trax.pk/tracking/?tracking_number=${encodeURIComponent(n)}`, mapStatus: guessStatus, webhookSecret: () => process.env.TRAX_WEBHOOK_SECRET },
  { id: "mnp", name: "M&P", trackingUrl: (n) => `https://www.mulphilog.com/tracking/${encodeURIComponent(n)}`, mapStatus: guessStatus, webhookSecret: () => process.env.MNP_WEBHOOK_SECRET },
  { id: "callcourier", name: "Call Courier", mapStatus: guessStatus, webhookSecret: () => process.env.CALLCOURIER_WEBHOOK_SECRET },
];

export const getCourier = (id: string) => couriers.find((c) => c.id === id);

export const SHIPMENT_LABEL: Record<string, string> = {
  booked: "Booked with courier",
  picked_up: "Picked up from our warehouse",
  in_transit: "In transit",
  at_hub: "Arrived at courier hub",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  failed_attempt: "Delivery attempt failed",
  returned_to_sender: "Returned to sender",
};

/** Shipment status → order status */
export const ORDER_STATUS_FOR: Partial<Record<ShipmentStatus, string>> = {
  booked: "processing",
  picked_up: "shipped",
  in_transit: "shipped",
  at_hub: "shipped",
  out_for_delivery: "out_for_delivery",
  delivered: "delivered",
  returned_to_sender: "returned",
};

const MAJOR = ["karachi", "lahore", "islamabad", "rawalpindi"];

/** Default delivery estimate: 2 working days for big cities, 4 elsewhere (Sundays skipped). */
export function defaultEta(city: string, from = new Date()) {
  let days = MAJOR.includes(city.trim().toLowerCase()) ? 2 : 4;
  const d = new Date(from);
  while (days > 0) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0) days--;
  }
  d.setHours(19, 0, 0, 0);
  return d;
}
