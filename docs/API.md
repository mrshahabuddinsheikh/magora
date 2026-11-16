# Store API v1 — guide for mobile apps (Flutter / React Native)

Base URL: `https://api.yourdomain.com/api/v1` (local: `http://localhost:4000/api/v1`)
Interactive docs (try every endpoint): `/docs` · OpenAPI JSON: `/docs/json` — generate a typed Dart/TS client from it with `openapi-generator`.

## Conventions

- Success → `{ "data": ..., "meta"?: {...} }`
- Error → `{ "error": { "code": "invalid_phone", "message": "Human readable text" } }` — show `message` to the user.
- Money is whole **PKR** integers (`2799` = Rs.2,799).
- Auth: `Authorization: Bearer <token>` (token from `/auth/login` or `/auth/register`, valid 30 days). Most shopping endpoints work **without** login.
- Send `source: "android" | "ios" | "huawei"` in checkout so orders are tagged per app.
- Breaking changes will go to `/api/v2`; `/api/v1` keeps working for old app versions.

## Typical app flow

```text
GET  /store                        → currency, delivery rules, cities, payment methods
GET  /brands                       → brand tabs + their phone models
GET  /phone-models?q=s25u          → type-ahead (short names & model numbers work: "16pm", "SM-S938B", "A3084")
GET  /products?model=<slug>&page=1 → product grid for the customer's phone
GET  /products/:slug               → product detail: colours, models (with 3D spec), variants (price/stock)
POST /carts                        → create cart once, SAVE data.id on the device
POST /carts/:id/items              → { variantId, qty }
POST /carts/:id/coupon             → { code }
POST /checkout                     → place COD order
GET  /orders/:number?token=...     → order screen (token returned by checkout)
POST /orders/track                 → { number, phone }
```

### Picking the variant

A variant = product × phone model × colour.

```js
const variant = product.variants.find(v => v.modelId === selectedModel.id && v.colorId === selectedColor.id);
// variant.price, variant.compareAtPrice, variant.stock, variant.inStock, variant.id → use id for the cart
```

### Checkout body

```json
{
  "cartId": "BjHhnll8nQkpSpJgWTZ7oSmg",
  "customer": { "name": "Ali Khan", "phone": "0300 1234567", "email": "" },
  "address": { "city": "Karachi", "area": "Gulshan", "line1": "House 12, Block 5" },
  "notes": "Call before delivery",
  "paymentMethod": "cod",
  "source": "android"
}
```

Response: `{ data: { order: {...number, accessToken...}, payment: { type: "none" | "redirect" | "form", ... } } }`
- `none` → show the success screen (COD).
- `redirect` → open `payment.url` in an in-app browser.
- `form` → open a WebView that auto-POSTs `payment.fields` to `payment.action` (JazzCash style).

Error codes to handle: `invalid_phone`, `empty_cart`, `stock_changed` (409, refresh the cart), `cod_limit`, `invalid_payment_method`.

## 3D spec for the native viewer

`product.models[i].spec`:

```json
{
  "heightMm": 163.4, "widthMm": 78, "depthMm": 8.75, "cornerRadiusMm": 12.5, "bodyHex": "#c8cacd",
  "camera": {
    "type": "bar", "x": 1.6, "y": 3.5, "w": 74.8, "h": 42, "r": 10, "rise": 1.4,
    "lenses": [{ "x": 14, "y": 14, "d": 15 }, { "x": 64, "y": 14, "d": 6, "kind": "flash" }]
  }
}
```

All values are millimetres on the back of the phone, from its top-left corner. The web implementation in
`apps/web/src/components/viewer/geometry.ts` is the reference: port it to Flutter (`flutter_gl`/`three_dart`)
or reuse it with `@react-three/fiber/native` in React Native. The quickest path is a WebView of the product page.

## Account

```text
POST   /auth/register        { name, email, phone?, password }
POST   /auth/login           { email, password }
GET    /me                   PATCH /me
GET    /me/orders
GET    /me/addresses         POST /me/addresses   DELETE /me/addresses/:id
GET    /me/wishlist          PUT /me/wishlist/:productId   DELETE /me/wishlist/:productId
GET    /products/:slug/reviews     POST /products/:slug/reviews
```

## Admin (role = admin)

```text
GET   /admin/stats
GET   /admin/orders?status=&q=&page=      GET /admin/orders/:number
PATCH /admin/orders/:number               { status, note?, paymentStatus? }
GET   /admin/products                     POST /admin/products   PATCH /admin/products/:id
GET   /admin/products/:id/variants        PATCH /admin/variants/:id   { price?, stock?, active? }
POST  /admin/phone-models                 (see example below)
GET   /admin/reviews                      PATCH /admin/reviews/:id { approved }
GET   /admin/coupons                      POST /admin/coupons
```

Add a new phone and make every case available for it:

```json
POST /admin/phone-models
{
  "brandSlug": "apple", "name": "iPhone 19 Pro Max", "year": 2027,
  "heightMm": 163.4, "widthMm": 78, "depthMm": 8.8, "cornerRadiusMm": 12.5,
  "camera": { "type": "bar", "x": 1.6, "y": 3.5, "w": 74.8, "h": 42, "r": 10, "rise": 1.4,
              "lenses": [{"x":14,"y":14,"d":15},{"x":14,"y":35,"d":15},{"x":31.5,"y":24.5,"d":15},{"x":64,"y":14,"d":6,"kind":"flash"}] },
  "aliases": "19pm 19promax", "priceAdjust": 300, "popular": true,
  "addToAllProducts": true, "stock": 20
}
```

Rate limits: 300 req/min per IP overall; checkout 10/min; login 10/min.

## Tracking, rider & returns (v2)

```text
GET  /couriers                              → supported couriers
GET  /orders/:number  (and /orders/track)   → now includes `shipment` { status, statusLabel, eta, currentLocation,
                                               trackingUrl, rider { name, phone, lat, lng, updatedAt, live }, events[] }
                                               plus `canReturn`, `returnDeadline`, `returns[]`
GET  /rider/:token                          → rider app/page: delivery details, cash to collect
POST /rider/:token/location   { lat, lng }  → live GPS (call every ~15 s while delivering)
POST /rider/:token/status     { status: out_for_delivery | delivered | failed_attempt, note?, lat?, lng? }
POST /shipping/:courier/webhook  (x-webhook-secret) { trackingNumber, status, location?, note?, at? }

GET  /returns/reasons
POST /orders/:number/returns  { token? | phone?, resolution: refund|exchange, reason, details?, exchangeNote?, refundMethod?, items:[{orderItemId, qty}] }
GET  /me/returns              GET /returns/:number
GET  /me/summary              → dashboard numbers (orders, spent, active, open returns)

Admin:
PUT  /admin/orders/:number/shipment          { courier, trackingNumber, riderName, riderPhone, etaAt }
POST /admin/orders/:number/shipment/events   { status, location?, note? }
POST /admin/orders/:number/shipment/sync     → pull from courier API
GET  /admin/deliveries/live                  → all shipments on the road with rider positions
GET  /admin/returns · GET/PATCH /admin/returns/:number
GET  /admin/customers · GET /admin/customers/:phone
GET  /admin/orders/export?from&to&status     → CSV
GET  /admin/phone-models · PATCH /admin/phone-models/:id · PATCH /admin/coupons/:code
```

A Flutter rider app can use the same `/rider/:token/*` endpoints with background location.

## Skins, protectors & custom photos (v3)

```text
GET  /products?category=magsafe-cases|skins|screen-protectors   (each product also returns `category`)
POST /uploads   multipart field "file" (JPG/PNG/WebP ≤ 15 MB) → { url }
POST /carts/:id/items { variantId, qty, custom?: { coverage?: "back" | "back_sides", imageUrl?, imageName? } }
     - skins: coverage "back_sides" adds the sides price
     - custom photo skin (material "skin-custom") requires custom.imageUrl from /uploads
Order items return `category`, `material` and `custom` (photo URL to print).
```

3D: `material` decides the view — `clear|frosted|silicone|leather|carbon` = case, `skin-*` = skin wrap, `glass-*` / `lens` = protector.

## Sections & gadgets (v4)

The store has four sections: `magsafe-cases`, `skins`, `screen-protectors` (made per phone model) and `gadgets` (universal).

```text
GET /categories                         → each category has `section`
GET /products?category=gadgets          → a whole section …
GET /products?category=earbuds          → … or one category (cables, chargers, earbuds, handsfree, smart-watches, power-banks)
                                          list items include `section` and `images` (uploaded photos, may be empty)
GET /products/:slug                     → gadgets: `models` is [] and every variant has `modelId: null`
                                          pick the variant by colour/option only: variants.find(v => v.colorId === option.id)
POST /carts/:id/items { variantId, qty } → same as cases; cart lines for gadgets have `model: null`
```

Order items for gadgets have `modelName: ""`. In apps, show the 3D gadget (see `apps/web/src/components/viewer/GadgetViewer.tsx`)
or the product `images`. Admin: `POST /admin/products` with `category: "earbuds"` (etc.) creates one variant per option;
options accept `priceAdd`; `images` (URLs from `POST /uploads`) can be set on create or with `PATCH /admin/products/:id`.

## Phone details for 3D (v5)

`product.models[i].spec.details` (and `GET /phone-models/:slug`):

```json
{
  "buttons": [{ "side": "right", "y": 40.4, "len": 20, "kind": "volume" }, { "side": "left", "y": 38.7, "len": 9, "kind": "key" }],
  "bottom": { "speaker": "right", "sim": "left" },
  "top": { "mic": true, "ir": true },
  "frontCam": "punch"
}
```

`side` is as seen from the screen, `y` is the button centre from the top in mm. Kinds: power, volume, action, camera, slider, key.
Brand defaults are applied automatically; override per phone with `PATCH /admin/phone-models/:id { details, camera, bodyHex }`.
`layout` on models can now also be `circle` (round island, centred) or `circle-left`.

