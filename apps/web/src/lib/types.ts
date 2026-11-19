export interface Lens { x: number; y: number; d: number; kind?: "lens" | "flash" | "sensor" }
export interface CameraSpec {
  type: "plateau" | "bar" | "floating";
  x?: number; y?: number; w?: number; h?: number; r?: number; rise?: number; hex?: string;
  lenses: Lens[];
  cutout?: { x: number; y: number; w: number; h: number; r: number };
}
export interface PhoneButton { side: "left" | "right"; y: number; len: number; kind: "power" | "volume" | "action" | "camera" | "slider" | "key" }
/** buttons & ports; sides as seen from the screen, y from the top (mm) */
export interface PhoneDetails {
  buttons: PhoneButton[];
  bottom: { speaker?: "right" | "left" | "both"; sim?: "left" | "right" | "none"; usbOffset?: number };
  top: { mic?: boolean; ir?: boolean; speaker?: boolean };
  frontCam: "island" | "punch";
  trim?: boolean;
}
export interface PhoneSpec {
  heightMm: number; widthMm: number; depthMm: number; cornerRadiusMm: number;
  camera: CameraSpec; bodyHex: string;
  details?: PhoneDetails;
  model3dUrl?: string | null;
}
export type CaseMaterial = "clear" | "frosted" | "silicone" | "leather" | "carbon";
export type SkinMaterial = "skin-solid" | "skin-carbon" | "skin-marble" | "skin-wood" | "skin-metal" | "skin-custom";
export type ProtectorMaterial = "glass-clear" | "glass-privacy" | "glass-matte" | "lens";
export type GadgetMaterial = "gadget-cable" | "gadget-charger" | "gadget-earbuds" | "gadget-handsfree" | "gadget-watch" | "gadget-powerbank";
export type Material = CaseMaterial | SkinMaterial | ProtectorMaterial | GadgetMaterial;
/** storefront sections — each feels like its own shop */
export type CategorySlug = "magsafe-cases" | "skins" | "screen-protectors" | "gadgets";
export type GadgetCategory = "cables" | "chargers" | "earbuds" | "handsfree" | "smart-watches" | "power-banks";
export interface ItemCustom { coverage?: "back" | "back_sides"; imageUrl?: string; imageName?: string; note?: string }

export interface Brand { slug: string; name: string }
export interface PhoneModel { id: number; slug: string; name: string; year: number; popular: boolean; isHero?: boolean; brand: Brand; layout?: CamLayout; bodyHex?: string; model3dUrl?: string | null }
export type CamLayout = "bar" | "visor" | "plateau" | "floating" | "circle" | "circle-left";
export interface BrandWithModels extends Brand { models: PhoneModel[] }

export interface Color { id: number; name: string; hex: string; accentHex?: string | null; designUrl?: string | null }
/** How a product is shown — set in the admin product editor */
export interface ProductView {
  /** auto = 3D from style & colour · design = 3D + printed design · model = own 3D file (gadgets) · photos = photos only */
  mode?: "auto" | "design" | "model" | "photos";
  first?: "3d" | "photos";
  designUrl?: string | null;
  designFit?: "cover" | "contain" | "logo";
  modelUrl?: string | null;
  modelBytes?: number;
}

export interface ProductListItem {
  id: number; slug: string; name: string; brand?: string; subtitle: string; material: Material; badge: string | null;
  price: number; compareAtPrice: number | null; ratingAvg: number; ratingCount: number;
  colors: Color[]; category?: string; section?: CategorySlug; images?: string[]; view?: ProductView;
}

export interface ProductModel extends PhoneModel { price: number; inStock: boolean; spec: PhoneSpec }
export interface Variant { id: number; modelId: number | null; colorId: number; sku: string; price: number; compareAtPrice: number | null; stock: number; inStock: boolean }

export interface Product {
  id: number; slug: string; name: string; brand?: string; subtitle: string; description: string; material: Material;
  basePrice: number; compareAtPrice: number | null; minPrice: number; badge: string | null;
  features: string[]; specs: { label: string; value: string }[];
  ratingAvg: number; ratingCount: number; soldCount: number; featured: boolean;
  colors: Color[]; models: ProductModel[]; variants: Variant[];
  category: { slug: string; name: string; section: CategorySlug };
  images: string[];
  view?: ProductView;
}

export interface Paged<T> { data: T[]; meta: { page: number; limit: number; total: number; hasMore: boolean } }

export interface CartLine {
  id: number; variantId: number; qty: number; unitPrice: number; compareAtPrice: number | null; lineTotal: number; stock: number; sku: string;
  product: { id: number; slug: string; name: string; material: Material; image?: string | null; design?: string | null };
  /** null for universal gadgets */
  model: { id: number; slug: string; name: string } | null;
  color: { id: number; name: string; hex: string };
  category: string; custom: ItemCustom | null; extraPrice: number;
  issue?: "out_of_stock" | "insufficient_stock" | "missing_photo";
}
export interface Cart {
  id: string; items: CartLine[]; itemCount: number;
  coupon: { code: string; type: string; value: number } | null; couponError?: string;
  bundles?: { model: string; kinds: string[]; discount: number }[];
  totals: {
    subtotal: number; discount: number; bundleDiscount?: number; couponDiscount?: number; shipping: number; codFee: number;
    codSettings?: { enabled: boolean; threshold: number; feeBelow: number; feeAbove: number };
    total: number; savings: number; freeShippingRemaining: number; freeShippingAbove?: number;
  };
  currency: string; hasIssues: boolean;
}

