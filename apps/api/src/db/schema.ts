import { sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
};

/* ───────────── Catalog: brands & phone models ───────────── */

export const brands = sqliteTable("brands", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  sort: integer("sort").notNull().default(0),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

/**
 * One row per phone model. The physical spec (size, corner radius, camera layout)
 * drives the live 3D preview, so a new model only needs a row here — no images.
 */
export const phoneModels = sqliteTable(
  "phone_models",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    brandId: integer("brand_id").notNull().references(() => brands.id),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    year: integer("year").notNull(),
    /** Space separated extra search terms: model numbers, short names ("s25u", "A3084") */
    aliases: text("aliases").notNull().default(""),
    /** Normalised (lowercase, alphanumeric only) text used by the search endpoint */
    searchText: text("search_text").notNull().default(""),
    heightMm: real("height_mm").notNull(),
    widthMm: real("width_mm").notNull(),
    depthMm: real("depth_mm").notNull(),
    cornerRadiusMm: real("corner_radius_mm").notNull(),
    /** JSON — camera layout, see CameraSpec in src/lib/types.ts */
    camera: text("camera", { mode: "json" }).notNull(),
    /** JSON — buttons & ports for the 3D model (see PhoneDetails); {} = brand defaults */
    details: text("details", { mode: "json" }).notNull().default(sql`'{}'`),
    /** Body colour of the phone shown under clear cases */
    bodyHex: text("body_hex").notNull().default("#8a8d91"),
    /** Price adjustment in minor units for this size class (e.g. Pro Max +300) */
    priceAdjust: integer("price_adjust").notNull().default(0),
    popular: integer("popular", { mode: "boolean" }).notNull().default(false),
    isHero: integer("is_hero", { mode: "boolean" }).notNull().default(false),
    model3dUrl: text("model_3d_url"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    sort: integer("sort").notNull().default(0),
  },
  (t) => [index("phone_models_brand_idx").on(t.brandId, t.sort)],
);

export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  /** Which storefront section this category lives in: magsafe-cases | skins | screen-protectors | gadgets */
  section: text("section").notNull().default("magsafe-cases"),
  sort: integer("sort").notNull().default(0),
});

/* ───────────── Products & variants ───────────── */

export const products = sqliteTable(
  "products",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    subtitle: text("subtitle").notNull().default(""),
    description: text("description").notNull().default(""),
    categoryId: integer("category_id").notNull().references(() => categories.id),
    /** Product brand / company / vendor (e.g. Magora, Casetify, dbrand, Ronin, Spigen, Apple, Samsung) */
    brand: text("brand").notNull().default("Magora"),
    /** clear | frosted | silicone | leather | carbon — selects the 3D material */
    material: text("material").notNull(),
    /** Prices are stored in minor units? No — PKR has no practical minor unit, so whole rupees. */
    basePrice: integer("base_price").notNull(),
    compareAtPrice: integer("compare_at_price"),
    /** Denormalised for fast listing/sorting without joins */
    minPrice: integer("min_price").notNull().default(0),
    badge: text("badge"),
    /**
     * How the product is shown: { mode: "auto" | "design" | "model" | "photos", first: "3d" | "photos",
     * designUrl?, designFit?: "cover" | "contain" | "logo", modelUrl?, modelBytes? } — see ProductView
     */
    view: text("view", { mode: "json" }).$type<Record<string, unknown>>().notNull().default(sql`'{}'`),
    /** Uploaded product photos (URLs). Optional — phone accessories render in 3D without them. */
    images: text("images", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
    features: text("features", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
    specs: text("specs", { mode: "json" })
      .$type<{ label: string; value: string }[]>()
      .notNull()
      .default(sql`'[]'`),
    ratingAvg: real("rating_avg").notNull().default(0),
    ratingCount: integer("rating_count").notNull().default(0),
    soldCount: integer("sold_count").notNull().default(0),
    featured: integer("featured", { mode: "boolean" }).notNull().default(false),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    ...timestamps,
  },
  (t) => [
    index("products_listing_idx").on(t.active, t.categoryId, t.createdAt),
    index("products_price_idx").on(t.active, t.minPrice),
    index("products_sold_idx").on(t.active, t.soldCount),
    index("products_featured_idx").on(t.active, t.featured),
  ],
);

export const productColors = sqliteTable(
  "product_colors",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    hex: text("hex").notNull(),
    /** Optional secondary colour (e.g. MagSafe ring / camera ring) */
    accentHex: text("accent_hex"),
    /** Optional print design for this option (flat PNG/JPG), drawn on the 3D case / skin */
    designUrl: text("design_url"),
    sort: integer("sort").notNull().default(0),
  },
  (t) => [index("product_colors_product_idx").on(t.productId)],
);