## Product view (v7)

- `products.view` (JSON): `{ mode: "auto"|"design"|"model"|"photos", first: "3d"|"photos", designUrl, designFit: "cover"|"contain"|"logo", modelUrl, modelBytes }`. Returned on `GET /catalog/products` (list `view`) and product detail.
- `colors[].designUrl` — per-option print design (overrides `view.designUrl`).
- Admin product create/PATCH accepts `view`; options POST/PATCH accept `designUrl`.
- `POST /api/v1/uploads/model` (admin, multipart, ≤60 MB, .glb only) → `{ url, bytes, originalBytes, size:[x,y,z] }`. File is optimised (dedup, prune, weld, webp textures 1024, meshopt).
- Cart lines: `product.image` (photos mode) and `product.design` (`{url, fit}`) for thumbnails.

## Sales & COD safety (v8)

- Cart: `bundles[]` and `totals.bundleDiscount` / `totals.couponDiscount` / `totals.freeShippingAbove`. 10% off when 2+ of case / skin / protector are for the same phone (`store.bundle`).
- `GET /store` → `shipping.etaByCity`, `shipping.etaDefault` (working days).
- `GET /products?slugs=a,b,c` (recently viewed) and `category=skins,screen-protectors` (comma list).
- `POST /stock-alerts` `{ productId, colorId?, modelSlug?, phone, name? }` — back-in-stock request.
- `POST /checkout` with COD from a blocked number → 400 `cod_blocked`.
- Admin: `GET /admin/cod-queue`, `GET|POST /admin/blacklist`, `DELETE /admin/blacklist/:phone`, `GET /admin/stock-alerts?status=waiting|notified`, `POST /admin/stock-alerts/:id/notified`, `DELETE /admin/stock-alerts/:id`. `GET /admin/orders/:number` now has `risk`; `/admin/stats` has `codToConfirm`, `stockAlertsWaiting`.
- `POST /uploads` photos are re-encoded to WebP (max 2400 px, EXIF stripped); response adds `originalSize`.

## Launch hardening (v9)

- Production start refuses sample secrets (JWT_SECRET, WEB_REVALIDATE_SECRET, CORS_ORIGINS "*", localhost PUBLIC_API_URL).
- `/docs` (Swagger) only in development, or with `API_DOCS=true`.
- Security headers on every API response (nosniff, frame DENY, referrer policy, HSTS in production).
- `POST /admin/accounts/reset-password` `{ email }` → `{ tempPassword }`.
- CLI: `npm run admin:password -- email password`, `npm run db:backup` (see DEPLOY.md).

## Order desk & returns analytics (v10)

Order fields: `openParcel`, `weightGrams`, `labelPrintedAt`, `packedAt`, `shippedAt`, `deliveredAt`, `returnedAt`, `returnType` (rto | customer), `returnReason`, `returnCost`.

- `GET /admin/desk?stage=new|to_pack|packed|shipped|delivered|returned|cancelled&q&city&courier&printed=yes|no` → rows + `meta.counts`
- `GET /admin/desk/options` → couriers, cities, return reasons
- `POST /admin/desk/bulk` `{ numbers[], action: pack|ship|deliver|cancel|printed|open_parcel|courier|weight, courier?, openParcel?, weightGrams? }` → `{ done[], skipped[] }`
- `PUT /admin/desk/tracking` `{ courier, items: [{ number, trackingNumber }] }`
- `GET /admin/desk/scan/:code` — order number or courier tracking number
- `POST /admin/desk/return` `{ numbers[], type: rto|customer, reason, cost?, restock?, block? }`
- `GET /admin/desk/labels?numbers=A,B` — label data (+ items for the pick list)
- `GET /admin/reports/returns?days=30|90|365|0` — totals, byReason, byCity, byCourier, byCourierCity, byCustomer, byProduct, byModel, recent
- `/admin/stats` adds `toPack`.

## Reviews from real buyers (v11)

- Review fields: `orderId`, `photos[]`, `adminReply`. One review per product per order.
- `GET /review-invite/:number?t=<order access token>` → delivered order's products (+ already reviewed)
- `POST /review-invite/:number?t=…` `{ name, reviews: [{ productId, rating, title?, body, photos? }] }` → verified, waiting for approval; returns `thanksCoupon` if `REVIEW_THANKS_COUPON` is set
- `GET /products/:slug/reviews` adds `photos`, `adminReply`, `meta.breakdown` (5★…1★ counts), `meta.photos`
- Admin: `GET /admin/reviews` adds photos/orderNumber/adminReply; `PATCH /admin/reviews/:id` `{ approved?, adminReply? }`
- Order desk: delivered rows include `reviewToken`, `reviewRequestedAt`, `reviewsGiven`; bulk action `review_asked`.
- `GET /social-proof` → last 7 days real orders: `[{ city, product, slug, material, colorHex, model, at }]` (no names/phones, cached 60 s)
