# Magora — MagSafe Case Store

Customer apna phone chunta hai (iPhone / Samsung / Pixel). Model chunte hi usi phone par case **3D mein laga hua** dikhta hai, jise woh ghuma sakta hai, zoom kar sakta hai aur colour badal sakta hai. Phir **Cash on Delivery** se order karta hai.

> "Magora" sirf ek placeholder naam hai. Isay badalne ke liye `apps/api/.env` mein `STORE_NAME` aur `apps/web/.env.local` mein `NEXT_PUBLIC_STORE_NAME` change karein.

---

## 1. Chalane ka tareeqa (Windows / Mac)

**Zarurat:** [Node.js 22 LTS](https://nodejs.org) (20.11+ bhi chalega)

```bash
# is folder (magsafe) mein terminal kholo
npm install          # pehli dafa, 2–3 minute
npm run setup        # database + demo products + admin account
npm run dev          # website + API dono start
```

| Kya | Link |
|---|---|
| Website | http://localhost:3000 |
| Admin panel | http://localhost:3000/admin |
| API docs (Swagger), mobile app developers ke liye | http://localhost:4000/docs |

**Admin login:** `admin@magora.pk` / `ChangeMe@123`. Live karne se pehle `apps/api/.env` mein yeh zaroor badlein.

**Demo coupons:** `WELCOME10` (10% off, Rs.2,000 se upar) · `FREESHIP`

### Doosre commands

| Command | Kaam |
|---|---|
| `npm run build` | Production build (API khud start ho kar build ke baad band ho jati hai) |
| `npm start` | Production mode mein website + API chalana |
| `npm run db:reset` | Database delete karke demo data dobara bharna |
| `npm run db:seed:bulk` | 5,000 demo products add karna, speed test ke liye |
| `npm run typecheck` | TypeScript errors check karna |

---

## 2. Project ka structure

```
magsafe/
├─ apps/
│  ├─ api/                  ← Node.js backend (Fastify) — REST API v1
│  │  ├─ src/modules/       catalog, cart, orders (checkout/COD), account, admin
│  │  ├─ src/payments/      COD ✅ · JazzCash / Easypaisa / Card (ready slots)
│  │  ├─ src/db/schema.ts   database tables (Drizzle ORM)
│  │  ├─ src/db/data/       phones.ts (phone sizes + camera) · products.ts
│  │  └─ drizzle/           SQL migrations
│  └─ web/                  ← Next.js 16 (React 19) storefront
│     ├─ src/app/           pages: home, shop, product, cart, checkout, order, track, account, admin
│     └─ src/components/viewer/   3D phone + case engine (three.js)
├─ docs/API.md              mobile app developers ke liye guide
└─ scripts/                 setup / build helpers
```

---

## 3. 3D preview kaise kaam karta hai

- Har phone ki **sirf dimensions** database mein hain: height, width, thickness, corners aur camera ki position (`apps/api/src/db/data/phones.ts`).
- Website in numbers se phone aur case ka 3D model **browser mein khud banati hai**, isliye koi heavy 3D file download nahi hoti.
- Case ka material (Clear, Frosted, Silicone, Leather, Carbon) aur colour code se lagta hai. 10 colours ke liye bhi alag file nahi chahiye.
- 3D engine (~270 KB) **sirf product page aur home page par**, page khulne ke baad load hota hai. Pehle ek SVG preview foran dikhta hai.

### Naya phone add karna (iPhone 19, Galaxy S27 …)

**Option A — seed file:** `apps/api/src/db/data/phones.ts` mein milte-julte phone ki line copy karke size aur naam badlein, phir `npm run setup -w @magora/api` chalayein.

**Option B — API se:** `POST /api/v1/admin/phone-models` with `addToAllProducts: true`. Is se har product ke liye us phone ke variants khud ban jayenge. Example `docs/API.md` mein hai.

> Camera positions approximate hain. Kisi phone ka 3D thoda off lage to `phones.ts` mein `x / y / d` (millimetres) adjust karein.

### Naya product (case design) add karna

`POST /api/v1/admin/products` par naam, material, price aur colours bhejein. Har phone × colour ka variant (price + stock) khud ban jayega. Admin panel mein **Products → Stock & prices** se har phone/colour ka stock aur price badla ja sakta hai.

---

## 4. Speed: products bohat zyada ho jayein tab bhi

5,000 products / 95,000 variants ke saath test kiya gaya:

| | Time |
|---|---|
| API: product list (koi bhi page/sort/filter) | 3–40 ms |
| Website: page server response (production) | 5–40 ms |
| Shop page size (gzip) | ~23 KB |

Iske peeche yeh cheezein hain:
- Database indexes, pagination aur `minPrice` pehle se calculated rakha gaya hai.
- API mein in-memory cache aur HTTP cache headers hain.
- Next.js `use cache` aur Partial Prerendering se pages cache se serve hote hain. Admin jab kuch badalta hai to API website ko ping karti hai aur page foran refresh ho jata hai.
- Product cards SVG hain, koi image download nahi hoti. 3D lazy load hota hai.

**Production ke liye:** SQLite file ki jagah [Turso](https://turso.tech) (libSQL, same code) use karein. Bas `DATABASE_URL` aur `DATABASE_AUTH_TOKEN` badlein. Agar API ke kai servers chalane hon to `src/lib/cache.ts` mein Redis lagayein.

---

## 5. Mobile apps (Flutter / React Native — Android, iOS, Huawei AppGallery)

Saari functionality **versioned REST API** (`/api/v1`) mein hai. Website bhi isi API se chalti hai, isliye app mein wohi sab mil jayega: catalog, model search, cart, COD checkout, order tracking, login aur reviews. Poori guide **[docs/API.md](docs/API.md)** mein hai, aur live Swagger `http://localhost:4000/docs` par.

App mein 3D ke liye do raaste hain:
1. **WebView** mein product page ka viewer dikhayein (sab se jaldi).
2. Flutter mein `three_dart` / `flutter_gl`, ya React Native mein `@react-three/fiber/native` use karein. Wohi `spec` (dimensions + camera) API deti hai.

---

## 6. Online payment (baad mein)

`apps/api/src/payments/` mein slots tayyar hain:
- `cod.ts` ✅ chal raha hai
- `jazzcash.ts`: form + secure hash ka skeleton hai. Merchant account milne par `.env` mein credentials dalein aur `JAZZCASH_ENABLED=true` karein, phir JazzCash ki apni guide se fields verify karein.
- `stubs.ts`: Easypaisa aur Card (PayFast etc.). `initiate()` likhna baqi hai.

Checkout page aur apps enabled methods khud dikha dete hain. Callback URL `POST /api/v1/payments/:provider/callback` hai.

---

## 7. Live karne se pehle checklist

> Poora step-by-step tareeqa: **[DEPLOY.md](DEPLOY.md)** (server, domain, HTTPS, backups, updates).

- [ ] `JWT_SECRET`, `ADMIN_PASSWORD`, `WEB_REVALIDATE_SECRET` / `REVALIDATE_SECRET` badlein
- [ ] Store ka naam, WhatsApp number, support phone/email (`.env` files)
- [ ] `apps/web/src/app/help/[slug]/page.tsx` mein policies apne business ke hisaab se likhein
- [ ] Prices, delivery charges, COD limit: `apps/api/src/config.ts`
- [ ] Database: Turso (ya VPS par SQLite + daily backup)
- [ ] Hosting: website → Vercel, API → Railway / Render / VPS (`npm start`)
- [ ] `CORS_ORIGINS` aur `NEXT_PUBLIC_SITE_URL` mein asal domain
- [ ] Real product photos (agle phase mein upload feature)

> MagSafe Apple ka trademark hai. Website par "MagSafe-compatible" hi likha gaya hai, aur brand ke naam mein "MagSafe" use na karein.

---

## 8. Naye features (v2)

### Header ka crystal dropdown (Ronin style)
iPhone / Samsung / Pixel / Materials par mouse le jao to header ki glass pill neeche panel mein khul jati hai — left mein tabs, right mein har model ka card. Mobile par menu ke andar brand dabane se models khulte hain. Code: `apps/web/src/components/MegaMenu.tsx`.

### Customer account (`/account`)
- Dashboard: orders, raaste mein orders, total kharch, open returns
- **Purane orders khud jud jate hain** — jis email ya mobile se guest order kiya tha, usi se account banao to woh orders account mein aa jate hain
- Har order ki detail + live tracking, returns, saved addresses, wishlist (♡ product page par), profile/password

### Delivery tracking + rider ki live location
1. Admin → Orders → order kholo → **Shipping & tracking** mein courier chuno (apna rider / TCS / Leopards / PostEx / Trax / M&P / Call Courier), tracking number, rider ka naam/number, ETA → **Book shipment**
2. **Rider link** copy karo ya "Send to rider" se WhatsApp karo. Rider phone par link khol kar **Start delivery** dabata hai — uski GPS location har ~15 second customer ke order page aur admin ke **Live deliveries** map par dikhti hai
3. Rider wahi page se **Delivered** (cash collected) ya **Couldn't deliver** mark karta hai
4. Courier ke saath: admin "Add tracking update" se (Picked up → At hub → Out for delivery → Delivered) location ke saath update karta hai, ya courier ka API/webhook lagao to updates khud aate hain: `POST /api/v1/shipping/:courier/webhook` (header `x-webhook-secret`). Courier API code: `apps/api/src/shipping/index.ts`
5. Customer ko order page / Track Order par dikhta hai: kahan hai (warehouse, hub, rider ke paas), **kab tak pohanchega (ETA)**, rider ka naam + call button, aur map

> Map OpenStreetMap ka hai (free, koi API key nahi). Rider ka GPS sirf tab share hota hai jab woh "Start delivery" dabaye aur order "out for delivery" ho.

### Returns & exchange
Delivered order par 7 din tak customer **Return or exchange** kar sakta hai (items, wajah, exchange mein kaunsa model chahiye ya refund kahan chahiye). Admin → Returns mein: Approve → Pickup scheduled → Received (stock wapas) → Refunded / Exchanged.

### Admin panel (`/admin`)
Dashboard (sales chart, status, top products) · Orders (status, shipping, invoice print, WhatsApp, Excel/CSV export) · Live deliveries map · Returns · Customers (guest + registered, order history) · Products & stock (naya product form, har phone × colour ka price/stock, bulk stock) · Coupons · Phone models · Reviews.

---

## 9. Skins & Screen Protectors (v3)

Store ab teen product lines bechta hai — har ek ka apna dropdown, apna shop page aur apna 3D preview:

| | Kya hai | Kahan |
|---|---|---|
| **MagSafe Cases** | Pehle jaise | `/shop?category=magsafe-cases` |
| **Skins** | Back ya back + sides vinyl skin (Matte, Carbon, Marble, Wood, Metal) | `/shop?category=skins` |
| **Custom Photo Skin** | Customer apni photo upload kare → foran 3D mein apne phone par dekhe → hum print + laser-cut karke bhejte hain | `/product/custom-photo-skin` |
| **Screen Protectors** | 9H Tempered, Privacy, Matte glass (Single / 2-Pack) + Camera Lens guard | `/shop?category=screen-protectors` |

- Shop page par upar **Cases | Skins | Screen Protectors** switch hai — jo chuno, sirf wahi products dikhte hain
- Skins par **Coverage**: Back only ya Back + sides (+Rs.300 — `apps/api/src/config.ts` mein `skinSidesPrice`)
- **Custom photo** orders: admin → Orders → order kholo → item ke neeche **Download print file** (asal photo). Invoice par bhi file ka naam hota hai. Photos `apps/api/uploads/` mein save hoti hain (production mein S3 / Cloudflare R2 behtar hai)
- Naye products admin → Products → **New product** se: Category (Cases / Skins / Screen Protectors) aur style chuno — 3D look khud us hisaab se banta hai
- `start.bat` har dafa naye categories/products database mein add kar deti hai — aapki admin edits (price/stock) kabhi overwrite nahi hoti. Sab demo data dobara chahiye to `npm run db:seed -w @magora/api -- --reset`

---

## 10. Har section apni alag shop (v4) + Gadgets

Website ab **4 shops** mein bat gayi hai. Jo shop kholo, poori website usi ki ban jati hai: header ka menu, upar ki black patti (announcement), search, mobile menu aur home page sab usi section ke hisaab se. Baqi teen shops header mein chhote icons aur home page par chhote cards ban kar side mein rehti hain.

| Shop | Home page | Header menu |
|---|---|---|
| **MagSafe Cases** | `/` (pehle jaisa) | iPhone · Samsung · Google Pixel · Materials |
| **Skins** | `/skins` | iPhone · Samsung · Google Pixel · Designs · Your Photo |
| **Screen Protectors** | `/screen-protectors` | iPhone · Samsung · Google Pixel · Types |
| **Gadgets** (naya) | `/gadgets` | Earbuds · Smart Watches · Power Banks · Chargers · Cables · Handsfree |

- **Switch:** desktop par header mein logo ke daayein 4 icons (📱 cases, skins, protectors, 🎧 gadgets) hain. Mobile par header ke neeche 4 buttons hain jo scroll karne par chhup jaate hain, aur menu (☰) ke andar bhi hain
- Customer jis shop mein hai, cart / checkout / account par bhi wahi header rehta hai
- **Gadgets har phone ke liye hain**, isliye un mein phone model chunne ka step nahi hai. Customer option chunta hai (colour, cable length, pack…), 3D mein ghuma kar dekhta hai aur order karta hai
- Gadgets ke 3D models (earbuds, watch, power bank, charger, cable, handsfree) code se bante hain, koi file download nahi hoti
- **Product photos:** Admin → Products → **Photos** se kisi bhi product ki asli photos upload karo. Pehli photo product card par aati hai, baqi product page par 3D ke saath. Gadgets ke liye asli photos lagana behtar hai
- **Naya gadget add karna:** Admin → Products → **New product** → Category mein "Gadgets" wale group se type chuno (Earbuds, Chargers…) → options (colour / length) aur har option ki extra price (+Rs.) → photos. Har option ka alag stock aur price ban jata hai
- Gadgets par 6-month warranty aur 7-day return ki baat likhi hai. Agar aapki policy alag hai to `apps/web/src/components/GadgetProductClient.tsx` aur `apps/web/src/app/gadgets/page.tsx` mein text badal dein

---

## 11. Naye phone brands + behtar 3D (v5)

**9 brands, 57 phones:** iPhone, Samsung, Google Pixel, **Xiaomi, OnePlus, vivo, OPPO, iQOO, Motorola** (2024–2026 flagships: Xiaomi 17 Ultra, OnePlus 15, vivo X300 Pro, OPPO Find X9 Pro, iQOO 15, Motorola Signature…). Har phone ke liye har case / skin / protector khud available ho jata hai.

- Header mein iPhone · Samsung · Google Pixel aur **More phones ▾** (baqi brands) hai
- Gol camera wale phones (vivo X, OPPO Find X8 Pro / X9 Ultra, Xiaomi Ultra, OnePlus 13) ka round camera island, metal trim ke saath. Aise phones par MagSafe ring khud thoda neeche aa jata hai, jaise asli cases mein hota hai

**3D detail (har phone par):**
- Neeche: USB-C port, speaker grille ke holes, mic hole, SIM tray (jahan hota hai)
- Upar: mic, IR blaster (Xiaomi / OnePlus / vivo / iQOO)
- Side buttons brand ke hisaab se: iPhone (Action button + Camera Control), OnePlus (alert slider / Plus Key), baqi (volume + power)
- Frame par antenna lines, display ke gird patla bezel, lens par coating ki reflections, phone ke neeche soft shadow
- Case mein neeche port/speaker ka opening aur buttons par ubhre hue covers
- Product page par naya **Bottom** view

**Speed:** sab kuch code se banta hai (koi 3D file download nahi). Saari chhoti details ek-do draw calls mein merge hoti hain. Phone 25 second ghoomta hai, phir ruk jata hai, aur us ke baad sirf tab render hota hai jab customer kuch badle — phone ki battery bachti hai.

**Kisi phone ki details theek karni hon:** `PATCH /api/v1/admin/phone-models/:id` mein `camera` (camera layout) ya `details` (buttons / ports) bhejein. Naye brand ke phones `apps/api/src/db/data/phones.ts` mein add karein.

> Note: vivo X300 Ultra ka official size abhi nahi mila, is liye X200 Ultra jaisa size rakha gaya hai — milne par `phones.ts` mein theek kar dein. Camera positions approximate hain.

---

## 12. Admin: Product editor (v6)

Admin → **Products & stock**:
- Upar tabs: **All · Cases · Skins · Protectors · Gadgets** (Gadgets mein type bhi chun sakte ho), aur Live / Hidden / Low stock filter
- **New product** ya kisi product par **Edit** → bara editor khulta hai, saath mein **live 3D preview** aur product card jaisa customer dekhega:
  1. **Category & style** — Cases / Skins / Protectors / Gadgets, phir material / design / type (isi se 3D look banta hai)
  2. **Naam, line, description**, badge (New, Best Seller, Sale…) aur home page par featured
  3. **Price** aur compare-at price (discount % khud dikhta hai)
  4. **Options & stock** — har colour / length / pack ki apni extra price (+Rs.) aur stock; quick colours aur presets (Single + 2-Pack, 1 m / 2 m cable)
  5. **Photos** upload (pehli photo card par)
  6. **Feature tags** aur **specifications** (har category ka ready template)
  7. **Kaun se phones** — sab phones ya brand-wise chuno
- **Duplicate** se milta-julta naya product ek click mein (copy hidden rehti hai jab tak on na karo)
- Purane orders par koi asar nahi: option hatane par bhi order mein naam/colour mehfooz rehta hai

---

## 13. Product view: 3D, print design, apna 3D model, ya sirf photos (v7)

Editor ke section **"5 · 3D & photos"** mein har product ke liye chuno customer kya dekhe:

| Mode | Kab use karein | Customer kya dekhta hai |
|---|---|---|
| **3D from style & colour** (default) | Saada case / skin / gadget | Style aur colour se bana 3D (koi file nahi, sab se tez) |
| **3D + print design** (cases & skins) | Printed / designer cases | Aap ki design image phone ki back par 3D mein chhapi hui, camera ke hole khud kat jate hain |
| **Own 3D model** (gadgets) | Jab aap ke paas .glb file ho | Aap ka asli 3D model, ghuma kar dekh sakta hai |
| **Photos only** | Jab 3D ki zarurat na ho | Photo gallery, swipe + tap-to-zoom |

- **Design fit:** *Fill the whole back* (poori back) · *Show whole design* (poori image, kinare khaali) · *Small logo in the middle*
- **Har option ki alag design:** "Rose", "Marble", "Galaxy" jaise options mein har ek ki apni image — customer jo chune wahi 3D par aur cart mein dikhe. Option buttons par design ki chhoti swatch.
- **.glb upload:** upload karte waqt file khud compress hoti hai (texture webp 1024 + meshopt) — misaal: 2.9 MB → 0.9 MB. Kharab file aaye to page apna bana-bana 3D dikha deta hai.
- **Photos + "Show first":** kisi bhi mode mein photos lagao; chuno pehle 3D dikhe ya photo. Product page par neeche photo strip mein "3D" tile + photos, aur photo par tap → full-screen zoom (keyboard / swipe).
- Shop card, cart, checkout aur admin list sab mein wahi design / photo dikhta hai.

**Speed:** design sirf ek image hai jo 3D par chadti hai (koi extra 3D file nahi). GLB sirf us product page par load hota hai jahan "Own 3D model" ho.

---

## 14. Zyada sale + COD ki hifazat (v8)

**Customer ko kya naya mila (product page):**
- **Complete the protection:** case ke saath usi phone ka protector + skin. Saath lene par **10% off** cart mein khud lagta hai ("Bundle discount"). % badalna ho to `apps/api/src/config.ts` → `bundle.percent` (aur `ProductExtras.tsx` mein `BUNDLE_PCT`).
- **Delivery date:** "Delivery to Karachi: Fri 13 Nov – Sat 14 Nov". Customer apna shehar chunta hai, yaad rehta hai. Din `config.ts` → `shipping.etaByCity`.
- **Notify me:** stock khatam ho to customer apna number deta hai.
- **Share:** WhatsApp share + link copy.
- **Recently viewed:** customer ne jo products dekhe, neeche dikhte hain.

**Admin mein naya:**
- **Confirm COD orders:** har naya COD order ek card mein. **WhatsApp** dabao (confirm message khud likha hota hai) ya **Call**. Phir **Confirmed** / **No answer** / **Fake**.
  - Har customer par risk badge: *New customer*, *Trusted* (pehle delivered), *Caution* (pehle 1 order cancel/return), *High risk*, *Blocked*. Yahi badge order ki detail mein bhi.
  - **Fake** dabane par order cancel, stock wapas, aur number block (checkbox).
- **Blocked numbers:** blocked number COD se order nahi kar sakta; use WhatsApp karne ka kaha jata hai. Wahin se unblock bhi.
- **Back-in-stock requests:** kaun kis product / phone / colour ka intezar kar raha hai, aur abhi stock hai ya nahi. Stock aate hi **WhatsApp** (message tayyar) → **Done**.
- Menu par laal counters: kitne COD orders confirm karne hain, kitne stock requests, kitne returns.
- **Photo upload khud chhoti hoti hai** (WebP, max 2400px, location data hata kar). Misaal: 1.2 MB → 0.23 MB.

---

## 15. Order management: Order desk, parcel labels, return analysis (v10)

### Order ka safar
**Confirm COD orders** (WhatsApp/call) → **Order desk** mein:

| Stage | Matlab | Yahan kya karte hain |
|---|---|---|
| **To pack** | Confirm ho gaya | Tick karo → **Pick list** (shelf se kya nikalna hai) → **Print labels** → **Courier & tracking** |
| **Packed** | Pack + courier book | **Handed to courier** (rider ko de diya) |
| **With courier** | Raste mein | **Delivered** ya **Returned** |
| **Delivered** | COD wasool | Customer baad mein wapas kare to **Returned** (customer return) |
| **Returned** | Wapas aa gaya | Wajah ke saath record |

- Ek saath bohat se orders tick kar ke kaam: label print, pack, courier, ship, deliver, return, cancel, open-parcel on/off.
- **Tracking numbers paste:** courier ki booking sheet se poori list ek saath paste karo, khud orders mein bhar jaate hain.
- **Barcode scanner:** label ka barcode scan karo. *Find* = order khulta hai, *Scan = handed to courier* / *Scan = delivered* = ek scan mein status badal jata hai. Order number aur courier tracking number dono se chalta hai.
- Filters: shehar, courier, label print hua ya nahi, search (order #, naam, phone, tracking).

### Parcel label (`/admin/labels`)
- **A4 paper par 4 labels** (A6 size) ya **4×6" label printer** (ek label ek page).
- Label par: store ka naam, date, **courier + tracking barcode**, **customer naam, phone, address, SHEHAR (bara)**, **COD: kitne paise lene hain** (ya "Prepaid — do not collect cash"), **OPEN PARCEL: ALLOWED / NOT ALLOWED**, order # barcode, pieces, wazan, "Contents: Mobile accessories" (asal product chhupa rehta hai), customer ka note, aur return address.
- Print karte hi orders par "Label ✓" lag jata hai.
- Return address: `.env` mein `STORE_ADDRESS`. Open parcel default: `OPEN_PARCEL_DEFAULT=true/false` (har order par alag bhi badal sakte hain).

### Returned mark karna
- Do qisam: **Courier ne wapas kiya** (refused, phone band, ghalat address…) ya **Customer ne delivery ke baad wapas kiya**.
- Wajah chuno (ya apni likho), return charges, maal stock mein wapas daalna hai ya nahi, aur number block karna hai ya nahi.

### Return analysis
30 din / 90 din / 1 saal / sab ke liye:
- Kitne parcels bheje, kitne wapas, **return %**, kitna nuqsaan (delivery + return charges).
- **Wajah** ke hisaab se, **kaun se customers** zyada wapas karte hain (wahin se WhatsApp ya Block), **shehar**, **courier**, **courier × shehar** (kis shehar mein kaunsa courier kamzor), **product**, **phone model**.
- Rang: 10% se kam hara, 25% tak peela, us se zyada laal.

---

## 16. Asli reviews: gold stars, WhatsApp review link, Urdu support (v11)

**Customer ko kya dikhta hai**
- **Gold stars** (gradient). Pehli baar screen par aate hi ek ek kar ke "pop" hote hain. Jin logon ne phone mein animation band ki ho, unhein seedhe stars dikhte hain.
- Product page par: bara average (jaise 4.3), **5★ se 1★ tak bars**, **customers ki photos**, har review par **Verified buyer** aur **store ka jawab**.
- **English, Roman Urdu aur اردو** sab chalte hain. Urdu khud right-to-left dikhti hai.
- Koi review na ho to: "Be the first to review this product". Jhoote ya khaali stars nahi dikhte.

**Reviews kaise aayenge (asli khareedaron se)**
1. Order desk → **Delivered** → order par **Ask for review** (hara WhatsApp button).
2. WhatsApp par customer ko uska apna link jata hai: `/review/MG100123?t=…`. Login ki zarurat nahi.
3. Customer stars deta hai, apni zaban mein likhta hai, aur 3 tak photos lagata hai. Review par **Verified buyer** lagta hai.
4. Admin → **Reviews** → *Waiting for approval* → **Approve**. Neeche **store ka jawab** bhi likh sakte hain (kam stars par zaroor jawab dein).
- Ek order ke ek product par ek hi review ho sakta hai, aur link sirf delivered order par chalta hai.
- Shukriya ka discount (optional): Admin → Coupons mein code banayein (jaise `THANKYOU100`), phir `.env` mein `REVIEW_THANKS_COUPON=THANKYOU100`. Review ke baad customer ko ye code dikhta hai.

> Banawati reviews na daalein. Pakistan ke consumer laws aur Google/Facebook ki policies ke khilaf hain, aur pakre jaane par ads account band ho sakta hai.

### Trust signals (asli data se)
- **"Someone in Lahore bought …"** popup: neeche left, har 30–60 second baad, 6 second ke liye. Sirf **pichle 7 din ke asli orders** (shehar + product + kitni der pehle). Naam ya number kabhi nahi. Koi order na ho to popup nahi aata. Customer ✕ daba de to us visit mein dobara nahi aata. Admin, checkout, cart aur account pages par band hai.
- Product cards ke gold stars: pehli baar nazar aate hi pop hote hain, phir har ~6 second baad halki chamak (sirf jin products ki asli rating ho).
