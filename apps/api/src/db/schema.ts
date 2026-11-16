import { sql } from "drizzle-orm";
import {
  mysqlTable,
  varchar,
  text,
  int,
  double,
  boolean,
  timestamp,
  json,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/mysql-core";

const timestamps = {
  createdAt: timestamp("created_at", { mode: "date", fsp: 3 })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP(3)`),
  updatedAt: timestamp("updated_at", { mode: "date", fsp: 3 })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)`),
};

/* ───────────── Catalog: brands & phone models ───────────── */

export const brands = mysqlTable("brands", {
  id: int("id").primaryKey().autoincrement(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  sort: int("sort").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

/**
 * One row per phone model. The physical spec (size, corner radius, camera layout)
 * drives the live 3D preview, so a new model only needs a row here — no images.
 */
export const phoneModels = mysqlTable(
  "phone_models",
  {
    id: int("id").primaryKey().autoincrement(),
    brandId: int("brand_id").notNull().references(() => brands.id),
    slug: varchar("slug", { length: 255 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    year: int("year").notNull(),
    /** Space separated extra search terms: model numbers, short names ("s25u", "A3084") */
    aliases: varchar("aliases", { length: 500 }).notNull().default(""),
    /** Normalised (lowercase, alphanumeric only) text used by the search endpoint */
    searchText: text("search_text").notNull(),
    heightMm: double("height_mm").notNull(),
    widthMm: double("width_mm").notNull(),
    depthMm: double("depth_mm").notNull(),
    cornerRadiusMm: double("corner_radius_mm").notNull(),
    /** JSON — camera layout, see CameraSpec in src/lib/types.ts */
    camera: json("camera").notNull(),
    /** JSON — buttons & ports for the 3D model (see PhoneDetails); {} = brand defaults */
    details: json("details").notNull().$defaultFn(() => ({})),
    /** Body colour of the phone shown under clear cases */
    bodyHex: varchar("body_hex", { length: 32 }).notNull().default("#8a8d91"),
    /** Price adjustment in minor units for this size class (e.g. Pro Max +300) */
    priceAdjust: int("price_adjust").notNull().default(0),
    popular: boolean("popular").notNull().default(false),
    isHero: boolean("is_hero").notNull().default(false),
    model3dUrl: text("model_3d_url"),
    active: boolean("active").notNull().default(true),
    sort: int("sort").notNull().default(0),
  },
  (t) => [index("phone_models_brand_idx").on(t.brandId, t.sort)],
);

export const categories = mysqlTable("categories", {
  id: int("id").primaryKey().autoincrement(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  /** Which storefront section this category lives in: magsafe-cases | skins | screen-protectors | gadgets */
  section: varchar("section", { length: 64 }).notNull().default("magsafe-cases"),
  sort: int("sort").notNull().default(0),
});

/* ───────────── Products & variants ───────────── */

export const products = mysqlTable(
  "products",
  {
    id: int("id").primaryKey().autoincrement(),
    slug: varchar("slug", { length: 255 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    subtitle: varchar("subtitle", { length: 255 }).default(""),
    description: text("description"),
    categoryId: int("category_id").notNull().references(() => categories.id),
    /** Product brand / company / vendor (e.g. Magora, Casetify, dbrand, Ronin, Spigen, Apple, Samsung) */
    brand: varchar("brand", { length: 128 }).notNull().default("Magora"),
    /** clear | frosted | silicone | leather | carbon — selects the 3D material */
    material: varchar("material", { length: 64 }).notNull(),
    /** Prices are stored in minor units? No — PKR has no practical minor unit, so whole rupees. */
    basePrice: int("base_price").notNull(),
    compareAtPrice: int("compare_at_price"),
    /** Denormalised for fast listing/sorting without joins */
    minPrice: int("min_price").notNull().default(0),
    badge: varchar("badge", { length: 64 }),
    /**
     * How the product is shown: { mode: "auto" | "design" | "model" | "photos", first: "3d" | "photos",
     * designUrl?, designFit?: "cover" | "contain" | "logo", modelUrl?, modelBytes? } — see ProductView
     */
    view: json("view").$type<Record<string, unknown>>().notNull().$defaultFn(() => ({})),
    /** Uploaded product photos (URLs). Optional — phone accessories render in 3D without them. */
    images: json("images").$type<string[]>().notNull().$defaultFn(() => []),
    features: json("features").$type<string[]>().notNull().$defaultFn(() => []),
    specs: json("specs")
      .$type<{ label: string; value: string }[]>()
      .notNull()
      .$defaultFn(() => []),
    ratingAvg: double("rating_avg").notNull().default(0),
    ratingCount: int("rating_count").notNull().default(0),
    soldCount: int("sold_count").notNull().default(0),
    featured: boolean("featured").notNull().default(false),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (t) => [
    index("products_listing_idx").on(t.active, t.categoryId, t.createdAt),
    index("products_price_idx").on(t.active, t.minPrice),
    index("products_sold_idx").on(t.active, t.soldCount),
    index("products_featured_idx").on(t.active, t.featured),
  ],
);

export const productColors = mysqlTable(
  "product_colors",
  {
    id: int("id").primaryKey().autoincrement(),
    productId: int("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 128 }).notNull(),
    hex: varchar("hex", { length: 32 }).notNull(),
    /** Optional secondary colour (e.g. MagSafe ring / camera ring) */
    accentHex: varchar("accent_hex", { length: 32 }),
    /** Optional print design for this option (flat PNG/JPG), drawn on the 3D case / skin */
    designUrl: text("design_url"),
    sort: int("sort").notNull().default(0),
  },
  (t) => [index("product_colors_product_idx").on(t.productId)],
);

/** A sellable unit: product × phone model × colour, with its own price & stock */
export const variants = mysqlTable(
  "variants",
  {
    id: int("id").primaryKey().autoincrement(),
    productId: int("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    /** null = universal product (gadgets: chargers, earbuds…) not tied to a phone model */
    phoneModelId: int("phone_model_id").references(() => phoneModels.id),
    colorId: int("color_id")
      .notNull()
      .references(() => productColors.id, { onDelete: "cascade" }),
    sku: varchar("sku", { length: 128 }).notNull().unique(),
    price: int("price").notNull(),
    compareAtPrice: int("compare_at_price"),
    stock: int("stock").notNull().default(0),
    active: boolean("active").notNull().default(true),
  },
  (t) => [
    uniqueIndex("variants_combo_uq").on(t.productId, t.phoneModelId, t.colorId),
    index("variants_model_idx").on(t.phoneModelId, t.productId),
  ],
);

/* ───────────── Customers ───────────── */

export const users = mysqlTable("users", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  phone: varchar("phone", { length: 64 }),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: varchar("role", { length: 32 }).notNull().default("customer"), // customer | admin
  ...timestamps,
});

export const addresses = mysqlTable(
  "addresses",
  {
    id: int("id").primaryKey().autoincrement(),
    userId: int("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 64 }).notNull().default("Home"),
    name: varchar("name", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 64 }).notNull(),
    city: varchar("city", { length: 128 }).notNull(),
    area: varchar("area", { length: 255 }),
    line1: text("line1").notNull(),
    postalCode: varchar("postal_code", { length: 32 }),
    isDefault: boolean("is_default").notNull().default(false),
  },
  (t) => [index("addresses_user_idx").on(t.userId)],
);

export const wishlist = mysqlTable(
  "wishlist",
  {
    userId: int("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    productId: int("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date", fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => [primaryKey({ columns: [t.userId, t.productId] })],
);

/* ───────────── Cart ───────────── */

export const carts = mysqlTable("carts", {
  id: varchar("id", { length: 64 }).primaryKey(), // random token — usable by guests and apps
  userId: int("user_id").references(() => users.id, { onDelete: "set null" }),
  couponCode: varchar("coupon_code", { length: 64 }),
  ...timestamps,
});

export interface ItemCustom {
  coverage?: "back" | "back_sides";
  imageUrl?: string;
  imageName?: string;
  note?: string;
}

export const cartItems = mysqlTable(
  "cart_items",
  {
    id: int("id").primaryKey().autoincrement(),
    cartId: varchar("cart_id", { length: 64 })
      .notNull()
      .references(() => carts.id, { onDelete: "cascade" }),
    variantId: int("variant_id")
      .notNull()
      .references(() => variants.id, { onDelete: "cascade" }),
    qty: int("qty").notNull(),
    /** Per-item options: skin coverage, custom photo… (null for plain items) */
    custom: json("custom").$type<ItemCustom | null>(),
    /** stable key of `custom` so identical items merge (variant + options) */
    customKey: varchar("custom_key", { length: 255 }).notNull().default(""),
  },
  (t) => [uniqueIndex("cart_items_uq2").on(t.cartId, t.variantId, t.customKey)],
);

export const coupons = mysqlTable("coupons", {
  code: varchar("code", { length: 64 }).primaryKey(),
  type: varchar("type", { length: 32 }).notNull(), // percent | fixed | free_shipping
  value: int("value").notNull().default(0),
  minSubtotal: int("min_subtotal").notNull().default(0),
  maxDiscount: int("max_discount"),
  usageLimit: int("usage_limit"),
  usedCount: int("used_count").notNull().default(0),
  expiresAt: timestamp("expires_at", { mode: "date", fsp: 3 }),
  active: boolean("active").notNull().default(true),
});

/* ───────────── Orders & payments ───────────── */

export const orders = mysqlTable(
  "orders",
  {
    id: int("id").primaryKey().autoincrement(),
    number: varchar("number", { length: 64 }).notNull().unique(),
    accessToken: varchar("access_token", { length: 128 }).notNull(),
    userId: int("user_id").references(() => users.id, { onDelete: "set null" }),
    status: varchar("status", { length: 64 }).notNull().default("pending"),
    paymentMethod: varchar("payment_method", { length: 64 }).notNull(),
    paymentStatus: varchar("payment_status", { length: 64 }).notNull().default("unpaid"),
    customerName: varchar("customer_name", { length: 255 }).notNull(),
    customerPhone: varchar("customer_phone", { length: 64 }).notNull(),
    customerEmail: varchar("customer_email", { length: 255 }),
    city: varchar("city", { length: 128 }).notNull(),
    area: varchar("area", { length: 255 }),
    line1: text("line1").notNull(),
    postalCode: varchar("postal_code", { length: 32 }),
    notes: text("notes"),
    subtotal: int("subtotal").notNull(),
    discount: int("discount").notNull().default(0),
    shipping: int("shipping").notNull().default(0),
    codFee: int("cod_fee").notNull().default(0),
    total: int("total").notNull(),
    couponCode: varchar("coupon_code", { length: 64 }),
    source: varchar("source", { length: 32 }).notNull().default("web"), // web | android | ios | huawei
    /* ── fulfilment (order desk) ── */
    /** customer may open the parcel before paying (printed on the label) */
    openParcel: boolean("open_parcel").notNull().default(true),
    weightGrams: int("weight_grams"),
    labelPrintedAt: timestamp("label_printed_at", { mode: "date", fsp: 3 }),
    packedAt: timestamp("packed_at", { mode: "date", fsp: 3 }),
    shippedAt: timestamp("shipped_at", { mode: "date", fsp: 3 }),
    deliveredAt: timestamp("delivered_at", { mode: "date", fsp: 3 }),
    /* ── returns ── */
    returnedAt: timestamp("returned_at", { mode: "date", fsp: 3 }),
    /** rto = came back from the courier (refused / not delivered) · customer = returned after delivery */
    returnType: varchar("return_type", { length: 64 }),
    returnReason: varchar("return_reason", { length: 255 }),
    /** what the return cost us (courier return charges etc.) */
    returnCost: int("return_cost").notNull().default(0),
    /** when we sent the "rate your order" link */
    reviewRequestedAt: timestamp("review_requested_at", { mode: "date", fsp: 3 }),
    ...timestamps,
  },
  (t) => [
    index("orders_returned_idx").on(t.returnedAt),
    index("orders_user_idx").on(t.userId, t.createdAt),
    index("orders_status_idx").on(t.status, t.createdAt),
    index("orders_phone_idx").on(t.customerPhone),
  ],
);

export const orderItems = mysqlTable(
  "order_items",
  {
    id: int("id").primaryKey().autoincrement(),
    orderId: int("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    variantId: int("variant_id").references(() => variants.id, { onDelete: "set null" }),
    productId: int("product_id"),
    productSlug: varchar("product_slug", { length: 255 }).notNull(),
    productName: varchar("product_name", { length: 255 }).notNull(),
    modelName: varchar("model_name", { length: 255 }).notNull(),
    colorName: varchar("color_name", { length: 128 }).notNull(),
    colorHex: varchar("color_hex", { length: 32 }).notNull(),
    sku: varchar("sku", { length: 128 }).notNull(),
    unitPrice: int("unit_price").notNull(),
    qty: int("qty").notNull(),
    lineTotal: int("line_total").notNull(),
    category: varchar("category", { length: 64 }).notNull().default("magsafe-cases"),
    material: varchar("material", { length: 64 }),
    custom: json("custom").$type<ItemCustom | null>(),
  },
  (t) => [index("order_items_order_idx").on(t.orderId)],
);

export const orderEvents = mysqlTable(
  "order_events",
  {
    id: int("id").primaryKey().autoincrement(),
    orderId: int("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 64 }).notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { mode: "date", fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => [index("order_events_order_idx").on(t.orderId)],
);

export const payments = mysqlTable(
  "payments",
  {
    id: int("id").primaryKey().autoincrement(),
    orderId: int("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 64 }).notNull(),
    amount: int("amount").notNull(),
    status: varchar("status", { length: 64 }).notNull().default("pending"), // pending | paid | failed | refunded
    reference: varchar("reference", { length: 255 }),
    payload: json("payload"),
    ...timestamps,
  },
  (t) => [index("payments_order_idx").on(t.orderId)],
);

/* ───────────── Reviews ───────────── */

export const reviews = mysqlTable(
  "reviews",
  {
    id: int("id").primaryKey().autoincrement(),
    productId: int("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    userId: int("user_id").references(() => users.id, { onDelete: "set null" }),
    name: varchar("name", { length: 255 }).notNull(),
    rating: int("rating").notNull(),
    title: varchar("title", { length: 255 }),
    body: text("body").notNull(),
    verified: boolean("verified").notNull().default(false),
    approved: boolean("approved").notNull().default(false),
    /** set when the review came from the "rate your order" link → verified buyer */
    orderId: int("order_id").references(() => orders.id, { onDelete: "set null" }),
    photos: json("photos").$type<string[]>().notNull().$defaultFn(() => []),
    /** the store's public answer under the review */
    adminReply: text("admin_reply"),
    createdAt: timestamp("created_at", { mode: "date", fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => [
    index("reviews_product_idx").on(t.productId, t.approved, t.createdAt),
    uniqueIndex("reviews_order_product_uq").on(t.orderId, t.productId),
  ],
);

/* ───────────── Shipping & live tracking ───────────── */

/** One shipment per order. Updated by admin, courier webhooks/sync, or the rider's phone. */
export const shipments = mysqlTable(
  "shipments",
  {
    id: int("id").primaryKey().autoincrement(),
    orderId: int("order_id")
      .notNull()
      .unique()
      .references(() => orders.id, { onDelete: "cascade" }),
    courier: varchar("courier", { length: 64 }).notNull().default("own"), // own | tcs | leopards | postex | trax | mnp | callcourier
    trackingNumber: varchar("tracking_number", { length: 128 }),
    status: varchar("status", { length: 64 }).notNull().default("booked"),
    etaAt: timestamp("eta_at", { mode: "date", fsp: 3 }),
    riderName: varchar("rider_name", { length: 255 }),
    riderPhone: varchar("rider_phone", { length: 64 }),
    /** secret link token for the rider's phone page (/rider/<token>) */
    riderToken: varchar("rider_token", { length: 128 }).notNull().unique(),
    lastLat: double("last_lat"),
    lastLng: double("last_lng"),
    lastLocationAt: timestamp("last_location_at", { mode: "date", fsp: 3 }),
    currentLocation: varchar("current_location", { length: 255 }),
    ...timestamps,
  },
  (t) => [index("shipments_tracking_idx").on(t.courier, t.trackingNumber)],
);

export const shipmentEvents = mysqlTable(
  "shipment_events",
  {
    id: int("id").primaryKey().autoincrement(),
    shipmentId: int("shipment_id")
      .notNull()
      .references(() => shipments.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 64 }).notNull(),
    location: varchar("location", { length: 255 }),
    note: text("note"),
    lat: double("lat"),
    lng: double("lng"),
    source: varchar("source", { length: 32 }).notNull().default("admin"), // admin | courier | rider
    at: timestamp("at", { mode: "date", fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => [index("shipment_events_ship_idx").on(t.shipmentId, t.at)],
);

/* ───────────── Returns & exchanges ───────────── */

export const returnRequests = mysqlTable(
  "return_requests",
  {
    id: int("id").primaryKey().autoincrement(),
    number: varchar("number", { length: 64 }).notNull().unique(),
    orderId: int("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    userId: int("user_id").references(() => users.id, { onDelete: "set null" }),
    /** requested | approved | rejected | pickup_scheduled | received | refunded | exchanged | closed */
    status: varchar("status", { length: 64 }).notNull().default("requested"),
    resolution: varchar("resolution", { length: 64 }).notNull(), // refund | exchange
    reason: varchar("reason", { length: 255 }).notNull(),
    details: text("details"),
    items: json("items").$type<{ orderItemId: number; qty: number }[]>().notNull(),
    /** for exchange: the phone model / colour the customer wants instead */
    exchangeNote: text("exchange_note"),
    refundAmount: int("refund_amount").notNull().default(0),
    refundMethod: varchar("refund_method", { length: 255 }), // e.g. "JazzCash 0300…", "Bank IBAN …"
    adminNote: text("admin_note"),
    ...timestamps,
  },
  (t) => [
    index("returns_order_idx").on(t.orderId),
    index("returns_status_idx").on(t.status, t.createdAt),
    index("returns_user_idx").on(t.userId),
  ],
);

export const returnEvents = mysqlTable(
  "return_events",
  {
    id: int("id").primaryKey().autoincrement(),
    returnId: int("return_id")
      .notNull()
      .references(() => returnRequests.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 64 }).notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { mode: "date", fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => [index("return_events_ret_idx").on(t.returnId)],
);

/* ───────────── COD safety & stock alerts (v8) ───────────── */

/** Numbers that may not place cash-on-delivery orders (fake / refused orders) */
export const blockedPhones = mysqlTable("blocked_phones", {
  phone: varchar("phone", { length: 64 }).primaryKey(),
  reason: varchar("reason", { length: 255 }),
  createdAt: timestamp("created_at", { mode: "date", fsp: 3 })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP(3)`),
});

/** "Notify me when back in stock" requests */
export const stockAlerts = mysqlTable(
  "stock_alerts",
  {
    id: int("id").primaryKey().autoincrement(),
    productId: int("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    colorId: int("color_id").references(() => productColors.id, { onDelete: "cascade" }),
    phoneModelId: int("phone_model_id").references(() => phoneModels.id, { onDelete: "cascade" }),
    phone: varchar("phone", { length: 64 }).notNull(),
    name: varchar("name", { length: 255 }),
    notifiedAt: timestamp("notified_at", { mode: "date", fsp: 3 }),
    createdAt: timestamp("created_at", { mode: "date", fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => [index("stock_alerts_product_idx").on(t.productId, t.notifiedAt)],
);

/* ───────────── Product Brands / Companies (Casetify, dbrand, Ronin, Spigen, etc.) ───────────── */
export const productBrands = mysqlTable("product_brands", {
  id: int("id").primaryKey().autoincrement(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  website: varchar("website", { length: 255 }),
  sort: int("sort").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

/* ───────────── Custom Styles & Materials (Cases, Skins, Protectors, Gadgets) ───────────── */
export const customStyles = mysqlTable("custom_styles", {
  id: int("id").primaryKey().autoincrement(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  section: varchar("section", { length: 64 }).notNull().default("magsafe-cases"),
  hint: varchar("hint", { length: 255 }).notNull().default(""),
  color: varchar("color", { length: 32 }).notNull().default("#1f2024"),
  accent: varchar("accent", { length: 32 }),
  sort: int("sort").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

/* ───────────── Trust Signals & Social Proof Popups (Custom + Real) ───────────── */
export const trustSignals = mysqlTable("trust_signals", {
  id: int("id").primaryKey().autoincrement(),
  city: varchar("city", { length: 128 }).notNull(),
  productName: varchar("product_name", { length: 255 }).notNull(),
  productSlug: varchar("product_slug", { length: 255 }).notNull(),
  material: varchar("material", { length: 64 }).default("clear"),
  colorHex: varchar("color_hex", { length: 32 }).notNull().default("#1f2024"),
  modelName: varchar("model_name", { length: 255 }),
  timeAgoText: varchar("time_ago_text", { length: 64 }).notNull().default("Just now"),
  active: boolean("active").notNull().default(true),
  sort: int("sort").notNull().default(0),
  createdAt: timestamp("created_at", { mode: "date", fsp: 3 })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP(3)`),
});

export const trustSettings = mysqlTable("trust_settings", {
  id: int("id").primaryKey().autoincrement(),
  key: varchar("key", { length: 128 }).notNull().unique(),
  value: json("value").notNull(),
});

/* ───────────── Web Push Notifications Subscriptions ───────────── */
export const pushSubscriptions = mysqlTable("push_subscriptions", {
  id: int("id").primaryKey().autoincrement(),
  endpoint: varchar("endpoint", { length: 500 }).notNull().unique(),
  p256dh: varchar("p256dh", { length: 255 }).notNull(),
  auth: varchar("auth", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 64 }),
  userId: int("user_id").references(() => users.id, { onDelete: "set null" }),
  cartId: varchar("cart_id", { length: 64 }),
  deviceInfo: text("device_info"),
  createdAt: timestamp("created_at", { mode: "date", fsp: 3 })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP(3)`),
  lastNotifiedAt: timestamp("last_notified_at", { mode: "date", fsp: 3 }),
});

/* ───────────── Customer Behavioral Leads & WhatsApp CRM ───────────── */
export const customerLeads = mysqlTable("customer_leads", {
  id: int("id").primaryKey().autoincrement(),
  phone: varchar("phone", { length: 64 }).notNull(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 255 }),
  city: varchar("city", { length: 128 }),
  source: varchar("source", { length: 64 }).notNull().default("lead_popup"), // lead_popup | cart_abandoned | checkout | whatsapp_community | back_in_stock
  preferredModel: varchar("preferred_model", { length: 255 }),
  interests: text("interests"),
  cartValue: int("cart_value").default(0),
  cartItemsSummary: text("cart_items_summary"),
  lastVisitedPage: text("last_visited_page"),
  visitCount: int("visit_count").notNull().default(1),
  convertedOrder: boolean("converted_order").notNull().default(false),
  whatsappCommunityOptIn: boolean("whatsapp_community_opt_in").notNull().default(true),
  notes: text("notes"),
  ...timestamps,
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

export const shoppableReels = mysqlTable("shoppable_reels", {
  id: int("id").primaryKey().autoincrement(),
  title: varchar("title", { length: 255 }).notNull(),
  caption: text("caption"),
  videoUrl: text("video_url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  productId: int("product_id").references(() => products.id, { onDelete: "set null" }),
  productName: varchar("product_name", { length: 255 }),
  productPrice: int("product_price"),
  productCompareAtPrice: int("product_compare_at_price"),
  productSlug: varchar("product_slug", { length: 255 }),
  productImage: text("product_image"),
  phoneModel: varchar("phone_model", { length: 255 }),
  likesCount: int("likes_count").notNull().default(18500),
  viewsCount: int("views_count").notNull().default(45200),
  commentsCount: int("comments_count").notNull().default(64),
  sharesCount: int("shares_count").notNull().default(2300),
  comments: json("comments").$type<ReelComment[]>().notNull().$defaultFn(() => []),
  active: boolean("active").notNull().default(true),
  sort: int("sort").notNull().default(0),
  ...timestamps,
});