/** A sellable unit: product × phone model × colour, with its own price & stock */
export const variants = sqliteTable(
  "variants",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    /** null = universal product (gadgets: chargers, earbuds…) not tied to a phone model */
    phoneModelId: integer("phone_model_id").references(() => phoneModels.id),
    colorId: integer("color_id")
      .notNull()
      .references(() => productColors.id, { onDelete: "cascade" }),
    sku: text("sku").notNull().unique(),
    price: integer("price").notNull(),
    compareAtPrice: integer("compare_at_price"),
    stock: integer("stock").notNull().default(0),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
  },
  (t) => [
    uniqueIndex("variants_combo_uq").on(t.productId, t.phoneModelId, t.colorId),
    index("variants_model_idx").on(t.phoneModelId, t.productId),
    uniqueIndex("variants_universal_uq").on(t.productId, t.colorId).where(sql`phone_model_id is null`),
  ],
);

/* ───────────── Customers ───────────── */

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("customer"), // customer | admin
  ...timestamps,
});

export const addresses = sqliteTable(
  "addresses",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    label: text("label").notNull().default("Home"),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    city: text("city").notNull(),
    area: text("area"),
    line1: text("line1").notNull(),
    postalCode: text("postal_code"),
    isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [index("addresses_user_idx").on(t.userId)],
);

export const wishlist = sqliteTable(
  "wishlist",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [primaryKey({ columns: [t.userId, t.productId] })],
);

/* ───────────── Cart ───────────── */

export const carts = sqliteTable("carts", {
  id: text("id").primaryKey(), // random token — usable by guests and apps
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  couponCode: text("coupon_code"),
  ...timestamps,
});

export const cartItems = sqliteTable(
  "cart_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    cartId: text("cart_id")
      .notNull()
      .references(() => carts.id, { onDelete: "cascade" }),
    variantId: integer("variant_id")
      .notNull()
      .references(() => variants.id, { onDelete: "cascade" }),
    qty: integer("qty").notNull(),
    /** Per-item options: skin coverage, custom photo… (null for plain items) */
    custom: text("custom", { mode: "json" }).$type<ItemCustom | null>(),
    /** stable key of `custom` so identical items merge (variant + options) */
    customKey: text("custom_key").notNull().default(""),
  },
  (t) => [uniqueIndex("cart_items_uq2").on(t.cartId, t.variantId, t.customKey)],
);

export interface ItemCustom {
  coverage?: "back" | "back_sides";
  imageUrl?: string;
  imageName?: string;
  note?: string;
}