export interface PaymentMethod { id: string; name: string; description: string; kind: string; enabled: boolean }

export interface LeadCaptureConfig {
  id?: number;
  enabled: boolean;
  showFloatingPill: boolean;
  badgeText: string;
  heading: string;
  subheading: string;
  couponCode: string;
  discountAmount: number;
  delaySeconds: number;
}

export interface LoyaltyConfig {
  id?: number;
  enabled: boolean;
  coinRatePct: number;
  coinValuePkr: number;
  minOrderPkr: number;
  customBadgeTemplate: string;
  termsNotice: string;
}

export interface CoinTransaction {
  id: number;
  customerPhone: string;
  customerEmail: string | null;
  customerName: string | null;
  orderId: number | null;
  orderNumber: string | null;
  amountCoins: number;
  amountPkr: number;
  type: "earned" | "redeemed" | "admin_grant" | "admin_deduct" | string;
  status: "approved" | "rejected" | "pending" | string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StoreInfo {
  name: string; tagline: string; currency: string; currencySymbol: string;
  supportPhone: string; supportWhatsapp: string; supportEmail: string;
  shipping: { flatRate: number; freeAbove: number; etaDays: string; etaByCity?: Record<string, [number, number]>; etaDefault?: [number, number] };
  cod: {
    enabled: boolean;
    fee: number;
    maxOrderTotal: number;
    threshold?: number;
    feeBelow?: number;
    feeAbove?: number;
    cityRestriction?: string;
    allowedCities?: string[];
    nonCodNotice?: string;
  };
  payoneer?: {
    enabled: boolean;
    title?: string;
    email?: string;
    link?: string;
    instructions?: string;
    bankTitle?: string;
    bankAccount?: string;
    bankIban?: string;
  };
  leadCapture?: LeadCaptureConfig;
  loyalty?: LoyaltyConfig;
  returnsDays: number; cities: string[]; paymentMethods: PaymentMethod[];
}

export interface Order {
  number: string; accessToken?: string; status: string; statusLabel: string; paymentMethod: string; paymentStatus: string;
  customer: { name: string; phone: string; email: string | null };
  address: { city: string; area: string | null; line1: string; postalCode: string | null };
  notes: string | null;
  items: { id: number; productSlug: string; productName: string; modelName: string; colorName: string; colorHex: string; sku: string; unitPrice: number; qty: number; lineTotal: number; category?: string; material?: Material | null; custom?: ItemCustom | null }[];
  totals: { subtotal: number; discount: number; shipping: number; codFee: number; total: number };
  couponCode: string | null;
  timeline: { status: string; label: string; note: string | null; at: string }[];
  canCancel: boolean; canReturn: boolean; returnDeadline: string | null;
  shipment: Shipment | null;
  returns: { number: string; status: string; statusLabel: string; resolution: string; reason: string; createdAt: string }[];
  createdAt: string;
  source?: string; userId?: number | null;
}

export interface Shipment {
  courier: string; courierName: string; trackingNumber: string | null; trackingUrl: string | null;
  status: string; statusLabel: string; eta: string | null; currentLocation: string | null;
  rider: { name: string | null; phone: string | null; lat: number | null; lng: number | null; updatedAt: string | null; live: boolean } | null;
  events: { status: string; label: string; location: string | null; note: string | null; at: string; source: string }[];
  riderToken?: string;
}

export interface ReturnRequest {
  number: string; orderNumber: string; status: string; statusLabel: string; resolution: "refund" | "exchange";
  reason: string; details: string | null; exchangeNote: string | null; refundAmount: number; refundMethod: string | null; adminNote: string | null;
  items: { orderItemId: number; qty: number; productName?: string; modelName?: string; colorName?: string; colorHex?: string; unitPrice?: number }[];
  timeline: { status: string; label: string; note: string | null; at: string }[];
  customer?: { name: string; phone: string; city: string; address: string };
  createdAt: string;
}

export interface Review { id: number; name: string; rating: number; title: string | null; body: string; verified: boolean; photos?: string[]; adminReply?: string | null; createdAt: string }
export interface User { id: number; name: string; email: string; phone: string | null; role: string }

export interface ProductBrand {
  id: number;
  slug: string;
  name: string;
  description?: string;
  website?: string | null;
  sort: number;
  active: boolean;
}

export interface CustomStyle {
  id: number;
  slug: string;
  name: string;
  section: string;
  hint: string;
  color: string;
  accent?: string | null;
  sort: number;
  active: boolean;
}

export interface TrustSignal {
  id: number;
  city: string;
  productName: string;
  productSlug: string;
  material?: string | null;
  colorHex: string;
  modelName?: string | null;
  timeAgoText: string;
  active: boolean;
  sort: number;
}

export interface TrustSettings {
  enabled: boolean;
  mode: "auto" | "custom" | "hybrid";
  initialDelaySec: number;
  intervalSec: number;
  durationSec: number;
}

export interface MarketingSettings {
  id: number;
  enabled: boolean;
  metaPixelId: string | null;
  tiktokPixelId: string | null;
  googleTagId: string | null;
  googleAdsConversionId: string | null;
  googleSearchConsoleCode: string | null;
  pinterestTagId?: string | null;
  snapchatPixelId?: string | null;
  metaCapiToken?: string | null;
  metaTestEventCode?: string | null;
  tiktokAccessToken?: string | null;
  tiktokTestEventCode?: string | null;
  trackPurchases: boolean;
  trackAddToCart: boolean;
  trackInitiateCheckout: boolean;
}

export interface CityStat {
  city: string;
  orders: number;
  revenue: number;
}