export const coupons = sqliteTable("coupons", {
  code: text("code").primaryKey(),
  type: text("type").notNull(), // percent | fixed | free_shipping
  value: integer("value").notNull().default(0),
  minSubtotal: integer("min_subtotal").notNull().default(0),
  maxDiscount: integer("max_discount"),
  usageLimit: integer("usage_limit"),
  usedCount: integer("used_count").notNull().default(0),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

/* ───────────── Orders & payments ───────────── */

export const orders = sqliteTable(
  "orders",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    number: text("number").notNull().unique(),
    accessToken: text("access_token").notNull(),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    status: text("status").notNull().default("pending"),
    paymentMethod: text("payment_method").notNull(),
    paymentStatus: text("payment_status").notNull().default("unpaid"),
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone").notNull(),
    customerEmail: text("customer_email"),
    city: text("city").notNull(),
    area: text("area"),
    line1: text("line1").notNull(),
    postalCode: text("postal_code"),
    notes: text("notes"),
    subtotal: integer("subtotal").notNull(),
    discount: integer("discount").notNull().default(0),
    shipping: integer("shipping").notNull().default(0),
    codFee: integer("cod_fee").notNull().default(0),
    total: integer("total").notNull(),
    couponCode: text("coupon_code"),
    source: text("source").notNull().default("web"), // web | android | ios | huawei
    /* ── fulfilment (order desk) ── */
    /** customer may open the parcel before paying (printed on the label) */
    openParcel: integer("open_parcel", { mode: "boolean" }).notNull().default(true),
    weightGrams: integer("weight_grams"),
    labelPrintedAt: integer("label_printed_at", { mode: "timestamp_ms" }),
    packedAt: integer("packed_at", { mode: "timestamp_ms" }),
    shippedAt: integer("shipped_at", { mode: "timestamp_ms" }),
    deliveredAt: integer("delivered_at", { mode: "timestamp_ms" }),
    /* ── returns ── */
    returnedAt: integer("returned_at", { mode: "timestamp_ms" }),
    /** rto = came back from the courier (refused / not delivered) · customer = returned after delivery */
    returnType: text("return_type"),
    returnReason: text("return_reason"),
    /** what the return cost us (courier return charges etc.) */
    returnCost: integer("return_cost").notNull().default(0),
    /** when we sent the "rate your order" link */
    reviewRequestedAt: integer("review_requested_at", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (t) => [
    index("orders_returned_idx").on(t.returnedAt),
    index("orders_user_idx").on(t.userId, t.createdAt),
    index("orders_status_idx").on(t.status, t.createdAt),
    index("orders_phone_idx").on(t.customerPhone),
  ],
);

export const orderItems = sqliteTable(
  "order_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    variantId: integer("variant_id").references(() => variants.id, { onDelete: "set null" }),
    productId: integer("product_id"),
    productSlug: text("product_slug").notNull(),
    productName: text("product_name").notNull(),
    modelName: text("model_name").notNull(),
    colorName: text("color_name").notNull(),
    colorHex: text("color_hex").notNull(),
    sku: text("sku").notNull(),
    unitPrice: integer("unit_price").notNull(),
    qty: integer("qty").notNull(),
    lineTotal: integer("line_total").notNull(),
    category: text("category").notNull().default("magsafe-cases"),
    material: text("material"),
    custom: text("custom", { mode: "json" }).$type<ItemCustom | null>(),
  },
  (t) => [index("order_items_order_idx").on(t.orderId)],
);

export const orderEvents = sqliteTable(
  "order_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    note: text("note"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("order_events_order_idx").on(t.orderId)],
);

export const payments = sqliteTable(
  "payments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    amount: integer("amount").notNull(),
    status: text("status").notNull().default("pending"), // pending | paid | failed | refunded
    reference: text("reference"),
    payload: text("payload", { mode: "json" }),
    ...timestamps,
  },
  (t) => [index("payments_order_idx").on(t.orderId)],
);

/* ───────────── Reviews ───────────── */

export const reviews = sqliteTable(
  "reviews",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    rating: integer("rating").notNull(),
    title: text("title"),
    body: text("body").notNull(),
    verified: integer("verified", { mode: "boolean" }).notNull().default(false),
    approved: integer("approved", { mode: "boolean" }).notNull().default(false),
    /** set when the review came from the "rate your order" link → verified buyer */
    orderId: integer("order_id").references(() => orders.id, { onDelete: "set null" }),
    photos: text("photos", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
    /** the store's public answer under the review */
    adminReply: text("admin_reply"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    index("reviews_product_idx").on(t.productId, t.approved, t.createdAt),
    uniqueIndex("reviews_order_product_uq").on(t.orderId, t.productId).where(sql`order_id is not null`),
  ],
);

/* ───────────── Shipping & live tracking ───────────── */

/** One shipment per order. Updated by admin, courier webhooks/sync, or the rider's phone. */
export const shipments = sqliteTable(
  "shipments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orderId: integer("order_id")
      .notNull()
      .unique()
      .references(() => orders.id, { onDelete: "cascade" }),
    courier: text("courier").notNull().default("own"), // own | tcs | leopards | postex | trax | mnp | callcourier
    trackingNumber: text("tracking_number"),
    status: text("status").notNull().default("booked"),
    etaAt: integer("eta_at", { mode: "timestamp_ms" }),
    riderName: text("rider_name"),
    riderPhone: text("rider_phone"),
    /** secret link token for the rider's phone page (/rider/<token>) */
    riderToken: text("rider_token").notNull().unique(),
    lastLat: real("last_lat"),
    lastLng: real("last_lng"),
    lastLocationAt: integer("last_location_at", { mode: "timestamp_ms" }),
    currentLocation: text("current_location"),
    ...timestamps,
  },
  (t) => [index("shipments_tracking_idx").on(t.courier, t.trackingNumber)],
);

export const shipmentEvents = sqliteTable(
  "shipment_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    shipmentId: integer("shipment_id")
      .notNull()
      .references(() => shipments.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    location: text("location"),
    note: text("note"),
    lat: real("lat"),
    lng: real("lng"),
    source: text("source").notNull().default("admin"), // admin | courier | rider
    at: integer("at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("shipment_events_ship_idx").on(t.shipmentId, t.at)],
);

/* ───────────── Returns & exchanges ───────────── */

export const returnRequests = sqliteTable(
  "return_requests",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    number: text("number").notNull().unique(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    /** requested | approved | rejected | pickup_scheduled | received | refunded | exchanged | closed */
    status: text("status").notNull().default("requested"),
    resolution: text("resolution").notNull(), // refund | exchange
    reason: text("reason").notNull(),
    details: text("details"),
    items: text("items", { mode: "json" }).$type<{ orderItemId: number; qty: number }[]>().notNull(),
    /** for exchange: the phone model / colour the customer wants instead */
    exchangeNote: text("exchange_note"),
    refundAmount: integer("refund_amount").notNull().default(0),
    refundMethod: text("refund_method"), // e.g. "JazzCash 0300…", "Bank IBAN …"
    adminNote: text("admin_note"),
    ...timestamps,
  },
  (t) => [index("returns_order_idx").on(t.orderId), index("returns_status_idx").on(t.status, t.createdAt), index("returns_user_idx").on(t.userId)],
);

export const returnEvents = sqliteTable(
  "return_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    returnId: integer("return_id")
      .notNull()
      .references(() => returnRequests.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    note: text("note"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("return_events_ret_idx").on(t.returnId)],
);

/* ───────────── COD safety & stock alerts (v8) ───────────── */

/** Numbers that may not place cash-on-delivery orders (fake / refused orders) */
export const blockedPhones = sqliteTable("blocked_phones", {
  phone: text("phone").primaryKey(),
  reason: text("reason"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

/** "Notify me when back in stock" requests */
export const stockAlerts = sqliteTable(
  "stock_alerts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    colorId: integer("color_id").references(() => productColors.id, { onDelete: "cascade" }),
    phoneModelId: integer("phone_model_id").references(() => phoneModels.id, { onDelete: "cascade" }),
    phone: text("phone").notNull(),
    name: text("name"),
    notifiedAt: integer("notified_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("stock_alerts_product_idx").on(t.productId, t.notifiedAt)],
);

/* ───────────── Product Brands / Companies (Casetify, dbrand, Ronin, Spigen, etc.) ───────────── */
export const productBrands = sqliteTable("product_brands", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  website: text("website"),
  sort: integer("sort").notNull().default(0),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

/* ───────────── Custom Styles & Materials (Cases, Skins, Protectors, Gadgets) ───────────── */
export const customStyles = sqliteTable("custom_styles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  section: text("section").notNull().default("magsafe-cases"),
  hint: text("hint").notNull().default(""),
  color: text("color").notNull().default("#1f2024"),
  accent: text("accent"),
  sort: integer("sort").notNull().default(0),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

/* ───────────── Trust Signals & Social Proof Popups (Custom + Real) ───────────── */
export const trustSignals = sqliteTable("trust_signals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  city: text("city").notNull(),
  productName: text("product_name").notNull(),
  productSlug: text("product_slug").notNull(),
  material: text("material").default("clear"),
  colorHex: text("color_hex").notNull().default("#1f2024"),
  modelName: text("model_name"),
  timeAgoText: text("time_ago_text").notNull().default("Just now"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  sort: integer("sort").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const trustSettings = sqliteTable("trust_settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  key: text("key").notNull().unique(),
  value: text("value", { mode: "json" }).notNull(),
});

/* ───────────── Web Push Notifications Subscriptions ───────────── */
export const pushSubscriptions = sqliteTable("push_subscriptions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  phone: text("phone"),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  cartId: text("cart_id"),
  deviceInfo: text("device_info"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  lastNotifiedAt: integer("last_notified_at", { mode: "timestamp_ms" }),
});

/* ───────────── Customer Behavioral Leads & WhatsApp CRM ───────────── */
export const customerLeads = sqliteTable("customer_leads", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  phone: text("phone").notNull(),
  name: text("name"),
  email: text("email"),
  city: text("city"),
  source: text("source").notNull().default("lead_popup"), // lead_popup | cart_abandoned | checkout | whatsapp_community | back_in_stock
  preferredModel: text("preferred_model"),
  interests: text("interests"),
  cartValue: integer("cart_value").default(0),
  cartItemsSummary: text("cart_items_summary"),
  lastVisitedPage: text("last_visited_page"),
  visitCount: integer("visit_count").notNull().default(1),
  convertedOrder: integer("converted_order", { mode: "boolean" }).notNull().default(false),
  whatsappCommunityOptIn: integer("whatsapp_community_opt_in", { mode: "boolean" }).notNull().default(true),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

/* ───────────── TikTok / Instagram Shoppable Reels ───────────── */
export interface ReelComment {
  id: string;
  author: string;
  avatar?: string;
  city?: string;
  rating: number;
  text: string;
  likes: number;
  timeAgo: string;
  verifiedBuyer?: boolean;
}

export const shoppableReels = sqliteTable("shoppable_reels", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  caption: text("caption"),
  videoUrl: text("video_url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  productId: integer("product_id").references(() => products.id, { onDelete: "set null" }),
  productName: text("product_name"),
  productPrice: integer("product_price"),
  productCompareAtPrice: integer("product_compare_at_price"),
  productSlug: text("product_slug"),
  productImage: text("product_image"),
  phoneModel: text("phone_model"),
  likesCount: integer("likes_count").notNull().default(18500),
  viewsCount: integer("views_count").notNull().default(45200),
  commentsCount: integer("comments_count").notNull().default(64),
  sharesCount: integer("shares_count").notNull().default(2300),
  comments: text("comments", { mode: "json" }).$type<ReelComment[]>().notNull().default(sql`'[]'`),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  sort: integer("sort").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});


